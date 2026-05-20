import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H } from '../constants';
import { TileType } from '../data/tiles';
import { randomEnemyTemplate, BOSS_TEMPLATE, MINIBOSS_TEMPLATE } from '../data/enemies';
import { getClassById } from '../data/classes';
import { Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { FOVSystem } from './FOV';
import { TurnSystem } from './TurnSystem';
import { MessageLog } from '../ui/MessageLog';
import { MapGen } from './MapGen';
import { GameMap } from '../world/GameMap';

export class FloorGenerator {
  private scene: Phaser.Scene;
  private state: GameState;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene;
    this.state = state;
  }

  generateFloor(forceNewPlayer: boolean = false) {
    Enemy.resetId();
    const result = MapGen.generate(MAP_W, MAP_H);
    this.state.map = result.map;

    const classDef = getClassById(this.state.classId);

    if (!this.state.player || forceNewPlayer) {
      this.state.player = new Player(classDef, result.rooms[0].cx, result.rooms[0].cy);
    } else {
      this.state.player.x = result.rooms[0].cx;
      this.state.player.y = result.rooms[0].cy;
      this.state.player.floor++;
      this.state.player.onNewFloor();
    }

    if (this.state.player.floor > 1) {
      this.state.map.setTile(result.rooms[0].cx, result.rooms[0].cy, TileType.STAIRS_UP);
    }

    this.state.fov = new FOVSystem(this.state.player.effectiveFov);
    this.state.turnSystem = new TurnSystem();
    this.state.messageLog = new MessageLog();

    this.state.enemies = [];
    this.state.chests.clear();
    this.state.altarUsed = false;
    const floorMult = 1 + (this.state.player.floor - 1) * 0.075;

    const isBossFloor = this.state.player.floor % 10 === 0;
    const isMinibossFloor = !isBossFloor && this.state.player.floor % 3 === 0;
    this.state.bossRoomIdx = -1;
    this.state.minibossRoomIdx = -1;
    this.state.trapRoomIdx = -1;
    this.state.altarRoomIdx = -1;

    if (isBossFloor && result.rooms.length > 2) {
      this.state.bossRoomIdx = 1 + Math.floor(Math.random() * (result.rooms.length - 1));
    } else if (isMinibossFloor && result.rooms.length > 2) {
      this.state.minibossRoomIdx = 1 + Math.floor(Math.random() * (result.rooms.length - 1));
    }

    if (!isBossFloor) {
      this.state.trapRoomIdx = this.pickSpecialRoom(result.rooms, [this.state.bossRoomIdx, this.state.minibossRoomIdx]);
      this.state.altarRoomIdx = this.pickSpecialRoom(result.rooms, [this.state.bossRoomIdx, this.state.minibossRoomIdx, this.state.trapRoomIdx]);
    }

    let chestRoomIdx = -1;
    if (!isBossFloor && Math.random() < 0.80) {
      chestRoomIdx = this.pickSpecialRoom(result.rooms, [
        this.state.bossRoomIdx, this.state.minibossRoomIdx,
        this.state.trapRoomIdx, this.state.altarRoomIdx,
      ]);
      if (chestRoomIdx !== -1) {
        const r = result.rooms[chestRoomIdx];
        this.state.chests.set(`${r.cx},${r.cy}`, false);
      }
    }

    for (let i = 1; i < result.rooms.length; i++) {
      const r = result.rooms[i];
      if (r.cx === this.state.player.x && r.cy === this.state.player.y) continue;
      if (this.state.altarRoomIdx !== -1 && i === this.state.altarRoomIdx) {
        this.state.map.setTile(r.cx, r.cy, TileType.ALTAR);
      }
      if (this.state.trapRoomIdx !== -1 && i === this.state.trapRoomIdx) {
        const trapCount = Phaser.Math.Between(3, 5);
        for (let t = 0; t < trapCount; t++) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
            const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
            if (this.state.map.tiles[ty][tx] === TileType.FLOOR) {
              this.state.map.setTile(tx, ty, TileType.TRAP);
              break;
            }
          }
        }
      }

      const isBossRoom = i === this.state.bossRoomIdx;
      const isMinibossRoom = i === this.state.minibossRoomIdx;
      const extraCount = (isBossRoom || isMinibossRoom) ? 0 : Math.floor((this.state.player.floor - 1) / 4);
      const spawnCount = 1 + extraCount;

      for (let e = 0; e < spawnCount; e++) {
        let ex = r.cx;
        let ey = r.cy;
        if (e > 0) {
          for (let attempt = 0; attempt < 10; attempt++) {
            const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
            const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
            if (!this.state.enemies.some(en => en.x === tx && en.y === ty)) {
              ex = tx;
              ey = ty;
              break;
            }
          }
        }

        if (isBossRoom) {
          const scaled = {
            ...BOSS_TEMPLATE,
            hp: Math.ceil(BOSS_TEMPLATE.hp * floorMult + this.state.player.maxHp * 1.2),
            attack: Math.ceil(BOSS_TEMPLATE.attack * floorMult + this.state.player.effectiveAtk * 1.5),
            defense: Math.ceil(BOSS_TEMPLATE.defense * floorMult + this.state.player.effectiveDef * 1.2),
          };
          this.state.enemies.push(new Enemy(scaled, ex, ey));
        } else if (isMinibossRoom) {
          const scaled = {
            ...MINIBOSS_TEMPLATE,
            hp: Math.ceil(MINIBOSS_TEMPLATE.hp * floorMult + this.state.player.maxHp * 0.25),
            attack: Math.ceil(MINIBOSS_TEMPLATE.attack * floorMult + this.state.player.effectiveAtk * 0.35),
            defense: Math.ceil(MINIBOSS_TEMPLATE.defense * floorMult + this.state.player.effectiveDef * 0.3),
          };
          this.state.enemies.push(new Enemy(scaled, ex, ey));
        } else {
          const t = randomEnemyTemplate();
          const scaled = {
            ...t,
            hp: Math.ceil(t.hp * floorMult + this.state.player.maxHp * 0.15),
            attack: Math.ceil(t.attack * floorMult + this.state.player.effectiveAtk * 0.25),
            defense: Math.ceil(t.defense * floorMult + this.state.player.effectiveDef * 0.2),
          };
          this.state.enemies.push(new Enemy(scaled, ex, ey));
        }
      }
    }

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y);
  }

  private pickSpecialRoom(rooms: GameMap['rooms'], exclude: number[]): number {
    const candidates: number[] = [];
    for (let i = 1; i < rooms.length - 1; i++) {
      if (exclude.includes(i)) continue;
      const r = rooms[i];
      if (this.state.player && r.cx === this.state.player.x && r.cy === this.state.player.y) continue;
      candidates.push(i);
    }
    if (candidates.length === 0) return -1;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}
