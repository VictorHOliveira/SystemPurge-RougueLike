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
    const result = this.initMap(forceNewPlayer);
    const floorMult = 1 + (this.state.player.floor - 1) * 0.075;
    const occupiedPositions = new Set<string>();

    this.selectSpecialRooms(result.rooms);
    this.spawnEnemies(result.rooms, floorMult, occupiedPositions);

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y);
  }

  private initMap(forceNewPlayer: boolean): ReturnType<typeof MapGen.generate> {
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

    if (this.state.fov) {
      this.state.fov.setRadius(this.state.player.effectiveFov);
    } else {
      this.state.fov = new FOVSystem(this.state.player.effectiveFov);
    }
    this.state.turnSystem = new TurnSystem();
    this.state.messageLog = new MessageLog();
    this.state.enemies = [];
    this.state.chests.clear();
    this.state.altarUsed = false;

    return result;
  }

  private selectSpecialRooms(rooms: GameMap['rooms']) {
    const isBossFloor = this.state.player.floor % 10 === 0;
    const isMinibossFloor = !isBossFloor && this.state.player.floor % 3 === 0;
    this.state.bossRoomIdx = -1;
    this.state.minibossRoomIdx = -1;
    this.state.trapRoomIdx = -1;
    this.state.altarRoomIdx = -1;

    if (isBossFloor && rooms.length > 2) {
      this.state.bossRoomIdx = 1 + Math.floor(Math.random() * (rooms.length - 1));
    } else if (isMinibossFloor && rooms.length > 2) {
      this.state.minibossRoomIdx = 1 + Math.floor(Math.random() * (rooms.length - 1));
    }

    if (!isBossFloor) {
      this.state.trapRoomIdx = this.pickSpecialRoom(rooms, [this.state.bossRoomIdx, this.state.minibossRoomIdx]);
      this.state.altarRoomIdx = this.pickSpecialRoom(rooms, [this.state.bossRoomIdx, this.state.minibossRoomIdx, this.state.trapRoomIdx]);
    }

    if (!isBossFloor && Math.random() < 0.80) {
      const chestRoomIdx = this.pickSpecialRoom(rooms, [
        this.state.bossRoomIdx, this.state.minibossRoomIdx,
        this.state.trapRoomIdx, this.state.altarRoomIdx,
      ]);
      if (chestRoomIdx !== -1) {
        const r = rooms[chestRoomIdx];
        this.state.chests.set(`${r.cx},${r.cy}`, false);
      }
    }
  }

  private spawnEnemies(rooms: GameMap['rooms'], floorMult: number, occupiedPositions: Set<string>) {
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      if (r.cx === this.state.player.x && r.cy === this.state.player.y) continue;

      this.placeRoomFeatures(r, i);
      const spawnCount = this.getSpawnCount(r, i);

      for (let e = 0; e < spawnCount; e++) {
        const pos = this.randomSpawnPos(r, e, occupiedPositions);
        occupiedPositions.add(`${pos.x},${pos.y}`);
        this.createEnemy(pos, i, floorMult);
      }
    }
  }

  private placeRoomFeatures(r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, idx: number) {
    if (this.state.altarRoomIdx !== -1 && idx === this.state.altarRoomIdx) {
      this.state.map.setTile(r.cx, r.cy, TileType.ALTAR);
    }
    if (this.state.trapRoomIdx !== -1 && idx === this.state.trapRoomIdx) {
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
  }

  private getSpawnCount(r: { cx: number; cy: number }, idx: number): number {
    const isBossRoom = idx === this.state.bossRoomIdx;
    const isMinibossRoom = idx === this.state.minibossRoomIdx;
    const extraCount = (isBossRoom || isMinibossRoom) ? 0 : Math.floor((this.state.player.floor - 1) / 4);
    return 1 + extraCount;
  }

  private randomSpawnPos(r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, eIdx: number, occupiedPositions: Set<string>): { x: number; y: number } {
    if (eIdx === 0) return { x: r.cx, y: r.cy };
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2));
      const ty = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
      if (!occupiedPositions.has(`${tx},${ty}`)) return { x: tx, y: ty };
    }
    return { x: r.cx, y: r.cy };
  }

  private createEnemy(pos: { x: number; y: number }, roomIdx: number, floorMult: number) {
    if (roomIdx === this.state.bossRoomIdx) {
      const scaled = {
        ...BOSS_TEMPLATE,
        hp: Math.ceil(BOSS_TEMPLATE.hp * floorMult + this.state.player.maxHp * 1.2),
        attack: Math.ceil(BOSS_TEMPLATE.attack * floorMult + this.state.player.effectiveAtk * 1.5),
        defense: Math.ceil(BOSS_TEMPLATE.defense * floorMult + this.state.player.effectiveDef * 1.2),
      };
      this.state.enemies.push(new Enemy(scaled, pos.x, pos.y));
    } else if (roomIdx === this.state.minibossRoomIdx) {
      const scaled = {
        ...MINIBOSS_TEMPLATE,
        hp: Math.ceil(MINIBOSS_TEMPLATE.hp * floorMult + this.state.player.maxHp * 0.25),
        attack: Math.ceil(MINIBOSS_TEMPLATE.attack * floorMult + this.state.player.effectiveAtk * 0.35),
        defense: Math.ceil(MINIBOSS_TEMPLATE.defense * floorMult + this.state.player.effectiveDef * 0.3),
      };
      this.state.enemies.push(new Enemy(scaled, pos.x, pos.y));
    } else {
      const t = randomEnemyTemplate();
      const scaled = {
        ...t,
        hp: Math.ceil(t.hp * floorMult + this.state.player.maxHp * 0.15),
        attack: Math.ceil(t.attack * floorMult + this.state.player.effectiveAtk * 0.25),
        defense: Math.ceil(t.defense * floorMult + this.state.player.effectiveDef * 0.2),
      };
      this.state.enemies.push(new Enemy(scaled, pos.x, pos.y));
    }
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
