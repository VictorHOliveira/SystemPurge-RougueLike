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
import { rollUpgrades } from '../data/upgrades';
import { trackEvent } from '../analytics';
import { sound } from '../audio/SoundManager';
import { MAP_W, MAP_H, TILE, MOVE_COOLDOWN_BASE, TWEEN_DURATION_BASE, isAdjacent } from '../constants';

export class GameScene extends Phaser.Scene {
  state!: GameState;
  renderSystem!: RenderSystem;
  combatSystem!: CombatSystem;
  projectileSystem!: ProjectileSystem;
  actionSystem!: ActionSystem;
  floorGenerator!: FloorGenerator;

  private isAnimating = false;
  private moveCooldown = 0;
  private arrowUp!: Phaser.Input.Keyboard.Key;
  private arrowDown!: Phaser.Input.Keyboard.Key;
  private arrowLeft!: Phaser.Input.Keyboard.Key;
  private arrowRight!: Phaser.Input.Keyboard.Key;

  private classId: string = 'limpador';

  private occGrid: Uint8Array = new Uint8Array(MAP_H * MAP_W);

  private lastHp = -1; private lastMaxHp = -1; private lastLevel = -1;
  private lastFloor = -1; private lastAtk = -1; private lastDef = -1;
  private lastXp = -1; private lastXpNext = -1; private lastName = '';
  private lastKills = -1; private lastBleedTicks = -1;
  private lastDefBuff = -1; private lastTempAtk = -1; private lastTempDef = -1;
  private lastBonusFov = -1; private lastCDR = -1; private lastBaseFov = -1;
  private lastBaseMs = -1; private lastCurMs = -1;
  private lastUpgrades = ''; private lastInventory = ''; private lastCooldowns = '';
  private lastMessages: string[] = [];

  init(data?: { classId?: string }) {
    if (data?.classId) this.classId = data.classId;
  }

  constructor() {
    super('Game');
  }

  private globalRestart = (e: KeyboardEvent) => {
    if ((e.key === 'r' || e.key === 'R') && this.state?.player && !this.state.player.isAlive) {
      window.location.reload();
    }
  };

  private onResume = () => {
    if (this.registry.get('restartPending')) {
      this.registry.set('restartPending', false);
      this.fullRestart();
    }
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
      trapRoomIdx: -1,
      altarRoomIdx: -1,
      altarUsed: false,
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

    const arrows = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT') as {
      UP: Phaser.Input.Keyboard.Key;
      DOWN: Phaser.Input.Keyboard.Key;
      LEFT: Phaser.Input.Keyboard.Key;
      RIGHT: Phaser.Input.Keyboard.Key;
    };
    this.arrowUp = arrows.UP;
    this.arrowDown = arrows.DOWN;
    this.arrowLeft = arrows.LEFT;
    this.arrowRight = arrows.RIGHT;
    this.input.keyboard!.on('keydown', this.handleInput, this);
    window.addEventListener('keydown', this.globalRestart);
    this.events.on('resume', this.onResume, this);
    this.events.on('shutdown', () => {
      this.renderSystem?.destroyAll();
      this.input?.keyboard?.off('keydown', this.handleInput, this);
      window.removeEventListener('keydown', this.globalRestart);
      this.events.off('resume', this.onResume, this);
    });

