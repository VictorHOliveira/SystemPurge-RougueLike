import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import type { FOVSystem } from '../systems/FOV';
import { RenderSystem } from '../systems/RenderSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ActionSystem } from '../systems/ActionSystem';
import { FloorGenerator } from '../systems/FloorGenerator';
import { GameState } from '../systems/GameState';
import { TileType } from '../data/tiles';
import { version } from '../../package.json';
import { trackEvent } from '../analytics';
import { sound } from '../audio/SoundManager';
import { MAP_W, MAP_H, TILE, MOVE_COOLDOWN_BASE, TWEEN_DURATION_BASE, isAdjacent } from '../constants';
import { InputHandler } from './GameInput';
import { RegistryKeys } from '../RegistryKeys';
import { META_UPGRADES, CLASS_FLOOR_UNLOCK } from '../data/metaUpgrades';
import { loadMeta, saveMeta } from '../utils/metaSave';
import { PURCHASABLE_ABILITIES } from '../data/purchasableAbilities';
import { CLASSES } from '../data/classes';

export class GameScene extends Phaser.Scene {
  state!: GameState;
  renderSystem!: RenderSystem;
  combatSystem!: CombatSystem;
  projectileSystem!: ProjectileSystem;
  actionSystem!: ActionSystem;
  floorGenerator!: FloorGenerator;
  inputHandler!: InputHandler;

  isAnimating = false;
  tempMoveCooldown = 0;

  classId: string = 'limpador';

  private occGrid: Uint8Array = new Uint8Array(MAP_H * MAP_W);
  private occGridDirty: number[] = [];

  init(data?: { classId?: string }) {
    if (data?.classId) this.classId = data.classId;
  }

  constructor() {
    super('Game');
  }

  private onResume = () => {
    if (this.registry.get(RegistryKeys.restartPending)) {
      this.registry.set(RegistryKeys.restartPending, false);
      this.fullRestart();
    }
    this.inputHandler.initBindings();
    this.syncStaticRegistry();
    this.syncRegistry();
  };

  create() {
    this.state = {
      map: null as any,
      player: null as any,
      enemies: [],
      fov: null as any,
      turnSystem: null as any,
      messageLog: null as any,
      kills: 0,
      chests: new Map(),
      bossRoomIdx: -1,
      minibossRoomIdx: -1,
      altarRoomIdx: -1,
      altarUsed: false,
      bossKilled: false,
      classId: this.classId,
      enemyBleeds: new Map(),
    };

    this.renderSystem = new RenderSystem(this, this.state);
    this.projectileSystem = new ProjectileSystem(this, this.state, {
      meleeAttack: (a, d, p) => this.combatSystem.meleeAttack(a, d, p),
      onAnimationStart: () => { this.isAnimating = true; },
      onAnimationEnd: () => { this.isAnimating = false; this.endTurn(); },
    });
    this.combatSystem = new CombatSystem(this, this.state, {
      onEnemyDeath: (enemy) => this.handleEnemyDeath(enemy),
      spawnParticles: (x, y, tint, c) => this.renderSystem.spawnParticles(x, y, tint, c),
      enemyAt: (x, y) => this.projectileSystem.enemyAt(x, y),
    });
    this.actionSystem = new ActionSystem(this, this.state, {
      meleeAttack: (a, d, p) => this.combatSystem.meleeAttack(a, d, p),
      spawnParticles: (x, y, tint, c) => this.renderSystem.spawnParticles(x, y, tint, c),
      onEnemyDeath: (enemy) => this.handleEnemyDeath(enemy),
      getDirEnemy: (dx, dy) => this.projectileSystem.getDirEnemy(dx, dy),
      onAnimationStart: () => { this.isAnimating = true; },
      onAnimationEnd: () => { this.isAnimating = false; },
      onMapRevealed: () => this.renderSystem.markAllDirty(),
      endTurn: () => this.endTurn(),
      onBossRewardsComplete: () => {
        const meta = loadMeta();
        const floor = this.state.player.floor;
        let newUnlock: string | null = null;
        for (const [classId, reqFloor] of Object.entries(CLASS_FLOOR_UNLOCK)) {
          if (floor >= reqFloor && !meta.unlocks[classId]) {
            meta.unlocks[classId] = true;
            newUnlock = classId;
          }
        }
        if (newUnlock) {
          saveMeta(meta);
          this.scene.pause();
          this.scene.launch('ClassUnlock', { classId: newUnlock });
        }
      },
    });
    this.floorGenerator = new FloorGenerator(this, this.state);

    this.cameras.main.setViewport(0, 0, 640, 640);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    const meta = loadMeta();
    const startFloor = meta.startFloor ?? 0;
    if (startFloor > 0) {
      delete meta.startFloor;
      saveMeta(meta);
    }
    this.generateFloor(true, startFloor);

    if (startFloor > 1) {
      const p = this.state.player;
      let xpTotal = 0;
      let xpToNext = 20;
      for (let lvl = 1; lvl < startFloor; lvl++) {
        xpTotal += xpToNext;
        xpToNext = Math.floor(xpToNext * 1.5);
      }
      p.addXp(xpTotal);
    }

    this.applyMetaUpgrades();
    this.loadActiveAbilities();
    this.syncStaticRegistry();
    this.syncRegistry();

    this.inputHandler = new InputHandler(this);
    this.inputHandler.init();

    this.events.on('resume', this.onResume, this);
    this.events.on('shutdown', () => {
      this.renderSystem?.destroyAll();
      this.inputHandler?.destroy();
      this.events.off('resume', this.onResume, this);
    });

    this.scene.launch('HUD');
  }

