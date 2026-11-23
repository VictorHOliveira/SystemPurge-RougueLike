import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { FOVSystem } from '../systems/FOV';
import { RenderSystem } from '../systems/RenderSystem';
import { CombatSystem } from '../systems/CombatSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { ActionSystem } from '../systems/ActionSystem';
import { FloorGenerator } from '../systems/FloorGenerator';
import { GameState } from '../systems/GameState';
import { TurnSystem } from '../systems/TurnSystem';
import { MessageLog } from '../ui/MessageLog';
import { GameMap } from '../world/GameMap';
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
import { CLASSES, getClassById } from '../data/classes';
import { saveRun, saveCheckpoint, loadRunSave, loadCheckpoint, deleteRunSave, deleteCheckpoint, restorePlayerFromSave, restoreMapFromSave, restoreEnemyBleeds, restoreChests } from '../utils/runSave';
import type { EnemyTemplate } from '../data/enemies';
import { bgm } from '../audio/BGMPlayer';
import { COLORS } from '../theme';
import { showToast } from '../ui/Toast';

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
  shootCooldown = 0;

  classId: string = 'limpador';

  private occGrid: Uint8Array = new Uint8Array(MAP_H * MAP_W);
  private occGridDirty: number[] = [];

  init(data?: { classId?: string; loadFromSave?: boolean }) {
    if (data?.classId) this.classId = data.classId;
    if (data?.loadFromSave) this.data.set('loadFromSave', true);
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
      bossSeen: false,
      classId: this.classId,
      enemyBleeds: new Map(),
    };

    this.renderSystem = new RenderSystem(this, this.state);
    this.projectileSystem = new ProjectileSystem(this, this.state, {
      meleeAttack: (a, d, p, m) => this.combatSystem.meleeAttack(a, d, p, m),
      onAnimationStart: () => { this.isAnimating = true; },
      onAnimationEnd: () => { this.isAnimating = false; this.endTurn(); },
    });
    this.combatSystem = new CombatSystem(this, this.state, {
      onEnemyDeath: (enemy) => this.handleEnemyDeath(enemy),
      spawnParticles: (x, y, tint, c) => this.renderSystem.spawnParticles(x, y, tint, c),
      spawnFx: (x, y, key, size, duration) => this.renderSystem.spawnFx(x, y, key, size, duration),
      spawnEnemyProjectile: (fx, fy, tx, ty) => this.renderSystem.spawnEnemyProjectile(fx, fy, tx, ty),
      onPlayerDamaged: () => this.renderSystem.flashDamage(),
      enemyAt: (x, y) => this.projectileSystem.enemyAt(x, y),
    });
    this.actionSystem = new ActionSystem(this, this.state, {
      meleeAttack: (a, d, p, m) => this.combatSystem.meleeAttack(a, d, p, m),
      spawnParticles: (x, y, tint, c) => this.renderSystem.spawnParticles(x, y, tint, c),
      spawnFx: (x, y, key, size, duration) => this.renderSystem.spawnFx(x, y, key, size, duration),
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

    if (this.data.get('loadFromSave')) {
      if (!this.loadFromSave()) {
        this.generateFloor(true);
      }
    } else {
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
    }

    bgm.play('game');

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
    if (this.shootCooldown > 0) this.shootCooldown -= delta;
    if (!this.state.player) return;
    if (this.isAnimating) return;
    this.inputHandler.handleMovement(delta);
  }

  endTurn() {
    this.syncRegistry();
    this.state.turnSystem.endPlayerTurn();

    this.combatSystem.processClassPressure();

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y, (x, y) => this.renderSystem.onTileVisibilityChange(x, y));
    this.markBossVisibleIfInSight(true);

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
    this.rebuildSpatial();

    this.state.turnSystem.reset();

    this.state.player.processTurnEnd();

    this.renderSystem.redrawMap();
    this.renderSystem.syncEntitySprites();
    this.renderSystem.centerOnPlayer();
  }

  private markBossVisibleIfInSight(announce: boolean) {
    if (this.state.bossSeen) return;
    const boss = this.state.enemies.find(e => e.isAlive && e.textureKey === 'enemy_boss');
    if (!boss || !this.state.map.visible[boss.y]?.[boss.x]) return;
    this.state.bossSeen = true;
    if (announce) {
      sound.play('boss_appear');
      this.state.messageLog.add('*** ROOTKIT À VISTA ***');
      showToast(this, {
        title: 'ROOTKIT À VISTA',
        detail: `Chefe detectado no /system/${this.state.player.floor}`,
        color: COLORS.error,
      });
    }
    this.syncRegistry();
  }

  private handlePlayerDeath() {
    bgm.stop();
    sound.play('player_death');
    this.renderSystem.spawnParticles(this.state.player.x, this.state.player.y, 0xff4444, 12);
    this.renderSystem.spawnFx(this.state.player.x, this.state.player.y, 'fx_explosion', 64, 500);
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
      checkpointFloor: loadCheckpoint()?.player.floor ?? 0,
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

  private rebuildSpatial() {
    for (let i = 0; i < this.occGridDirty.length; i++) {
      this.occGrid[this.occGridDirty[i]] = 0;
    }
    this.occGridDirty.length = 0;
    this.projectileSystem.clearEnemyGrid();
    this.combatSystem.clearEnemyMap();
    const { enemies, chests } = this.state;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.isAlive) continue;
      const pos = e.y * MAP_W + e.x;
      this.occGrid[pos] = 1;
      this.occGridDirty.push(pos);
      this.projectileSystem.setEnemy(e);
      this.combatSystem.addEnemy(e);
    }
    for (const [key, opened] of chests) {
      if (opened) continue;
      const idx = key.indexOf(',');
      const cx = parseInt(key.substring(0, idx), 10);
      const cy = parseInt(key.substring(idx + 1), 10);
      const pos = cy * MAP_W + cx;
      this.occGrid[pos] = 1;
      this.occGridDirty.push(pos);
    }
  }

  private processEnemyAI() {
    if (!this.state.player.isAlive) return;

    this.combatSystem.processEnemyBleeds();

    this.rebuildSpatial();

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
        if (dist >= 2 && dist <= enemy.rangedRange) {
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
    this.renderSystem.spawnFx(enemy.x, enemy.y, 'fx_explosion', enemy.textureKey === 'enemy_boss' ? 64 : 48, 400);
    sound.play('enemy_death');
    this.state.messageLog.add(`${enemy.name} foi neutralizado.`);

    if (enemy.behavior === 'splitter') {
      this.floorGenerator.spawnFragments(enemy.x, enemy.y);
      this.renderSystem.syncEntitySprites();
    }

    if (enemy.textureKey === 'enemy_boss' && this.state.bossRoomIdx !== -1) {
      this.state.bossKilled = true;
      this.state.map.setTile(enemy.x, enemy.y, TileType.STAIRS_DOWN);
      this.renderSystem.markDirty(enemy.x, enemy.y);
      this.state.messageLog.add('*** ACESSO AO PRÓXIMO DIRETÓRIO LIBERADO ***');
      showToast(this, {
        title: 'ACESSO LIBERADO',
        detail: 'A escada surgiu onde o rootkit caiu',
        color: COLORS.accent,
      });
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
      this.renderSystem.spawnFx(this.state.player.x, this.state.player.y, 'fx_levelup', 48, 600);
      this.state.messageLog.add(`*** SISTEMA ATUALIZADO para v${this.state.player.level} ***`);
      showToast(this, {
        title: `NÍVEL ${this.state.player.level}`,
        detail: 'Recompensa por subir de nível',
        color: COLORS.warning,
      });
      trackEvent('level_up', { new_level: this.state.player.level, floor: this.state.player.floor, kills: this.state.kills });
      this.actionSystem.showRewardChoices('level');
    }
  }

  private loadFromSave(): boolean {
    const data = loadRunSave();
    if (!data || data.version !== version) {
      deleteRunSave();
      return false;
    }

    this.renderSystem.destroyAll();

    Enemy.resetId();

    const map = new GameMap(MAP_W, MAP_H);
    restoreMapFromSave(data, map);

    this.state.map = map;
    this.state.kills = data.game.kills;
    this.state.chests = restoreChests(data);
    this.state.bossRoomIdx = data.game.bossRoomIdx;
    this.state.minibossRoomIdx = data.game.minibossRoomIdx;
    this.state.altarRoomIdx = data.game.altarRoomIdx;
    this.state.altarUsed = data.game.altarUsed;
    this.state.bossKilled = data.game.bossKilled;
    this.state.bossSeen = data.game.bossSeen ?? false;
    this.state.classId = data.player.classId;
    this.classId = data.player.classId;

    const classDef = getClassById(data.player.classId);
    const p = new Player(classDef, data.player.x, data.player.y);
    restorePlayerFromSave(data, p);
    this.state.player = p;

    this.state.enemies = [];
    for (const eData of data.enemies) {
      const template: EnemyTemplate = {
        name: eData.name,
        hp: eData.maxHp,
        attack: eData.attack,
        defense: eData.defense,
        color: 0xffffff,
        textureKey: eData.textureKey,
        behavior: eData.behavior,
        minFloor: 1,
        splitOnDeath: eData.splitOnDeath,
        rangedRange: eData.rangedRange,
        fleeDistance: eData.fleeDistance,
      };
      const e = new Enemy(template, eData.x, eData.y);
      e.hp = eData.hp;
      e.maxHp = eData.maxHp;
      e.isElite = eData.isElite;
      e.skipNextTurn = eData.skipNextTurn;
      e.xpValue = eData.xpValue;
      this.state.enemies.push(e);
    }

    this.state.fov = new FOVSystem(p.effectiveFov);
    this.state.turnSystem = new TurnSystem();
    this.state.messageLog = new MessageLog();
    for (const msg of data.game.messages) {
      this.state.messageLog.messages.push(msg);
    }

    this.state.enemyBleeds = restoreEnemyBleeds(data, this.state.enemies);

    this.renderSystem.createRenderObjects(p.classDef.textureKey);
    this.renderSystem.createEnemySprites();
    this.renderSystem.setBossFloorTheme(this.state.bossRoomIdx !== -1);

    this.state.fov.compute(this.state.map, p.x, p.y, (x, y) => this.renderSystem.onTileVisibilityChange(x, y));

    this.loadActiveAbilities();

    for (let i = 0; i < Math.min(data.player.cooldowns.length, p.cooldowns.length); i++) {
      p.cooldowns[i] = data.player.cooldowns[i];
    }

    this.projectileSystem.syncClassMode();
    this.rebuildSpatial();
    this.renderSystem.markAllDirty();
    this.renderSystem.redrawMap();
    this.renderSystem.syncEntitySprites();
    this.renderSystem.centerOnPlayer();

    this.isAnimating = false;
    return true;
  }

  generateFloor(forceNewPlayer: boolean = false, startFloor: number = 0) {
    this.tempMoveCooldown = 0;
    this.shootCooldown = 0;
    this.renderSystem.destroyAll();
    this.floorGenerator.generateFloor(forceNewPlayer, startFloor);
    this.renderSystem.createRenderObjects(this.state.player.classDef.textureKey);
    this.renderSystem.createEnemySprites();
    this.renderSystem.setBossFloorTheme(this.state.bossRoomIdx !== -1);
    this.projectileSystem.syncClassMode();
    this.rebuildSpatial();
    this.renderSystem.markAllDirty();
    this.renderSystem.redrawMap();
    this.renderSystem.syncEntitySprites();
    this.renderSystem.centerOnPlayer();
    this.markBossVisibleIfInSight(false);

    if (this.state.player.floor > 1) {
      sound.play('stairs_down');
      this.state.messageLog.add(`--- /system/dir_${this.state.player.floor} ---`);
      const isBossFloor = this.state.bossRoomIdx !== -1;
      if (isBossFloor) {
        sound.play('boss_appear');
        this.state.messageLog.add('*** ALERTA: ROOTKIT DETECTADO ***');
        bgm.play('boss');
      }
      showToast(this, {
        title: `ANDAR ${this.state.player.floor}`,
        detail: isBossFloor ? 'ROOTKIT DETECTADO' : 'Novo diretório carregado',
        color: isBossFloor ? COLORS.error : COLORS.subtitle,
      });
      trackEvent('floor_reach', { floor: this.state.player.floor, level: this.state.player.level });
    } else {
      this.state.messageLog.add(`SYSTEM PURGE v${version} — Kernel inicializado.`);
    }

    saveRun(this.state);
    if (this.state.player.floor % 5 === 0) {
      saveCheckpoint(this.state);
      showToast(this, {
        title: `CHECKPOINT ${this.state.player.floor}`,
        detail: 'Progresso salvo neste diretório',
        color: COLORS.accent,
      });
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
    deleteCheckpoint();
    this.tempMoveCooldown = 0;
    this.shootCooldown = 0;
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

  private setIfChanged<T>(key: string, value: T): void {
    const prev = this.registry.get(key) as T;
    if (prev === value) return;
    if (Array.isArray(prev) && Array.isArray(value)) {
      if (prev.length === value.length) {
        let same = true;
        for (let i = 0; i < prev.length; i++) {
          if (prev[i] !== value[i]) { same = false; break; }
        }
        if (same) return;
      }
    }
    this.registry.set(key, value);
  }

  private syncStaticRegistry() {
    const p = this.state.player!;
    const R = RegistryKeys;
    this.setIfChanged(R.name, p.name);
    this.setIfChanged(R.baseFov, p.classDef.fov);
    this.setIfChanged(R.baseMoveSpeed, p.classDef.moveSpeed);
    this.setIfChanged(R.upgrades, p.acquiredUpgrades);
    this.setIfChanged(R.inventory, p.inventory);
    this.setIfChanged(R.unlockedSlots, p.unlockedSlots);
    this.setIfChanged(R.classId, this.classId);
    this.setIfChanged(R.abilities, p.classDef.abilities);
  }

  private syncRegistry() {
    const p = this.state.player!;
    const R = RegistryKeys;
    this.setIfChanged(R.hp, p.hp);
    this.setIfChanged(R.maxHp, p.maxHp);
    this.setIfChanged(R.level, p.level);
    this.setIfChanged(R.floor, p.floor);
    this.setIfChanged(R.attack, p.attack);
    this.setIfChanged(R.defense, p.defense);
    this.setIfChanged(R.xp, p.xp);
    this.setIfChanged(R.xpNext, p.xpToNext);
    this.setIfChanged(R.kills, this.state.kills);
    this.setIfChanged(R.bleedTicks, p.bleedTicks);
    this.setIfChanged(R.defenseBuff, p.defenseBuffCharges);
    this.setIfChanged(R.tempAtkBonus, p.tempAtkBonus);
    this.setIfChanged(R.tempAtkMultiplier, p.tempAtkMultiplier);
    this.setIfChanged(R.tempAtkCharges, p.tempAtkCharges);
    this.setIfChanged(R.tempDefBonus, p.tempDefBonus);
    this.setIfChanged(R.shieldCharges, p.shieldCharges);
    this.setIfChanged(R.bonusFov, p.bonusFov);
    this.setIfChanged(R.hasFatalGuard, p.hasFatalGuard);
    this.setIfChanged(R.hasDodge, p.hasDodge);
    this.setIfChanged(R.hasRegen, p.hasRegen);
    this.setIfChanged(R.reflectBuff, p.reflectBuffCharges);
    this.setIfChanged(R.cooldownReduction, p.cooldownReduction);
    this.setIfChanged(R.currentMoveSpeed, p.moveSpeed);
    this.setIfChanged(R.cooldowns, p.cooldowns);
    const boss = this.state.enemies.find(e => e.isAlive && e.textureKey === 'enemy_boss');
    this.setIfChanged(R.bossAlive, !!boss);
    this.setIfChanged(R.bossVisible, !!(boss && this.state.map.visible[boss.y]?.[boss.x]));
    const msgs = this.state.messageLog?.getLast(10) ?? [];
    this.setIfChanged(R.messages, msgs);
    this.hudVersion++;
    this.setIfChanged(R.hud, this.hudVersion);
  }
}