    this.scene.launch('HUD');
  }

  update(_time: number, delta: number) {
    if (!this.state.player) return;

    const p = this.state.player;
    if (p.hp !== this.lastHp) { this.lastHp = p.hp; this.registry.set('hp', p.hp); }
    if (p.maxHp !== this.lastMaxHp) { this.lastMaxHp = p.maxHp; this.registry.set('maxHp', p.maxHp); }
    if (p.level !== this.lastLevel) { this.lastLevel = p.level; this.registry.set('level', p.level); }
    if (p.floor !== this.lastFloor) { this.lastFloor = p.floor; this.registry.set('floor', p.floor); }
    if (p.attack !== this.lastAtk) { this.lastAtk = p.attack; this.registry.set('attack', p.attack); }
    if (p.defense !== this.lastDef) { this.lastDef = p.defense; this.registry.set('defense', p.defense); }
    if (p.xp !== this.lastXp) { this.lastXp = p.xp; this.registry.set('xp', p.xp); }
    if (p.xpToNext !== this.lastXpNext) { this.lastXpNext = p.xpToNext; this.registry.set('xpNext', p.xpToNext); }
    if (p.name !== this.lastName) { this.lastName = p.name; this.registry.set('name', p.name); }
    if (this.state.kills !== this.lastKills) { this.lastKills = this.state.kills; this.registry.set('kills', this.state.kills); }
    if (p.bleedTicks !== this.lastBleedTicks) { this.lastBleedTicks = p.bleedTicks; this.registry.set('bleedTicks', p.bleedTicks); }
    if (p.defenseBuffRemaining !== this.lastDefBuff) { this.lastDefBuff = p.defenseBuffRemaining; this.registry.set('defenseBuff', p.defenseBuffRemaining); }
    if (p.tempAtkBonus !== this.lastTempAtk) { this.lastTempAtk = p.tempAtkBonus; this.registry.set('tempAtkBonus', p.tempAtkBonus); }
    if (p.tempDefBonus !== this.lastTempDef) { this.lastTempDef = p.tempDefBonus; this.registry.set('tempDefBonus', p.tempDefBonus); }
    if (p.bonusFov !== this.lastBonusFov) { this.lastBonusFov = p.bonusFov; this.registry.set('bonusFov', p.bonusFov); }
    if (p.cooldownReduction !== this.lastCDR) { this.lastCDR = p.cooldownReduction; this.registry.set('cooldownReduction', p.cooldownReduction); }
    if (p.classDef.fov !== this.lastBaseFov) { this.lastBaseFov = p.classDef.fov; this.registry.set('baseFov', p.classDef.fov); }
    if (p.classDef.moveSpeed !== this.lastBaseMs) { this.lastBaseMs = p.classDef.moveSpeed; this.registry.set('baseMoveSpeed', p.classDef.moveSpeed); }
    if (p.moveSpeed !== this.lastCurMs) { this.lastCurMs = p.moveSpeed; this.registry.set('currentMoveSpeed', p.moveSpeed); }
    const msgs = this.state.messageLog?.getLast(10) ?? [];
    if (msgs !== this.lastMessages) { this.lastMessages = msgs; this.registry.set('messages', msgs); }
    const upgStr = [...p.acquiredUpgrades.entries()].map(e => `${e[0]}:${e[1]}`).join(',');
    if (upgStr !== this.lastUpgrades) { this.lastUpgrades = upgStr; this.registry.set('upgrades', p.acquiredUpgrades); }
    const invStr = p.inventory.join(',');
    if (invStr !== this.lastInventory) { this.lastInventory = invStr; this.registry.set('inventory', p.inventory); }
    if (this.classId !== this.registry.get('classId')) { this.registry.set('classId', this.classId); }
    const cdStr = p.cooldowns.join(',');
    if (cdStr !== this.lastCooldowns) { this.lastCooldowns = cdStr; this.registry.set('cooldowns', p.cooldowns); }
    this.registry.set('abilities', p.classDef.abilities);

    if (this.isAnimating) return;
    if (!this.state.turnSystem?.isPlayerTurn) return;
    if (!this.state.player.isAlive) return;

    let dx = 0;
    let dy = 0;
    if (this.arrowUp.isDown) dy -= 1;
    if (this.arrowDown.isDown) dy += 1;
    if (this.arrowLeft.isDown) dx -= 1;
    if (this.arrowRight.isDown) dx += 1;

    if (dx === 0 && dy === 0) {
      this.moveCooldown = 0;
      return;
    }

    this.moveCooldown -= delta;
    if (this.moveCooldown > 0) return;

    this.processMove(Math.sign(dx), Math.sign(dy));
    this.moveCooldown = Math.max(40, Math.round(MOVE_COOLDOWN_BASE / this.state.player.effectiveMoveSpeed));
  }

  private handleInput = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.scene.pause();
      this.scene.pause('HUD');
      this.scene.launch('Pause');
      return;
    }

    if (!this.state.player.isAlive) {
      if (e.key === 'r' || e.key === 'R') window.location.reload();
      return;
    }

    if (e.key === '.' || e.key === ' ') {
      if (this.isAnimating) return;
      if (!this.state.turnSystem?.isPlayerTurn) return;
      e.preventDefault();
      this.endTurn();
    }

    if (e.key === 'q' || e.key === 'Q') {
      if (this.isAnimating) return;
      if (!this.state.turnSystem?.isPlayerTurn) return;
      this.actionSystem.useAbility(0);
    }
    if (e.key === 'e' || e.key === 'E') {
      if (this.isAnimating) return;
      if (!this.state.turnSystem?.isPlayerTurn) return;
      this.actionSystem.useAbility(1);
    }

    if (this.state.player.classDef.canShoot) {
      if (e.key === 'w' || e.key === 'W') {
        if (this.isAnimating) return;
        if (!this.state.turnSystem?.isPlayerTurn) return;
        this.projectileSystem.fireProjectile(0, -1);
      }
      if (e.key === 's' || e.key === 'S') {
        if (this.isAnimating) return;
        if (!this.state.turnSystem?.isPlayerTurn) return;
        this.projectileSystem.fireProjectile(0, 1);
      }
      if (e.key === 'a' || e.key === 'A') {
        if (this.isAnimating) return;
        if (!this.state.turnSystem?.isPlayerTurn) return;
        this.projectileSystem.fireProjectile(-1, 0);
      }
      if (e.key === 'd' || e.key === 'D') {
        if (this.isAnimating) return;
        if (!this.state.turnSystem?.isPlayerTurn) return;
        this.projectileSystem.fireProjectile(1, 0);
      }
    }

    if (e.key === '1') { this.actionSystem.useItem(0); return; }
    if (e.key === '2') { this.actionSystem.useItem(1); return; }
    if (e.key === '3') { this.actionSystem.useItem(2); return; }
  };

  private processMove(dx: number, dy: number) {
    if (!this.state.player.isAlive) return;
    const nx = this.state.player.x + dx;
    const ny = this.state.player.y + dy;

    const enemy = this.state.enemies.find(e2 => e2.x === nx && e2.y === ny && e2.isAlive);
    if (enemy) {
      this.combatSystem.meleeAttack(this.state.player, enemy);
      this.endTurn();
      return;
    }

    if (!this.state.map.isWalkable(nx, ny)) return;

    if (this.state.map.tiles[ny][nx] === TileType.STAIRS_DOWN) {
      if (this.state.enemies.some(e => e.isAlive && e.textureKey === 'enemy_boss')) {
        this.state.messageLog.add('*** ROOTKIT ativo — elimine-o primeiro ***');
        this.state.player.x = nx - dx;
        this.state.player.y = ny - dy;
        this.endTurn();
        return;
      }
      this.state.player.x = nx;
      this.state.player.y = ny;
      this.state.messageLog.add('Acessando próximo diretório...');
      this.generateFloor();
      return;
    }

    this.state.player.x = nx;
    this.state.player.y = ny;
    sound.play('player_move');

    if (this.state.map.tiles[ny][nx] === TileType.TRAP) {
      const dmg = Phaser.Math.Between(2, 4);
      this.state.player.takeDamage(dmg);
      this.renderSystem.spawnParticles(nx, ny, 0xff4444, 6);
      this.state.messageLog.add(`Armadilha de dados! -${dmg} HP`);
      this.state.map.setTile(nx, ny, TileType.FLOOR);
      this.renderSystem.markDirty(nx, ny);
      if (!this.state.player.isAlive) return;
    }

    if (this.state.map.tiles[ny][nx] === TileType.ALTAR && !this.state.altarUsed) {
      this.state.altarUsed = true;
      this.renderSystem.spawnParticles(nx, ny, 0xcc66ff, 8);
      const upgs = rollUpgrades(this.state.player.acquiredUpgrades, 1, this.classId);
      if (upgs.length > 0) {
        const upg = upgs[0];
        this.state.player.applyUpgrade(upg.id);
        this.state.messageLog.add(`Altar do Sistema concedeu ${upg.name}!`);
        this.state.fov.setRadius(this.state.player.effectiveFov);
        this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y);
      }
      this.state.map.setTile(nx, ny, TileType.FLOOR);
      this.renderSystem.markDirty(nx, ny);
    }

    this.actionSystem.openChest(nx, ny);

    const spr = this.renderSystem.entitySprites.get('player');
    if (spr) {
      this.isAnimating = true;
      this.tweens.add({
        targets: spr,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: Math.max(20, Math.round(TWEEN_DURATION_BASE / this.state.player.effectiveMoveSpeed)),
        ease: 'Linear',
        onComplete: () => {
          this.isAnimating = false;
          this.endTurn();
        },
      });
    } else {
      this.endTurn();
    }
  }

  private endTurn() {
    this.state.turnSystem.endPlayerTurn();

    this.combatSystem.processClassPressure();

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y);
    this.renderSystem.syncVisibility();

    this.combatSystem.processAdjacentAttacks();

    if (!this.state.player.isAlive) {
      sound.play('player_death');
      this.state.messageLog.add('*** SISTEMA FALHOU — Pressione R para reiniciar ***');
      trackEvent('player_death', { floor: this.state.player.floor, level: this.state.player.level, kills: this.state.kills });
      return;
    }

    this.processEnemyAI();
    this.projectileSystem.rebuildEnemyGrid();
    this.combatSystem.rebuildEnemyMap();

    this.state.turnSystem.reset();

    this.state.player.processTurnEnd();

    this.renderSystem.redrawMap();
    this.renderSystem.syncEntitySprites();
    this.renderSystem.centerOnPlayer();

    this.registry.set('_hud', (this.registry.get('_hud') as number ?? 0) + 1);
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
        const [cx, cy] = key.split(',').map(Number);
        this.occGrid[cy * MAP_W + cx] = 1;
      }
    }

    for (const enemy of this.state.enemies) {
      if (!enemy.isAlive) continue;
      if (!this.state.player.isAlive) break;
      if (isAdjacent(this.state.player.x, this.state.player.y, enemy.x, enemy.y)) continue;

      const canSeePlayer = this.state.map.visible[enemy.y]?.[enemy.x] ?? false;

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
        this.combatSystem.meleeAttack(enemy, this.state.player);
        if (!this.state.player.isAlive) {
          this.state.messageLog.add('*** SISTEMA FALHOU — Pressione R para reiniciar ***');
          trackEvent('player_death', { floor: this.state.player.floor, level: this.state.player.level, kills: this.state.kills });
          return;
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

    if (enemy.textureKey === 'enemy_boss' && this.state.bossRoomIdx !== -1) {
      trackEvent('boss_kill', { floor: this.state.player.floor, level: this.state.player.level });
      this.actionSystem.showBossRewards();
    }

    if (enemy.textureKey === 'enemy_miniboss' && this.state.minibossRoomIdx !== -1) {
      this.state.chests.set(`${enemy.x},${enemy.y}`, false);
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

  private generateFloor(forceNewPlayer: boolean = false) {
    this.moveCooldown = 0;
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
      this.state.messageLog.add('SYSTEM PURGE v0.1 — Kernel inicializado.');
    }

    this.isAnimating = false;
  }

  private fullRestart() {
    this.moveCooldown = 0;
    this.isAnimating = false;
    this.state.enemyBleeds.clear();
    this.state.kills = 0;
    this.state.chests.clear();
    this.state.altarUsed = false;
    this.generateFloor(true);
  }

}
