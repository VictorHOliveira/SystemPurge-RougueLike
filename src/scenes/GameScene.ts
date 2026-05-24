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
import { MAP_W, MAP_H, TILE, MOVE_COOLDOWN_BASE, TWEEN_DURATION_BASE, isAdjacent, parseChestKey } from '../constants';
import { InputHandler } from './GameInput';
import { RegistryKeys } from '../RegistryKeys';
import { META_UPGRADES } from '../data/metaUpgrades';
import { loadMeta } from '../utils/metaSave';
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
    this.syncRegistry();
    this.registry.set(RegistryKeys.hud, (this.registry.get(RegistryKeys.hud) as number ?? 0) + 1);
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
    this.combatSystem = new CombatSystem(this, this.state, {
      onEnemyDeath: (enemy) => this.handleEnemyDeath(enemy),
      spawnParticles: (x, y, tint, c) => this.renderSystem.spawnParticles(x, y, tint, c),
    });
    this.projectileSystem = new ProjectileSystem(this, this.state, {
      meleeAttack: (a, d, p) => this.combatSystem.meleeAttack(a, d, p),
      onAnimationStart: () => { this.isAnimating = true; },
      onAnimationEnd: () => { this.isAnimating = false; this.endTurn(); },
    });
    this.actionSystem = new ActionSystem(this, this.state, {
      meleeAttack: (a, d, p) => this.combatSystem.meleeAttack(a, d, p),
      spawnParticles: (x, y, tint, c) => this.renderSystem.spawnParticles(x, y, tint, c),
      onEnemyDeath: (enemy) => this.handleEnemyDeath(enemy),
      getDirEnemy: (dx, dy) => this.projectileSystem.getDirEnemy(dx, dy),
      onAnimationStart: () => { this.isAnimating = true; },
      onAnimationEnd: () => { this.isAnimating = false; },
      endTurn: () => this.endTurn(),
    });
    this.floorGenerator = new FloorGenerator(this, this.state);

    this.cameras.main.setViewport(0, 0, 640, 640);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);

    this.generateFloor();
    this.applyMetaUpgrades();
    this.loadActiveAbilities();
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

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y);
    this.renderSystem.syncVisibility();

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

    this.registry.set(RegistryKeys.hud, (this.registry.get(RegistryKeys.hud) as number ?? 0) + 1);
  }

  private handlePlayerDeath() {
    sound.play('player_death');
    this.renderSystem.spawnParticles(this.state.player.x, this.state.player.y, 0xff4444, 12);
    this.state.messageLog.add('*** SISTEMA FALHOU ***');
    trackEvent('player_death', { floor: this.state.player.floor, level: this.state.player.level, kills: this.state.kills });
    this.syncRegistry();
    this.renderSystem.syncEntitySprites();
    this.registry.set(RegistryKeys.hud, (this.registry.get(RegistryKeys.hud) as number ?? 0) + 1);
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

  private enemyCanSeePlayer(enemy: Enemy): boolean {
    if (this.state.map.visible[enemy.y]?.[enemy.x]) return true;
    const dx = Math.abs(this.state.player.x - enemy.x);
    const dy = Math.abs(this.state.player.y - enemy.y);
    if (Math.max(dx, dy) <= 2) return true;
    return false;
  }

  private processEnemyAI() {
    if (!this.state.player.isAlive) return;

    this.combatSystem.processEnemyBleeds();

    this.occGrid.fill(0);
    for (const e of this.state.enemies) {
      if (e.isAlive) this.occGrid[e.y * MAP_W + e.x] = 1;
    }
    for (const [key, opened] of this.state.chests) {
      if (!opened) {
        const [cx, cy] = parseChestKey(key);
        this.occGrid[cy * MAP_W + cx] = 1;
      }
    }

    for (const enemy of this.state.enemies) {
      if (!enemy.isAlive) continue;
      if (!this.state.player.isAlive) break;
      if (isAdjacent(this.state.player.x, this.state.player.y, enemy.x, enemy.y)) {
        if (enemy.behavior === 'suicide') {
          this.combatSystem.suicideExplosion(enemy, this.state.player);
          if (!this.state.player.isAlive) return;
          this.handleEnemyDeath(enemy);
          continue;
        }
        this.combatSystem.meleeAttack(enemy, this.state.player);
        if (!this.state.player.isAlive) return;
        continue;
      }

      const canSeePlayer = this.enemyCanSeePlayer(enemy);

      enemy.takeTurn(
        this.state.player.x,
        this.state.player.y,
        canSeePlayer,
        (x, y) => this.state.map.isWalkable(x, y),
        (x, y) => {
          if (this.state.player.x === x && this.state.player.y === y && this.state.player.isAlive) return true;
          if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H && this.occGrid[y * MAP_W + x]) return true;
          return false;
        },
      );

      if (isAdjacent(this.state.player.x, this.state.player.y, enemy.x, enemy.y)) {
        if (enemy.behavior === 'suicide') {
          this.combatSystem.suicideExplosion(enemy, this.state.player);
          if (!this.state.player.isAlive) return;
          this.handleEnemyDeath(enemy);
          continue;
        }
        this.combatSystem.meleeAttack(enemy, this.state.player);
        if (!this.state.player.isAlive) return;
      } else if (enemy.behavior === 'ranged' && canSeePlayer && enemy.isAlive) {
        const dx = this.state.player.x - enemy.x;
        const dy = this.state.player.y - enemy.y;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (dist >= 2 && dist <= 5) {
          this.combatSystem.rangedAttack(enemy, this.state.player);
          if (!this.state.player.isAlive) return;
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

  generateFloor(forceNewPlayer: boolean = false) {
    this.tempMoveCooldown = 0;
    this.renderSystem.destroyAll();
    this.floorGenerator.generateFloor(forceNewPlayer);
    this.renderSystem.createRenderObjects(this.state.player.classDef.textureKey);
    this.renderSystem.createEnemySprites();
    this.projectileSystem.rebuildEnemyGrid();
    this.combatSystem.rebuildEnemyMap();
    this.renderSystem.redrawMap();
    this.renderSystem.syncVisibility();
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
    this.registry.set(R.name, p.name);
    this.registry.set(R.kills, this.state.kills);
    this.registry.set(R.bleedTicks, p.bleedTicks);
    this.registry.set(R.defenseBuff, p.defenseBuffRemaining);
    this.registry.set(R.tempAtkBonus, p.tempAtkBonus);
    this.registry.set(R.tempDefBonus, p.tempDefBonus);
    this.registry.set(R.bonusFov, p.bonusFov);
    this.registry.set(R.cooldownReduction, p.cooldownReduction);
    this.registry.set(R.baseFov, p.classDef.fov);
    this.registry.set(R.baseMoveSpeed, p.classDef.moveSpeed);
    this.registry.set(R.currentMoveSpeed, p.moveSpeed);
    const msgs = this.state.messageLog?.getLast(10) ?? [];
    this.registry.set(R.messages, msgs);
    this.registry.set(R.upgrades, p.acquiredUpgrades);
    this.registry.set(R.inventory, p.inventory);
    this.registry.set(R.unlockedSlots, p.unlockedSlots);
    this.registry.set(R.classId, this.classId);
    this.registry.set(R.cooldowns, p.cooldowns);
    this.registry.set(R.abilities, p.classDef.abilities);
    this.registry.set(R.hud, (this.registry.get(R.hud) as number ?? 0) + 1);
  }
}