  update(_time: number, delta: number) {
    if (!this.state.player) return;
    if (this.isAnimating) return;
    this.inputHandler.handleMovement(delta);
  }

  endTurn() {
    this.syncRegistry();
    this.state.turnSystem.endPlayerTurn();

    this.combatSystem.processClassPressure();

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y, (x, y) => this.renderSystem.onTileVisibilityChange(x, y));

    this.combatSystem.processAdjacentAttacks();

    if (!this.state.player.isAlive) {
      this.handlePlayerDeath();
      return;
    }

    this.processEnemyAI();

    if (!this.state.player.isAlive) {
      this.handlePlayerDeath();
      return;
    }
    this.projectileSystem.rebuildEnemyGrid();
    this.combatSystem.rebuildEnemyMap();

    this.state.turnSystem.reset();

    this.state.player.processTurnEnd();

    this.renderSystem.redrawMap();
    this.renderSystem.syncEntitySprites();
    this.renderSystem.centerOnPlayer();
  }

  private handlePlayerDeath() {
    sound.play('player_death');
    this.renderSystem.spawnParticles(this.state.player.x, this.state.player.y, 0xff4444, 12);
    this.state.messageLog.add('*** SISTEMA FALHOU ***');
    trackEvent('player_death', { floor: this.state.player.floor, level: this.state.player.level, kills: this.state.kills });
    this.syncRegistry();
    this.renderSystem.syncEntitySprites();
    this.scene.pause();
    this.scene.launch('GameOver', {
      floor: this.state.player.floor,
      level: this.state.player.level,
      kills: this.state.kills,
      name: this.state.player.name,
      classId: this.state.classId,
      bossKilled: this.state.bossKilled,
    });
  }

  private enemyIsWalkable = (x: number, y: number): boolean => {
    return this.state.map.isWalkable(x, y);
  };

  private enemyIsOccupied = (x: number, y: number): boolean => {
    if (this.state.player.x === x && this.state.player.y === y && this.state.player.isAlive) return true;
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && this.occGrid[y * MAP_W + x]) return true;
    return false;
  };

  private rebuildOccGrid() {
    for (let i = 0; i < this.occGridDirty.length; i++) {
      this.occGrid[this.occGridDirty[i]] = 0;
    }
    this.occGridDirty.length = 0;
    const { enemies, chests } = this.state;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isAlive) {
        const pos = e.y * MAP_W + e.x;
        this.occGrid[pos] = 1;
        this.occGridDirty.push(pos);
      }
    }
    for (const [key, opened] of chests) {
      if (!opened) {
        const idx = key.indexOf(',');
        const cx = parseInt(key.substring(0, idx), 10);
        const cy = parseInt(key.substring(idx + 1), 10);
        const pos = cy * MAP_W + cx;
        this.occGrid[pos] = 1;
        this.occGridDirty.push(pos);
      }
    }
  }

  private processEnemyAI() {
    if (!this.state.player.isAlive) return;

    this.combatSystem.processEnemyBleeds();

    this.rebuildOccGrid();

    const { player, map } = this.state;
    const enemies = this.state.enemies;

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy.isAlive) continue;
      if (!player.isAlive) break;
      if (isAdjacent(player.x, player.y, enemy.x, enemy.y)) {
        if (enemy.behavior === 'suicide') {
          this.combatSystem.suicideExplosion(enemy, player);
          if (!player.isAlive) return;
          this.handleEnemyDeath(enemy);
        }
        continue;
      }

      const canSeePlayer = map.visible[enemy.y]?.[enemy.x] ?? (Math.max(Math.abs(player.x - enemy.x), Math.abs(player.y - enemy.y)) <= 2);

      const prevX = enemy.x;
      const prevY = enemy.y;

      enemy.takeTurn(
        player.x,
        player.y,
        canSeePlayer,
        this.enemyIsWalkable,
        this.enemyIsOccupied,
      );

      const didMove = enemy.x !== prevX || enemy.y !== prevY;

      if (isAdjacent(player.x, player.y, enemy.x, enemy.y)) {
        if (enemy.behavior === 'suicide') {
          this.combatSystem.suicideExplosion(enemy, player);
          if (!player.isAlive) return;
          this.handleEnemyDeath(enemy);
          continue;
        }
        this.combatSystem.meleeAttack(enemy, player);
        if (!player.isAlive) return;
      } else if (!didMove && enemy.behavior === 'ranged' && canSeePlayer && enemy.isAlive) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (dist >= 2 && dist <= 5) {
          this.combatSystem.rangedAttack(enemy, player);
          if (!player.isAlive) return;
        }
      }
    }
  }

  private handleEnemyDeath(enemy: Enemy) {
    this.state.kills++;
    const color = enemy.textureKey === 'enemy_boss' ? 0xffd700 : 0xff4444;
    this.renderSystem.spawnParticles(enemy.x, enemy.y, color, 8);
    sound.play('enemy_death');
    this.state.messageLog.add(`${enemy.name} foi neutralizado.`);

    if (enemy.behavior === 'splitter') {
      this.floorGenerator.spawnFragments(enemy.x, enemy.y);
      this.renderSystem.syncEntitySprites();
    }

    if (enemy.textureKey === 'enemy_boss' && this.state.bossRoomIdx !== -1) {
      this.state.bossKilled = true;
      trackEvent('boss_kill', { floor: this.state.player.floor, level: this.state.player.level });
      this.actionSystem.showBossRewards();
    }

    if (enemy.textureKey === 'enemy_miniboss' && this.state.minibossRoomIdx !== -1) {
      this.state.chests.set(`${enemy.x},${enemy.y}`, false);
      this.renderSystem.markDirty(enemy.x, enemy.y);
      this.state.messageLog.add('Um baú de tesouro aparece!');
    }

    const leveled = this.state.player.addXp(enemy.xpValue);
    if (leveled) {
      sound.play('level_up');
      this.state.messageLog.add(`*** SISTEMA ATUALIZADO para v${this.state.player.level} ***`);
      trackEvent('level_up', { new_level: this.state.player.level, floor: this.state.player.floor, kills: this.state.kills });
      this.actionSystem.showRewardChoices('level');
    }
  }

  generateFloor(forceNewPlayer: boolean = false, startFloor: number = 0) {
    this.tempMoveCooldown = 0;
    this.renderSystem.destroyAll();
    this.floorGenerator.generateFloor(forceNewPlayer, startFloor);
    this.renderSystem.createRenderObjects(this.state.player.classDef.textureKey);
    this.renderSystem.createEnemySprites();
    this.projectileSystem.rebuildEnemyGrid();
    this.combatSystem.rebuildEnemyMap();
    this.renderSystem.markAllDirty();
    this.renderSystem.redrawMap();
    this.renderSystem.syncEntitySprites();
    this.renderSystem.centerOnPlayer();

    if (this.state.player.floor > 1) {
      sound.play('stairs_down');
      this.state.messageLog.add(`--- /system/dir_${this.state.player.floor} ---`);
      if (this.state.player.floor % 5 === 0) {
        sound.play('boss_appear');
        this.state.messageLog.add('*** ALERTA: ROOTKIT DETECTADO ***');
      }
      trackEvent('floor_reach', { floor: this.state.player.floor, level: this.state.player.level });
    } else {
      this.state.messageLog.add(`SYSTEM PURGE v${version} — Kernel inicializado.`);
    }

    this.isAnimating = false;
  }

  private applyMetaUpgrades() {
    const meta = loadMeta();
    for (const def of META_UPGRADES) {
      const lvl = meta.upgrades[def.id] ?? 0;
      if (lvl > 0) def.apply(this.state.player, lvl);
    }
  }

  private fullRestart() {
    this.tempMoveCooldown = 0;
    this.isAnimating = false;
    this.state.enemyBleeds.clear();
    this.state.kills = 0;
    this.state.chests.clear();
    this.state.altarUsed = false;
    this.state.bossKilled = false;
    this.generateFloor(true);
    this.applyMetaUpgrades();
    this.loadActiveAbilities();
  }

  private loadActiveAbilities() {
    const meta = loadMeta();
    if (!meta.activeAbilities) return;
    const p = this.state.player;
    const originalClass = CLASSES.find(c => c.id === this.classId)!;
    p.classDef = { ...originalClass, abilities: [...originalClass.abilities] };
    p.cooldowns = p.classDef.abilities.map(() => 0);
    const list = this.classId === 'daemon'
      ? meta.activeAbilities.slice(0, 1)
      : meta.activeAbilities;
    for (const abilId of list) {
      const purchAbil = PURCHASABLE_ABILITIES.find(a => a.id === abilId);
      if (purchAbil) {
        p.classDef.abilities.push(purchAbil);
        p.cooldowns.push(0);
      }
    }
  }

  private hudVersion = 0;

  private syncStaticRegistry() {
    const p = this.state.player!;
    const R = RegistryKeys;
    this.registry.set(R.name, p.name);
    this.registry.set(R.baseFov, p.classDef.fov);
    this.registry.set(R.baseMoveSpeed, p.classDef.moveSpeed);
    this.registry.set(R.upgrades, p.acquiredUpgrades);
    this.registry.set(R.inventory, p.inventory);
    this.registry.set(R.unlockedSlots, p.unlockedSlots);
    this.registry.set(R.classId, this.classId);
    this.registry.set(R.abilities, p.classDef.abilities);
  }

  private syncRegistry() {
    const p = this.state.player!;
    const R = RegistryKeys;
    this.registry.set(R.hp, p.hp);
    this.registry.set(R.maxHp, p.maxHp);
    this.registry.set(R.level, p.level);
    this.registry.set(R.floor, p.floor);
    this.registry.set(R.attack, p.attack);
    this.registry.set(R.defense, p.defense);
    this.registry.set(R.xp, p.xp);
    this.registry.set(R.xpNext, p.xpToNext);
    this.registry.set(R.kills, this.state.kills);
    this.registry.set(R.bleedTicks, p.bleedTicks);
    this.registry.set(R.defenseBuff, p.defenseBuffCharges);
    this.registry.set(R.tempAtkBonus, p.tempAtkBonus);
    this.registry.set(R.tempDefBonus, p.tempDefBonus);
    this.registry.set(R.bonusFov, p.bonusFov);
    this.registry.set(R.hasFatalGuard, p.hasFatalGuard);
    this.registry.set(R.cooldownReduction, p.cooldownReduction);
    this.registry.set(R.currentMoveSpeed, p.moveSpeed);
    this.registry.set(R.cooldowns, p.cooldowns);
    const msgs = this.state.messageLog?.getLast(10) ?? [];
    this.registry.set(R.messages, msgs);
    this.hudVersion++;
    this.registry.set(R.hud, this.hudVersion);
  }
}
