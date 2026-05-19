import Phaser from 'phaser';
import { GameMap, Room } from '../world/GameMap';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Entity } from '../entities/Entity';
import { FOVSystem } from '../systems/FOV';
import { TurnSystem } from '../systems/TurnSystem';
import { MapGen } from '../systems/MapGen';
import { MessageLog } from '../ui/MessageLog';
import { TileType } from '../data/tiles';
import { randomEnemyTemplate, BOSS_TEMPLATE, MINIBOSS_TEMPLATE } from '../data/enemies';
import { ALL_UPGRADES, rollUpgrades, rollRewards } from '../data/upgrades';
import { ALL_ITEMS, ItemDef } from '../data/items';
import { getClassById, PlayerClass } from '../data/classes';
import { trackEvent } from '../analytics';
import { sound } from '../audio/SoundManager';

const MAP_W = 60;
const MAP_H = 40;
const TILE = 32;
const MOVE_COOLDOWN_BASE = 120;
const TWEEN_DURATION_BASE = 60;

export class GameScene extends Phaser.Scene {
  map!: GameMap;
  player!: Player;
  enemies: Enemy[] = [];
  fov!: FOVSystem;
  turnSystem!: TurnSystem;
  messageLog!: MessageLog;
  kills = 0;
  chests = new Map<string, boolean>();
  private bossRoomIdx = -1;
  private minibossRoomIdx = -1;
  private trapRoomIdx = -1;
  private altarRoomIdx = -1;
  private altarUsed = false;
  private classId: string = 'limpador';
  private enemyBleeds = new Map<string, { ticks: number; damage: number }>();

  private get projectileTexture(): string {
    return this.classId === 'daemon' ? 'projectile_daemon' : 'projectile_player';
  }

  init(data: { classId?: string }) {
    if (data.classId) this.classId = data.classId;
  }

