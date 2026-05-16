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
import { randomEnemyTemplate, BOSS_TEMPLATE } from '../data/enemies';
import { rollUpgrades } from '../data/upgrades';

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

  private tileRT!: Phaser.GameObjects.RenderTexture;
  private entitySprites = new Map<string, Phaser.GameObjects.Image>();
  private isAnimating = false;
  private moveCooldown = 0;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
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
    const wasd = this.input.keyboard!.addKeys('W,S,A,D') as { W: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
    const arrows = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT') as { UP: Phaser.Input.Keyboard.Key; DOWN: Phaser.Input.Keyboard.Key; LEFT: Phaser.Input.Keyboard.Key; RIGHT: Phaser.Input.Keyboard.Key };
    this.keyW = wasd.W;
    this.keyS = wasd.S;
    this.keyA = wasd.A;
    this.keyD = wasd.D;
    this.arrowUp = arrows.UP;
    this.arrowDown = arrows.DOWN;
    this.arrowLeft = arrows.LEFT;
    this.arrowRight = arrows.RIGHT;
    this.input.keyboard!.on('keydown', this.handleInput, this);
    window.addEventListener('keydown', this.globalRestart);
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

    if (this.isAnimating) return;
    if (!this.turnSystem?.isPlayerTurn) return;
    if (!this.player.isAlive) return;

    let dx = 0;
    let dy = 0;
    if (this.keyW.isDown || this.arrowUp.isDown) dy -= 1;
    if (this.keyS.isDown || this.arrowDown.isDown) dy += 1;
    if (this.keyA.isDown || this.arrowLeft.isDown) dx -= 1;
    if (this.keyD.isDown || this.arrowRight.isDown) dx += 1;

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
    if (this.tileRT) this.tileRT.destroy();

    const result = MapGen.generate(MAP_W, MAP_H);
    this.map = result.map;

    if (!this.player) {
      this.player = new Player(result.rooms[0].cx, result.rooms[0].cy);
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
    const floorMult = 1 + (this.player.floor - 1) * 0.075;

    const isBossFloor = this.player.floor % 5 === 0;
    this.bossRoomIdx = -1;
    if (isBossFloor && result.rooms.length > 2) {
      this.bossRoomIdx = 1 + Math.floor(Math.random() * (result.rooms.length - 1));
    }

    let chestRoomIdx = -1;
    if (!isBossFloor && Math.random() < 0.80) {
      chestRoomIdx = this.pickChestRoom(result.rooms);
      if (chestRoomIdx !== -1) {
        const r = result.rooms[chestRoomIdx];
        this.chests.set(`${r.cx},${r.cy}`, false);
      }
    }

    for (let i = 1; i < result.rooms.length; i++) {
      const r = result.rooms[i];
      if (r.cx === this.player.x && r.cy === this.player.y) continue;
      if (i === chestRoomIdx) continue;
      if (i === this.bossRoomIdx) {
        const scaled = {
          ...BOSS_TEMPLATE,
          hp: Math.ceil(this.player.maxHp * floorMult),
          attack: Math.ceil(this.player.defense * floorMult),
          defense: Math.ceil(this.player.attack * floorMult * 0.65),
        };
        this.enemies.push(new Enemy(scaled, r.cx, r.cy));
      } else {
        const t = randomEnemyTemplate();
        const scaled = {
          ...t,
          hp: Math.ceil(t.hp * floorMult),
          attack: Math.ceil(t.attack * floorMult),
          defense: Math.ceil(t.defense * floorMult),
        };
        this.enemies.push(new Enemy(scaled, r.cx, r.cy));
      }
    }

    this.tileRT = this.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.tileRT.setOrigin(0, 0);
    this.tileRT.setDepth(0);

    const playerSpr = this.add.image(0, 0, 'entity_player');
    playerSpr.setOrigin(0.5, 0.5).setDepth(10);
    this.entitySprites.set('player', playerSpr);

    for (const e of this.enemies) {
      const spr = this.add.image(0, 0, e.textureKey);
      spr.setOrigin(0.5, 0.5).setDepth(9);
      this.entitySprites.set(e.id, spr);
    }

    this.fov.compute(this.map, this.player.x, this.player.y);
    this.redrawRT();
    this.syncEntitySprites();
    this.centerOnPlayer();

    if (this.player.floor > 1) {
      this.messageLog.add(`--- /system/dir_${this.player.floor} ---`);
      if (this.player.floor % 5 === 0) {
        this.messageLog.add('*** WARNING: ROOTKIT DETECTED ***');
      }
    } else {
      this.messageLog.add('SYSTEM PURGE v0.1 — Kernel initialized.');
      this.messageLog.add('WASD/Arrows: move | Walk into enemies: attack');
    }

    this.isAnimating = false;
  }

  private openChest(x: number, y: number): void {
    const ck = `${x},${y}`;
    if (!this.chests.has(ck) || this.chests.get(ck)) return;

    this.chests.set(ck, true);
    const opts = rollUpgrades(this.player.acquiredUpgrades, 1);
    if (opts.length > 0) {
      const upg = opts[0];
      this.player.applyUpgrade(upg.id);
      this.messageLog.add(`Chest: ${upg.name} (${upg.description})`);
      this.fov = new FOVSystem(this.player.effectiveFov);

      this.scene.pause();
      this.scene.launch('Upgrade', {
        options: [upg],
        acquired: this.player.acquiredUpgrades,
        mode: 'reveal',
        onSelect: () => {
          this.scene.resume();
        },
      });
    } else {
      this.messageLog.add('Chest is empty.');
    }
  }

  private pickChestRoom(rooms: Room[]): number {
    const candidates: number[] = [];
    for (let i = 1; i < rooms.length; i++) {
      if (i === this.bossRoomIdx) continue;
      if (i === rooms.length - 1) continue;
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
        this.messageLog.add('*** ROOTKIT still active — eliminate it first ***');
        this.player.x = nx - dx;
        this.player.y = ny - dy;
        this.endTurn();
        return;
      }
      this.player.x = nx;
      this.player.y = ny;
      this.messageLog.add('Accessing next directory...');
      this.generateFloor();
      return;
    }

    this.player.x = nx;
    this.player.y = ny;

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

  private endTurn() {
    this.turnSystem.endPlayerTurn();

    this.fov.compute(this.map, this.player.x, this.player.y);

    this.processAdjacentAttacks();

    if (!this.player.isAlive) {
      this.messageLog.add('*** SYSTEM CRASHED — Press R to reboot ***');
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
    this.messageLog.add(`${enemy.name} was neutralized.`);

    if (enemy.textureKey === 'enemy_boss' && this.bossRoomIdx !== -1) {
      const bx = enemy.x;
      const by = enemy.y;
      this.chests.set(`${bx},${by}`, false);
      this.messageLog.add('A treasure chest materializes!');
    }

    const leveled = this.player.addXp(enemy.xpValue);
    if (leveled) {
      this.messageLog.add(`*** SYSTEM UPGRADE to v${this.player.level} ***`);
      this.showUpgradeChoices();
    }
  }

  private meleeAttack(attacker: Entity, defender: Entity) {
    const isPlayerDef = defender === this.player;

    if (isPlayerDef && this.player.hasDodge && Math.random() < 0.15) {
      this.messageLog.add(`Registry Cleaner deflected ${attacker.name}.`);
      return;
    }

    let dmg = Math.max(1, attacker.attack - defender.defense);

    if (isPlayerDef && this.player.hasEncryption) {
      dmg = Math.max(1, dmg - 3);
      this.player.encryptionLayerUsed = true;
      this.messageLog.add('Encryption Layer reduced damage by 3.');
    }

    const dealt = defender.takeDamage(dmg);
    this.messageLog.add(`${attacker.name} hits ${defender.name} for ${dealt} dmg.`);

    if (!isPlayerDef && dealt > 0) {
      const ls = this.player.lifeStealAmount;
      if (ls > 0 && Math.random() < 0.5) {
        this.player.heal(ls);
        this.messageLog.add(`Life Steal restored ${ls} HP.`);
      }
    }

    const rc = this.player.reflectChance;
    if (isPlayerDef && rc > 0 && dealt > 0 && Math.random() < rc) {
      const rdmg = attacker.takeDamage(2);
      if (rdmg > 0) this.messageLog.add(`Network Shield reflected ${rdmg} damage (${Math.round(rc * 100)}% chance).`);
      if (!attacker.isAlive && attacker instanceof Enemy) {
        this.onEnemyDeath(attacker);
      }
    }

    if (isPlayerDef && !defender.isAlive && this.player.hasFatalGuard) {
      defender.hp = 1;
      this.player.fatalGuardUsed = true;
      this.messageLog.add('Boot Sector Protection! Survived with 1 HP.');
    }

    if (!defender.isAlive && defender instanceof Enemy) {
      this.onEnemyDeath(defender);
    }
  }

  private showUpgradeChoices(): void {
    const options = rollUpgrades(this.player.acquiredUpgrades, 3);

    this.scene.pause();
    this.scene.launch('Upgrade', {
      options,
      acquired: this.player.acquiredUpgrades,
      onSelect: (id: string) => {
        this.player.applyUpgrade(id);
        this.fov = new FOVSystem(this.player.effectiveFov);
        this.fov.compute(this.map, this.player.x, this.player.y);
        this.redrawRT();
        this.syncEntitySprites();
        this.scene.resume();
      },
    });
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

  private processEnemyAI(): void {
    if (!this.player.isAlive) return;

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
          this.messageLog.add('*** SYSTEM CRASHED — Press R to reboot ***');
          return;
        }
      }
    }
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
  }

  private syncEntitySprites() {
    const pSpr = this.entitySprites.get('player');
    if (pSpr) {
      pSpr.setPosition(this.player.x * TILE + TILE / 2, this.player.y * TILE + TILE / 2);
      pSpr.setVisible(this.player.isAlive);
    }

    for (const enemy of this.enemies) {
      const spr = this.entitySprites.get(enemy.id);
      if (!spr) continue;

      if (enemy.isAlive && this.map.visible[enemy.y]?.[enemy.x]) {
        spr.setPosition(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2);
        spr.setVisible(true);
      } else {
        spr.setVisible(false);
      }
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