  private tileRT!: Phaser.GameObjects.RenderTexture;
  private entitySprites = new Map<string, Phaser.GameObjects.Image>();
  private enemyHpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private miniMap!: Phaser.GameObjects.Graphics;
  private isAnimating = false;
  private moveCooldown = 0;
  private arrowUp!: Phaser.Input.Keyboard.Key;
  private arrowDown!: Phaser.Input.Keyboard.Key;
  private arrowLeft!: Phaser.Input.Keyboard.Key;
  private arrowRight!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('Game');
  }

  private globalRestart = (e: KeyboardEvent) => {
    if ((e.key === 'r' || e.key === 'R') && this.player && !this.player.isAlive) {
      window.location.reload();
    }
  };

  create() {
    this.kills = 0;
    this.generateFloor();
    this.cameras.main.setViewport(0, 0, 640, 640);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    const arrows = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT') as { UP: Phaser.Input.Keyboard.Key; DOWN: Phaser.Input.Keyboard.Key; LEFT: Phaser.Input.Keyboard.Key; RIGHT: Phaser.Input.Keyboard.Key };
    this.arrowUp = arrows.UP;
    this.arrowDown = arrows.DOWN;
    this.arrowLeft = arrows.LEFT;
    this.arrowRight = arrows.RIGHT;
    this.input.keyboard!.on('keydown', this.handleInput, this);
    window.addEventListener('keydown', this.globalRestart);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleInput, this);
      window.removeEventListener('keydown', this.globalRestart);
    });
    this.scene.launch('HUD');
  }

  update(_time: number, delta: number) {
    if (!this.player) return;

    this.registry.set('hp', this.player.hp);
    this.registry.set('maxHp', this.player.maxHp);
    this.registry.set('level', this.player.level);
    this.registry.set('floor', this.player.floor);
    this.registry.set('attack', this.player.attack);
    this.registry.set('defense', this.player.defense);
    this.registry.set('xp', this.player.xp);
    this.registry.set('xpNext', this.player.xpToNext);
    this.registry.set('name', this.player.name);
    this.registry.set('kills', this.kills);
    this.registry.set('messages', this.messageLog?.getLast(10) ?? []);
    this.registry.set('upgrades', this.player.acquiredUpgrades);
    this.registry.set('inventory', this.player.inventory);
    this.registry.set('classId', this.classId);
    this.registry.set('cooldowns', this.player.cooldowns);
    this.registry.set('abilities', this.player.classDef.abilities);
    this.registry.set('bleedTicks', this.player.bleedTicks);
    this.registry.set('defenseBuff', this.player.defenseBuffRemaining);
    this.registry.set('tempAtkBonus', this.player.tempAtkBonus);
    this.registry.set('tempDefBonus', this.player.tempDefBonus);
    this.registry.set('bonusFov', this.player.bonusFov);
    this.registry.set('cooldownReduction', this.player.cooldownReduction);
    this.registry.set('baseFov', this.player.classDef.fov);
    this.registry.set('baseMoveSpeed', this.player.classDef.moveSpeed);
    this.registry.set('currentMoveSpeed', this.player.moveSpeed);

    if (this.isAnimating) return;
    if (!this.turnSystem?.isPlayerTurn) return;
    if (!this.player.isAlive) return;

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
    this.moveCooldown = Math.max(40, Math.round(MOVE_COOLDOWN_BASE / this.player.effectiveMoveSpeed));
  }

  private generateFloor() {
    this.moveCooldown = 0;
    this.entitySprites.forEach(s => s.destroy());
    this.entitySprites.clear();
    this.enemyHpBars.forEach(s => s.destroy());
    this.enemyHpBars.clear();
    this.enemyBleeds.clear();
    if (this.tileRT) this.tileRT.destroy();
    if (this.miniMap) this.miniMap.destroy();

    const result = MapGen.generate(MAP_W, MAP_H);
    this.map = result.map;

    const classDef = getClassById(this.classId);

    if (!this.player) {
      this.player = new Player(classDef, result.rooms[0].cx, result.rooms[0].cy);
    } else {
      this.player.x = result.rooms[0].cx;
      this.player.y = result.rooms[0].cy;
      this.player.floor++;
      this.player.onNewFloor();
    }

    if (this.player.floor > 1) {
      this.map.setTile(result.rooms[0].cx, result.rooms[0].cy, TileType.STAIRS_UP);
    }

    this.fov = new FOVSystem(this.player.effectiveFov);
    this.turnSystem = new TurnSystem();
    this.messageLog = new MessageLog();

    this.enemies = [];
    this.chests.clear();
    this.altarUsed = false;
    const floorMult = 1 + (this.player.floor - 1) * 0.075;

    const isBossFloor = this.player.floor % 10 === 0;
    const isMinibossFloor = !isBossFloor && this.player.floor % 3 === 0;
    this.bossRoomIdx = -1;
    this.minibossRoomIdx = -1;
    this.trapRoomIdx = -1;
    this.altarRoomIdx = -1;

    if (isBossFloor && result.rooms.length > 2) {
      this.bossRoomIdx = 1 + Math.floor(Math.random() * (result.rooms.length - 1));
    } else if (isMinibossFloor && result.rooms.length > 2) {
      this.minibossRoomIdx = 1 + Math.floor(Math.random() * (result.rooms.length - 1));
    }

    if (!isBossFloor) {
      this.trapRoomIdx = this.pickSpecialRoom(result.rooms, [this.bossRoomIdx, this.minibossRoomIdx]);
      this.altarRoomIdx = this.pickSpecialRoom(result.rooms, [this.bossRoomIdx, this.minibossRoomIdx, this.trapRoomIdx]);
    }

    let chestRoomIdx = -1;
    if (!isBossFloor && Math.random() < 0.80) {
      chestRoomIdx = this.pickSpecialRoom(result.rooms, [this.bossRoomIdx, this.minibossRoomIdx, this.trapRoomIdx, this.altarRoomIdx]);
      if (chestRoomIdx !== -1) {
        const r = result.rooms[chestRoomIdx];
        this.chests.set(`${r.cx},${r.cy}`, false);
      }
    }

    for (let i = 1; i < result.rooms.length; i++) {
      const r = result.rooms[i];
      if (r.cx === this.player.x && r.cy === this.player.y) continue;
      if (i === chestRoomIdx) continue;
      if (i === this.altarRoomIdx) {
        this.map.setTile(r.cx, r.cy, TileType.ALTAR);
        continue;
      }
      if (i === this.trapRoomIdx) {
        const trapCount = Phaser.Math.Between(3, 5);
        for (let t = 0; t < trapCount; t++) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
            const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
            if (this.map.tiles[ty][tx] === TileType.FLOOR) {
              this.map.setTile(tx, ty, TileType.TRAP);
              break;
            }
          }
        }
        continue;
      }

      const isBossRoom = i === this.bossRoomIdx;
      const isMinibossRoom = i === this.minibossRoomIdx;
      const extraCount = (isBossRoom || isMinibossRoom) ? 0 : Math.floor((this.player.floor - 1) / 4);
      const spawnCount = 1 + extraCount;

      for (let e = 0; e < spawnCount; e++) {
        let ex = r.cx;
        let ey = r.cy;
        if (e > 0) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
            const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
            if (!this.enemies.some(en => en.x === tx && en.y === ty)) {
              ex = tx;
              ey = ty;
              break;
            }
          }
        }

        if (isBossRoom) {
          const scaled = {
            ...BOSS_TEMPLATE,
            hp: Math.ceil(BOSS_TEMPLATE.hp * floorMult + this.player.maxHp * 1.2),
            attack: Math.ceil(BOSS_TEMPLATE.attack * floorMult + this.player.effectiveAtk * 1.5),
            defense: Math.ceil(BOSS_TEMPLATE.defense * floorMult + this.player.effectiveDef * 1.2),
          };
          this.enemies.push(new Enemy(scaled, ex, ey));
        } else if (isMinibossRoom) {
          const scaled = {
            ...MINIBOSS_TEMPLATE,
            hp: Math.ceil(MINIBOSS_TEMPLATE.hp * floorMult + this.player.maxHp * 0.25),
            attack: Math.ceil(MINIBOSS_TEMPLATE.attack * floorMult + this.player.effectiveAtk * 0.35),
            defense: Math.ceil(MINIBOSS_TEMPLATE.defense * floorMult + this.player.effectiveDef * 0.3),
          };
          this.enemies.push(new Enemy(scaled, ex, ey));
        } else {
          const t = randomEnemyTemplate();
          const scaled = {
            ...t,
            hp: Math.ceil(t.hp * floorMult + this.player.maxHp * 0.15),
            attack: Math.ceil(t.attack * floorMult + this.player.effectiveAtk * 0.25),
            defense: Math.ceil(t.defense * floorMult + this.player.effectiveDef * 0.2),
          };
          this.enemies.push(new Enemy(scaled, ex, ey));
        }
      }
    }

    this.tileRT = this.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.tileRT.setOrigin(0, 0);
    this.tileRT.setDepth(0);

    this.miniMap = this.add.graphics();
    this.miniMap.setScrollFactor(0);
    this.miniMap.setDepth(50);

    const playerSpr = this.add.image(0, 0, classDef.textureKey);
    playerSpr.setOrigin(0.5, 0.5).setDepth(10);
    this.entitySprites.set('player', playerSpr);

    for (const e of this.enemies) {
      const spr = this.add.image(0, 0, e.textureKey);
      spr.setOrigin(0.5, 0.5).setDepth(9);
      this.entitySprites.set(e.id, spr);
    }

    this.fov.compute(this.map, this.player.x, this.player.y);
    this.redrawRT();
    this.drawMiniMap();
    this.syncEntitySprites();
    this.centerOnPlayer();

      if (this.player.floor > 1) {
        sound.play('stairs_down');
      this.messageLog.add(`--- /system/dir_${this.player.floor} ---`);
      if (this.player.floor % 5 === 0) {
        sound.play('boss_appear');
        this.messageLog.add('*** ALERTA: ROOTKIT DETECTADO ***');
      }
      trackEvent('floor_reach', { floor: this.player.floor, level: this.player.level });
    } else {
      this.messageLog.add('SYSTEM PURGE v0.1 — Kernel inicializado.');
    }

    this.isAnimating = false;
  }

  private openChest(x: number, y: number): void {
    const ck = `${x},${y}`;
    if (!this.chests.has(ck) || this.chests.get(ck)) return;

    this.chests.set(ck, true);
    sound.play('chest_open');
    this.spawnParticles(x, y, 0xffd700, 6);

    const rolled = rollRewards(this.player.acquiredUpgrades, this.player.freeSlots(), 3, this.classId);
    if (rolled.length === 0) {
      this.messageLog.add('Baú vazio.');
      return;
    }

    const upgOptions = rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
    const itemOptions = rolled.filter(r => r.kind === 'item').map(r => ALL_ITEMS.find(i => i.id === r.id)!).filter(Boolean);

    trackEvent('chest_open', { floor: this.player.floor });

    this.scene.pause();
    this.scene.launch('Upgrade', {
      upgrades: upgOptions,
      items: itemOptions,
      acquired: this.player.acquiredUpgrades,
      mode: 'choice',
      floor: this.player.floor,
      onSelect: (kind: 'upgrade' | 'item', id: string) => {
        if (kind === 'upgrade') {
          this.player.applyUpgrade(id);
          const upg = ALL_UPGRADES.find(u => u.id === id);
          if (upg) this.messageLog.add(`Baú: ${upg.name} (${upg.description})`);
          this.fov = new FOVSystem(this.player.effectiveFov);
        } else {
          this.player.addItem(id);
          const item = ALL_ITEMS.find(i => i.id === id);
          if (item) this.messageLog.add(`Baú: ${item.name} — adicionado ao inventário.`);
        }
        this.scene.resume();
      },
    });
  }

  private pickSpecialRoom(rooms: Room[], exclude: number[]): number {
    const candidates: number[] = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      if (exclude.includes(i)) continue;
      const r = rooms[i];
      if (this.player && r.cx === this.player.x && r.cy === this.player.y) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return -1;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private handleInput(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      this.scene.pause();
      this.scene.pause('HUD');
      this.scene.launch('Pause');
      return;
    }

    if (!this.player.isAlive) {
      if (e.key === 'r' || e.key === 'R') this.restartGame();
      return;
    }

    if (e.key === '.' || e.key === ' ') {
      if (this.isAnimating) return;
      if (!this.turnSystem?.isPlayerTurn) return;
      e.preventDefault();
      this.endTurn();
    }

    if (e.key === 'q' || e.key === 'Q') {
      if (this.isAnimating) return;
      if (!this.turnSystem?.isPlayerTurn) return;
      this.useAbility(0);
    }
    if (e.key === 'e' || e.key === 'E') {
      if (this.isAnimating) return;
      if (!this.turnSystem?.isPlayerTurn) return;
      this.useAbility(1);
    }

    if (this.player.classDef.canShoot) {
      if (e.key === 'w' || e.key === 'W') {
        if (this.isAnimating) return;
        if (!this.turnSystem?.isPlayerTurn) return;
        this.fireProjectile(0, -1);
      }
      if (e.key === 's' || e.key === 'S') {
        if (this.isAnimating) return;
        if (!this.turnSystem?.isPlayerTurn) return;
        this.fireProjectile(0, 1);
      }
      if (e.key === 'a' || e.key === 'A') {
        if (this.isAnimating) return;
        if (!this.turnSystem?.isPlayerTurn) return;
        this.fireProjectile(-1, 0);
      }
      if (e.key === 'd' || e.key === 'D') {
        if (this.isAnimating) return;
        if (!this.turnSystem?.isPlayerTurn) return;
        this.fireProjectile(1, 0);
      }
    }

    if (e.key === '1') { this.useItem(0); return; }
    if (e.key === '2') { this.useItem(1); return; }
    if (e.key === '3') { this.useItem(2); return; }
  }

  private processMove(dx: number, dy: number) {
    if (!this.player.isAlive) return;
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    const enemy = this.enemies.find(e2 => e2.x === nx && e2.y === ny && e2.isAlive);
    if (enemy) {
      this.meleeAttack(this.player, enemy);
      this.endTurn();
      return;
    }

    if (!this.map.isWalkable(nx, ny)) return;

    if (this.map.tiles[ny][nx] === TileType.STAIRS_DOWN) {
      if (this.enemies.some(e => e.isAlive && e.textureKey === 'enemy_boss')) {
        this.messageLog.add('*** ROOTKIT ativo — elimine-o primeiro ***');
        this.player.x = nx - dx;
        this.player.y = ny - dy;
        this.endTurn();
        return;
      }
      this.player.x = nx;
      this.player.y = ny;
      this.messageLog.add('Acessando próximo diretório...');
      this.generateFloor();
      return;
    }

    this.player.x = nx;
    this.player.y = ny;
    sound.play('player_move');

    if (this.map.tiles[ny][nx] === TileType.TRAP) {
      const dmg = Phaser.Math.Between(2, 4);
      this.player.takeDamage(dmg);
      this.spawnParticles(nx, ny, 0xff4444, 6);
      this.messageLog.add(`Armadilha de dados! -${dmg} HP`);
      this.map.setTile(nx, ny, TileType.FLOOR);
      if (!this.player.isAlive) return;
    }

    if (this.map.tiles[ny][nx] === TileType.ALTAR && !this.altarUsed) {
      this.altarUsed = true;
      this.spawnParticles(nx, ny, 0xcc66ff, 8);
      const upgs = rollUpgrades(this.player.acquiredUpgrades, 1, this.classId);
      if (upgs.length > 0) {
        const upg = upgs[0];
        this.player.applyUpgrade(upg.id);
        this.messageLog.add(`Altar do Sistema concedeu ${upg.name}!`);
        this.fov = new FOVSystem(this.player.effectiveFov);
        this.fov.compute(this.map, this.player.x, this.player.y);
      }
      this.map.setTile(nx, ny, TileType.FLOOR);
    }

    this.openChest(nx, ny);

    const spr = this.entitySprites.get('player');
    if (spr) {
      this.isAnimating = true;
      this.tweens.add({
        targets: spr,
        x: nx * TILE + TILE / 2,
        y: ny * TILE + TILE / 2,
        duration: Math.max(20, Math.round(TWEEN_DURATION_BASE / this.player.effectiveMoveSpeed)),
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

  private getDirEnemy(dx: number, dy: number): { x: number; y: number; enemy: Enemy | null } {
    const range = Math.ceil(this.player.effectiveFov);
    for (let i = 1; i <= range; i++) {
      const tx = this.player.x + dx * i;
      const ty = this.player.y + dy * i;
      if (!this.map.isInBounds(tx, ty)) return { x: tx - dx, y: ty - dy, enemy: null };
      if (this.map.tiles[ty][tx] === TileType.WALL) return { x: tx - dx, y: ty - dy, enemy: null };
      const enemy = this.enemies.find(e => e.x === tx && e.y === ty && e.isAlive);
      if (enemy) return { x: tx, y: ty, enemy };
    }
    return { x: this.player.x + dx * range, y: this.player.y + dy * range, enemy: null };
  }

  private fireProjectile(dx: number, dy: number) {
    if (this.isAnimating) return;

    const pierce = this.player.classDef.projectilesPierce;
    const range = Math.ceil(this.player.effectiveFov);

    if (pierce) {
      const enemiesHit: Enemy[] = [];
      let endX = this.player.x;
      let endY = this.player.y;
      for (let i = 1; i <= range; i++) {
        const tx = this.player.x + dx * i;
        const ty = this.player.y + dy * i;
        if (!this.map.isInBounds(tx, ty)) break;
        if (this.map.tiles[ty][tx] === TileType.WALL) break;
        endX = tx;
        endY = ty;
        const enemy = this.enemies.find(e => e.x === tx && e.y === ty && e.isAlive);
        if (enemy) enemiesHit.push(enemy);
      }
      if (endX === this.player.x && endY === this.player.y) return;

      sound.play('projectile');
      this.isAnimating = true;
      const proj = this.add.image(
        this.player.x * TILE + TILE / 2,
        this.player.y * TILE + TILE / 2,
        this.projectileTexture,
      ).setOrigin(0.5, 0.5).setDepth(15);

      this.tweens.add({
        targets: proj,
        x: endX * TILE + TILE / 2,
        y: endY * TILE + TILE / 2,
        duration: 80,
        ease: 'Linear',
        onComplete: () => {
          proj.destroy();
          this.isAnimating = false;
          for (const enemy of enemiesHit) {
            this.meleeAttack(this.player, enemy, true);
          }
          if (enemiesHit.length === 0) this.messageLog.add('Projétil perfurante — nenhum alvo.');
          this.endTurn();
        },
      });
      return;
    }

    const target = this.getDirEnemy(dx, dy);
    if (target.x === this.player.x && target.y === this.player.y) return;

    sound.play('projectile');
    this.isAnimating = true;
    const proj = this.add.image(
      this.player.x * TILE + TILE / 2,
      this.player.y * TILE + TILE / 2,
      this.projectileTexture,
    ).setOrigin(0.5, 0.5).setDepth(15);

    this.tweens.add({
      targets: proj,
      x: target.x * TILE + TILE / 2,
      y: target.y * TILE + TILE / 2,
      duration: 80,
      ease: 'Linear',
      onComplete: () => {
        proj.destroy();
        this.isAnimating = false;
        if (target.enemy) {
          this.meleeAttack(this.player, target.enemy, true);
        } else {
          this.messageLog.add('Projétil acertou a parede.');
        }
        this.endTurn();
      },
    });
  }

  private endTurn() {
    this.turnSystem.endPlayerTurn();

    this.processClassPressure();

    this.fov.compute(this.map, this.player.x, this.player.y);

    this.processAdjacentAttacks();

    if (!this.player.isAlive) {
      sound.play('player_death');
      this.messageLog.add('*** SISTEMA FALHOU — Pressione R para reiniciar ***');
      trackEvent('player_death', { floor: this.player.floor, level: this.player.level, kills: this.kills });
      return;
    }

    this.processEnemyAI();

    this.turnSystem.reset();

    this.player.processTurnEnd();

    this.redrawRT();
    this.syncEntitySprites();
    this.centerOnPlayer();
  }

  private onEnemyDeath(enemy: Enemy): void {
    this.kills++;
    const color = enemy.textureKey === 'enemy_boss' ? 0xffd700 : 0xff4444;
    this.spawnParticles(enemy.x, enemy.y, color, 8);
    sound.play('enemy_death');
    this.messageLog.add(`${enemy.name} foi neutralizado.`);

    if (enemy.textureKey === 'enemy_boss' && this.bossRoomIdx !== -1) {
      trackEvent('boss_kill', { floor: this.player.floor, level: this.player.level });
      this.showBossRewards();
    }

    if (enemy.textureKey === 'enemy_miniboss' && this.minibossRoomIdx !== -1) {
      this.chests.set(`${enemy.x},${enemy.y}`, false);
      this.messageLog.add('Um baú de tesouro aparece!');
    }

    const leveled = this.player.addXp(enemy.xpValue);
    if (leveled) {
      sound.play('level_up');
      this.messageLog.add(`*** SISTEMA ATUALIZADO para v${this.player.level} ***`);
      trackEvent('level_up', { new_level: this.player.level, floor: this.player.floor, kills: this.kills });
      this.showRewardChoices('level');
    }
  }

  private showBossRewards(): void {
    const rolled = rollRewards(this.player.acquiredUpgrades, 0, 5, this.classId);
    const upgOptions = rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
    if (upgOptions.length === 0) return;

    let remainingUpgs = [...upgOptions];
    let pickCount = 2;

    const showPick = () => {
      if (pickCount <= 0 || remainingUpgs.length === 0) return;
      this.scene.pause();
      this.scene.launch('Upgrade', {
        upgrades: remainingUpgs,
        items: [],
        acquired: this.player.acquiredUpgrades,
        mode: 'choice',
        pickCount,
        floor: this.player.floor,
        title: `RECOMPENSA DO BOSS (mais ${pickCount})`,
        onSelect: (kind: 'upgrade' | 'item', id: string) => {
          this.player.applyUpgrade(id);
          const upg = ALL_UPGRADES.find(u => u.id === id);
          if (upg) this.messageLog.add(`${upg.name} ativado.`);
          remainingUpgs = remainingUpgs.filter(u => u.id !== id);
          pickCount--;
          this.scene.resume();
          if (pickCount > 0) {
            this.time.delayedCall(100, showPick);
          } else {
            this.fov = new FOVSystem(this.player.effectiveFov);
            this.fov.compute(this.map, this.player.x, this.player.y);
            this.redrawRT();
            this.syncEntitySprites();
          }
        },
      });
    };

    showPick();
  }

  private meleeAttack(attacker: Entity, defender: Entity, isProjectile: boolean = false) {
    const isPlayerDef = defender === this.player;
    const isPlayerAtk = attacker === this.player;

    if (isPlayerAtk) sound.play('player_melee');
    if (isPlayerDef) sound.play('player_hit');

    if (isPlayerDef && this.player.hasDodge && Math.random() < 0.15) {
      this.messageLog.add(`${this.player.classDef.name} desviou de ${attacker.name}.`);
      return;
    }

    let atkVal = isPlayerAtk ? this.player.effectiveAtk : attacker.attack;
    let defVal = isPlayerDef ? this.player.effectiveDef : defender.defense;

    if (isPlayerAtk) {
      const cd = this.player.classDef;
      if (cd.ignoreDefense) defVal = 0;
      if (!cd.canMelee && !isProjectile) { atkVal = 0; }
    }

    let dmg = Math.max(1, atkVal - defVal);

    if (isPlayerAtk && !isProjectile) {
      const cd = this.player.classDef;
      dmg += cd.meleeBonus;
      dmg = Math.floor(dmg * cd.meleeMultiplier);
    }

    if (isPlayerDef && this.player.isDefenseBuffed) {
      dmg = Math.floor(dmg * 0.5);
    }

    dmg = Math.max(0, dmg);

    if (isPlayerAtk && !isProjectile && !this.player.classDef.canMelee) {
      dmg = 0;
    }

    if (isPlayerDef && this.player.hasEncryption) {
      dmg = Math.max(0, dmg - 3);
      this.player.encryptionLayerUsed = true;
      this.messageLog.add('Camada de Criptografia reduziu dano em 3.');
    }

    if (dmg === 0) return;

    const dealt = defender.takeDamage(dmg);
    if (defender instanceof Enemy && dealt > 0) sound.play('enemy_hit');
    this.messageLog.add(`${attacker.name} acerta ${defender.name} com ${dealt} de dano.`);

    if (isPlayerAtk && dealt > 0 && defender instanceof Enemy) {
      const ls = this.player.lifeStealAmount;
      if (ls > 0 && Math.random() < 0.5) {
        this.player.heal(ls);
        this.messageLog.add(`Dreno de Vida restaurou ${ls} HP.`);
      }

      if (this.player.acquiredUpgrades.has('lamina_energizada')) {
        this.enemyBleeds.set(defender.id, { ticks: 3, damage: 1 });
        this.messageLog.add(`${defender.name} sangrando (1 por 3 turnos).`);
      }
    }


    const upgradeRc = this.player.reflectChance;
    const classRc = this.player.classDef.reflectPercent / 100;
    const shieldRc = this.player.acquiredUpgrades.has('escudo_reativo') ? 0.15 : 0;
    const totalRc = Math.max(upgradeRc, classRc, shieldRc);
    if (isPlayerDef && totalRc > 0 && dealt > 0 && Math.random() < totalRc) {
      const rdmg = attacker.takeDamage(2);
      if (rdmg > 0) this.messageLog.add(`Dano refletido: ${rdmg} (${Math.round(totalRc * 100)}%).`);
      if (!attacker.isAlive && attacker instanceof Enemy) {
        this.onEnemyDeath(attacker);
      }
    }

    if (isPlayerAtk && dealt > 0 && defender instanceof Enemy && defender.isAlive) {
      if (this.player.acquiredUpgrades.has('golpe_duplo') && Math.random() < 0.3) {
        const dmg2 = Math.max(1, atkVal - defVal);
        const dealt2 = defender.takeDamage(dmg2);
        this.messageLog.add(`Golpe Duplo! +${dealt2} de dano.`);
        sound.play('enemy_hit');
        if (!defender.isAlive) this.onEnemyDeath(defender);
      }
    }

    if (isPlayerDef && !defender.isAlive && this.player.hasFatalGuard) {
      defender.hp = 1;
      this.player.fatalGuardUsed = true;
      this.messageLog.add('Proteção do Setor de Boot! Sobreviveu com 1 HP.');
    }

    if (!defender.isAlive && defender instanceof Enemy) {
      this.onEnemyDeath(defender);
    }
  }

  private showRewardChoices(source: 'level' | 'chest'): void {
    const rolled = rollRewards(this.player.acquiredUpgrades, this.player.freeSlots(), 3, this.classId);
    if (rolled.length === 0) return;

    const upgOptions = rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
    const itemOptions = rolled.filter(r => r.kind === 'item').map(r => ALL_ITEMS.find(i => i.id === r.id)!).filter(Boolean);

    const mode = source === 'chest' ? 'reveal' : 'choice';

    this.scene.pause();
    this.scene.launch('Upgrade', {
      upgrades: upgOptions,
      items: itemOptions,
      acquired: this.player.acquiredUpgrades,
      mode,
      floor: this.player.floor,
      onSelect: (kind: 'upgrade' | 'item', id: string) => {
        if (kind === 'upgrade') {
          this.player.applyUpgrade(id);
          const upg = ALL_UPGRADES.find(u => u.id === id);
          if (upg) this.messageLog.add(upg.name + ' ativado.');
          this.fov = new FOVSystem(this.player.effectiveFov);
          this.fov.compute(this.map, this.player.x, this.player.y);
        } else {
          this.player.addItem(id);
          const item = ALL_ITEMS.find(i => i.id === id);
          if (item) this.messageLog.add(`${item.name} — adicionado ao inventário.`);
        }
        this.redrawRT();
        this.syncEntitySprites();
        this.scene.resume();
      },
    });
  }

  private useItem(slot: number): void {
    const itemId = this.player.getItem(slot);
    if (!itemId) return;
    if (this.isAnimating) return;
    if (!this.turnSystem?.isPlayerTurn) return;

    switch (itemId) {
      case 'health_patch':
        this.player.heal(15);
        this.messageLog.add('Usou Patch de Sau\u0301de: +15 HP.');
        break;
      case 'network_pulse': {
        let totalDmg = 0;
        for (const e of this.enemies) {
          if (!e.isAlive) continue;
          if (!this.map.visible[e.y]?.[e.x]) continue;
          const dmg = e.takeDamage(6);
          if (dmg > 0) totalDmg += dmg;
          if (!e.isAlive) this.onEnemyDeath(e);
        }
        this.messageLog.add(`Pulso de Rede: ${totalDmg} de dano total.`);
        break;
      }
      case 'packet_sniffer':
        for (let y = 0; y < this.map.height; y++) {
          for (let x = 0; x < this.map.width; x++) {
            this.map.explored[y][x] = true;
          }
        }
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.redrawRT();
        this.syncEntitySprites();
        this.messageLog.add('Packet Sniffer: mapa revelado.');
        break;
      case 'overclock_inject':
        this.player.tempAtkBonus = 5;
        this.player.tempAtkRemaining = 5;
        this.messageLog.add('Overclock Inject: ATQ +5 por 5 turnos.');
        break;
      case 'defrag_shield':
        this.player.tempDefBonus = 5;
        this.player.tempDefRemaining = 5;
        this.messageLog.add('Defrag Shield: DEF +5 por 5 turnos.');
        break;
    }

    this.player.removeItem(slot);
    this.endTurn();
  }

  private useAbility(index: number): void {
    if (index >= this.player.classDef.abilities.length) return;
    if (!this.player.canUseAbility(index)) return;

    const ability = this.player.classDef.abilities[index];
    this.player.useAbility(index);

    switch (ability.type) {
      case 'melee_aoe': {
        let hitCount = 0;
        for (const e of this.enemies) {
          if (!e.isAlive) continue;
          if (!this.isAdjacent(this.player.x, this.player.y, e.x, e.y)) continue;
          const defVal = this.player.classDef.ignoreDefense ? 0 : e.defense;
          const dmg = Math.max(1, this.player.effectiveAtk - defVal);
          e.takeDamage(dmg);
          hitCount++;
          this.messageLog.add(`${e.name} atingido por ${dmg}.`);
          sound.play('enemy_hit');
          if (!e.isAlive) this.onEnemyDeath(e);
        }
        this.messageLog.add(`Varredura: ${hitCount} inimigo(s) atingido(s).`);
        break;
      }
      case 'projectile_barrage': {
        const dirs: [number, number][] = [[1,0], [-1,0], [0,1], [0,-1]];
        const hits: { enemy: Enemy; tx: number; ty: number }[] = [];
        for (const [dx, dy] of dirs) {
          const target = this.getDirEnemy(dx, dy);
          if (target.enemy) hits.push({ enemy: target.enemy, tx: target.x, ty: target.y });
        }
        if (hits.length === 0) {
          this.messageLog.add('Rajada de Pacotes: nenhum alvo.');
          break;
        }
        sound.play('projectile');
        this.isAnimating = true;
        let completed = 0;
        for (const hit of hits) {
          const proj = this.add.image(
            this.player.x * TILE + TILE / 2,
            this.player.y * TILE + TILE / 2,
            this.projectileTexture,
          ).setOrigin(0.5, 0.5).setDepth(15);
          this.tweens.add({
            targets: proj,
            x: hit.tx * TILE + TILE / 2,
            y: hit.ty * TILE + TILE / 2,
            duration: 100,
            ease: 'Linear',
            onComplete: () => {
              proj.destroy();
              const baseDmg = Math.max(1, this.player.effectiveAtk - hit.enemy.defense);
              const dmg = Math.floor(baseDmg * 1.5);
              hit.enemy.takeDamage(dmg);
              sound.play('enemy_hit');
              this.spawnParticles(hit.enemy.x, hit.enemy.y, 0x44aaff, 4);
              this.messageLog.add(`Rajada: ${hit.enemy.name} tomou ${dmg}.`);
              if (!hit.enemy.isAlive) this.onEnemyDeath(hit.enemy);
              completed++;
              if (completed === hits.length) {
                this.isAnimating = false;
                this.messageLog.add(`Rajada de Pacotes: ${hits.length} alvo(s) atingido(s).`);
                this.endTurn();
              }
            },
          });
        }
        return; // endTurn called inside the last tween
      }
      case 'defense_buff':
        this.player.defenseBuffRemaining = ability.duration ?? 3;
        this.messageLog.add(`Criptografia Total: dano reduzido 50% por ${this.player.defenseBuffRemaining} turnos.`);
        break;
      case 'aoe_damage': {
        const aoeRange = this.player.overflowRange;
        let totalDmg = 0;
        let hitCount = 0;
        for (const e of this.enemies) {
          if (!e.isAlive) continue;
          const dx = Math.abs(this.player.x - e.x);
          const dy = Math.abs(this.player.y - e.y);
          if (Math.max(dx, dy) > aoeRange) continue;
          const dmg = e.takeDamage(ability.damage ?? 8);
          totalDmg += dmg;
          hitCount++;
          this.messageLog.add(`${e.name} atingido por ${dmg}.`);
          this.spawnParticles(e.x, e.y, 0xff44aa, 4);
          sound.play('enemy_hit');
          if (!e.isAlive) this.onEnemyDeath(e);
        }
        this.messageLog.add(`Overflow: ${hitCount} inimigo(s) atingido(s), ${totalDmg} de dano total.`);
        const cx = this.player.x * TILE + TILE / 2;
        const cy = this.player.y * TILE + TILE / 2;
        const r = aoeRange * TILE;
        const ring = this.add.graphics();
        ring.fillStyle(0xff44aa, 0.15);
        ring.fillCircle(0, 0, r);
        ring.lineStyle(4, 0xff44aa, 0.9);
        ring.strokeCircle(0, 0, r);
        ring.setPosition(cx, cy);
        ring.setDepth(8);
        ring.setScale(0.2);
        this.tweens.add({
          targets: ring,
          scaleX: 1,
          scaleY: 1,
          alpha: 0,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => ring.destroy(),
        });
        break;
      }
      case 'dot': {
        const DOT_RANGE = 3;
        let target: Enemy | null = null;
        let bestDist = Infinity;
        for (const e of this.enemies) {
          if (!e.isAlive) continue;
          const dx = Math.abs(this.player.x - e.x);
          const dy = Math.abs(this.player.y - e.y);
          const dist = Math.max(dx, dy);
          if (dist <= DOT_RANGE && dist < bestDist) {
            target = e;
            bestDist = dist;
          }
        }
        if (target) {
          const dmg = target.takeDamage(ability.damage ?? 10);
          this.enemyBleeds.set(target.id, { ticks: ability.duration ?? 3, damage: 2 + this.player.extraBleedDamage });
          this.messageLog.add(`Vazamento: ${dmg} de dano + sangra 2 por ${ability.duration} turnos.`);
          this.spawnParticles(target.x, target.y, 0x66ff66, 4);
          sound.play('enemy_hit');
          if (!target.isAlive) this.onEnemyDeath(target);
          const beam = this.add.graphics();
          beam.lineStyle(3, 0x66ff66, 0.7);
          beam.lineBetween(
            this.player.x * TILE + TILE / 2, this.player.y * TILE + TILE / 2,
            target.x * TILE + TILE / 2, target.y * TILE + TILE / 2
          );
          beam.setDepth(8);
          this.tweens.add({
            targets: beam,
            alpha: 0,
            duration: 400,
            onComplete: () => beam.destroy(),
          });
        } else {
          this.messageLog.add('Nenhum inimigo alcancavel.');
        }
        break;
      }
    }

    this.endTurn();
  }

  private spawnParticles(x: number, y: number, tint: number, count: number = 6): void {
    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2;
    const emitter = this.add.particles(px, py, 'particle', {
      speed: { min: 40, max: 120 },
      lifespan: 350,
      scale: { start: 0.8, end: 0 },
      tint,
      emitting: false,
    });
    emitter.setDepth(20);
    emitter.explode(count);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  private restartGame(): void {
    window.location.reload();
  }

  private isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
    return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
  }

  private processAdjacentAttacks(): void {
    if (!this.player.isAlive) return;

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      if (!this.player.isAlive) break;
      if (this.isAdjacent(this.player.x, this.player.y, enemy.x, enemy.y)) {
        this.meleeAttack(enemy, this.player);
      }
    }
  }

  private processEnemyBleeds(): void {
    for (const [id, bleed] of this.enemyBleeds) {
      const enemy = this.enemies.find(e => e.id === id);
      if (!enemy || !enemy.isAlive) {
        this.enemyBleeds.delete(id);
        continue;
      }
      enemy.takeDamage(bleed.damage);
      this.messageLog.add(`${enemy.name} sangra: ${bleed.damage} de dano.`);

      // floating 0/1 bits
      const bits = ['0', '1'];
      for (let i = 0; i < 3; i++) {
        const bit = this.add.text(
          enemy.x * TILE + Phaser.Math.Between(4, 28),
          enemy.y * TILE + Phaser.Math.Between(0, 8),
          bits[Math.floor(Math.random() * bits.length)],
          { fontFamily: 'Consolas', fontSize: '10px', color: '#66ff66' }
        ).setDepth(12);
        this.tweens.add({
          targets: bit,
          y: bit.y - Phaser.Math.Between(16, 32),
          alpha: 0,
          duration: 600,
          onComplete: () => bit.destroy(),
        });
      }

      // pulse tint on bleed tick
      const spr = this.entitySprites.get(enemy.id);
      if (spr?.active) {
        spr.setTint(0x66ff66);
        this.time.delayedCall(100, () => { if (spr.active) spr.clearTint(); });
      }

      bleed.ticks--;
      if (bleed.ticks <= 0) {
        this.enemyBleeds.delete(id);
        this.messageLog.add(`${enemy.name} parou de sangrar.`);
      }
      if (!enemy.isAlive) this.onEnemyDeath(enemy);
    }
  }

  private processEnemyAI(): void {
    if (!this.player.isAlive) return;

    this.processEnemyBleeds();

    for (const enemy of this.enemies) {
      if (!enemy.isAlive) continue;
      if (!this.player.isAlive) break;
      if (this.isAdjacent(this.player.x, this.player.y, enemy.x, enemy.y)) continue;

      const canSeePlayer = this.map.visible[enemy.y]?.[enemy.x] ?? false;

      enemy.takeTurn(
        this.player.x,
        this.player.y,
        canSeePlayer,
        (x, y) => this.map.isWalkable(x, y),
        (x, y) => {
          if (this.player.x === x && this.player.y === y && this.player.isAlive) return true;
          if (this.enemies.some(e => e !== enemy && e.isAlive && e.x === x && e.y === y)) return true;
          const ck = `${x},${y}`;
          if (this.chests.has(ck) && !this.chests.get(ck)) return true;
          return false;
        },
      );

      if (this.isAdjacent(this.player.x, this.player.y, enemy.x, enemy.y)) {
        this.meleeAttack(enemy, this.player);
        if (!this.player.isAlive) {
      this.messageLog.add('*** SISTEMA FALHOU — Pressione R para reiniciar ***');
      trackEvent('player_death', { floor: this.player.floor, level: this.player.level, kills: this.kills });
          return;
    }
    }
    }
  }

  private processClassPressure(): void {
    let pd = this.player.classDef.pressureDamage;
    if (pd <= 0) return;
    if (this.player.acquiredUpgrades.has('campo_pressurizado')) pd += 1;
    for (const e of this.enemies) {
      if (!e.isAlive) continue;
      if (!this.isAdjacent(this.player.x, this.player.y, e.x, e.y)) continue;
      e.takeDamage(pd);
      this.messageLog.add(`Pressao de Pacotes: ${e.name} tomou ${pd} de dano.`);
      if (!e.isAlive) this.onEnemyDeath(e);
    }
  }

  private drawMiniMap() {
    this.miniMap.clear();

    const mx = 4;
    const my = 556;
    const s = 2;
    const w = MAP_W * s;
    const h = MAP_H * s;

    this.miniMap.fillStyle(0x000000, 0.6);
    this.miniMap.fillRect(mx - 1, my - 1, w + 2, h + 2);
    this.miniMap.lineStyle(1, 0x334455);
    this.miniMap.strokeRect(mx - 1, my - 1, w + 2, h + 2);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!this.map.explored[y][x]) continue;
        const vis = this.map.visible[y][x];
        const wall = this.map.tiles[y][x] === TileType.WALL;
        if (wall) {
          this.miniMap.fillStyle(vis ? 0x556677 : 0x2a3a4a);
        } else {
          this.miniMap.fillStyle(vis ? 0x224466 : 0x141e2e);
        }
        this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
      }
    }

    for (const [key, opened] of this.chests) {
      const [cx, cy] = key.split(',').map(Number);
      if (!opened && this.map.explored[cy]?.[cx]) {
        this.miniMap.fillStyle(0xffd700);
        this.miniMap.fillRect(mx + cx * s, my + cy * s, s, s);
      }
    }

    for (const e of this.enemies) {
      if (!e.isAlive || !this.map.visible[e.y]?.[e.x]) continue;
      this.miniMap.fillStyle(0xff4444);
      this.miniMap.fillRect(mx + e.x * s, my + e.y * s, s, s);
    }

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!this.map.explored[y][x]) continue;
        const t = this.map.tiles[y][x];
        if (t === TileType.STAIRS_DOWN || t === TileType.STAIRS_UP) {
          this.miniMap.fillStyle(t === TileType.STAIRS_DOWN ? 0x44ddbb : 0x88ddff);
          this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
        } else if (t === TileType.TRAP) {
          this.miniMap.fillStyle(0xff6644);
          this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
        } else if (t === TileType.ALTAR) {
          this.miniMap.fillStyle(0xcc66ff);
          this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
        }
      }
    }

    this.miniMap.fillStyle(0x00ff88);
    this.miniMap.fillRect(mx + this.player.x * s, my + this.player.y * s, s, s);
  }

  private redrawRT() {
    this.tileRT.clear();

    for (let y = 0; y < this.map.height; y++) {
      for (let x = 0; x < this.map.width; x++) {
        if (!this.map.explored[y][x]) continue;

        const type = this.map.tiles[y][x];
        const isVisible = this.map.visible[y][x];

        let key: string;
        switch (type) {
          case TileType.WALL:
            key = isVisible ? 'tile_wall' : 'tile_wall_dim';
            break;
          case TileType.STAIRS_DOWN:
            key = isVisible ? 'tile_stairs' : 'tile_stairs_dim';
            break;
          case TileType.STAIRS_UP:
            key = isVisible ? 'tile_stairs_up' : 'tile_stairs_up_dim';
            break;
          case TileType.TRAP:
            key = isVisible ? 'tile_trap' : 'tile_trap_dim';
            break;
          case TileType.ALTAR:
            key = isVisible ? 'tile_altar' : 'tile_altar_dim';
            break;
          default:
            key = isVisible ? 'tile_floor' : 'tile_floor_dim';
            break;
        }

        this.tileRT.draw(key, x * TILE, y * TILE);
      }
    }

    for (const [key, opened] of this.chests) {
      const [cx, cy] = key.split(',').map(Number);
      if (!this.map.explored[cy]?.[cx]) continue;
      const vis = this.map.visible[cy]?.[cx] ?? false;
      const tex = opened
        ? (vis ? 'tile_chest_opened' : 'tile_chest_opened_dim')
        : (vis ? 'tile_chest' : 'tile_chest_dim');
      this.tileRT.draw(tex, cx * TILE, cy * TILE);
    }

    this.drawMiniMap();
  }

  private syncEntitySprites() {
    const pSpr = this.entitySprites.get('player');
    if (pSpr) {
      pSpr.setPosition(this.player.x * TILE + TILE / 2, this.player.y * TILE + TILE / 2);
      pSpr.setVisible(this.player.isAlive);
    }

    const usedBars = new Set<string>();
    for (const enemy of this.enemies) {
      const spr = this.entitySprites.get(enemy.id);
      if (!spr) continue;

      if (enemy.isAlive && this.map.visible[enemy.y]?.[enemy.x]) {
        spr.setPosition(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2);
        spr.setVisible(true);

        let hpBar = this.enemyHpBars.get(enemy.id);
        if (!hpBar) {
          hpBar = this.add.graphics();
          hpBar.setDepth(20);
          this.enemyHpBars.set(enemy.id, hpBar);
        }
        usedBars.add(enemy.id);
        hpBar.clear();
        hpBar.setVisible(true);

        const bx = enemy.x * TILE;
        const by = enemy.y * TILE - 6;
        const bw = TILE;
        const bh = 3;
        const pct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        hpBar.fillStyle(0x000000, 0.6);
        hpBar.fillRect(bx, by, bw, bh);
        const barColor = pct > 0.6 ? 0x00ff88 : pct > 0.3 ? 0xffcc00 : 0xff4444;
        hpBar.fillStyle(barColor);
        if (pct > 0) hpBar.fillRect(bx + 1, by + 1, Math.floor((bw - 2) * Math.max(0.01, pct)), bh - 2);
      } else {
        spr.setVisible(false);
      }
    }

    for (const [id, bar] of this.enemyHpBars) {
      if (!usedBars.has(id)) bar.setVisible(false);
    }
  }

  private centerOnPlayer() {
    this.cameras.main.pan(
      this.player.x * TILE + TILE / 2,
      this.player.y * TILE + TILE / 2,
      80,
      'Sine.easeInOut',
    );
  }
}
