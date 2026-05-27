import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H } from '../constants';
import { TileType } from '../data/tiles';
import { FRAGMENT_TEMPLATE, randomEnemyTemplate, BOSS_TEMPLATE, MINIBOSS_TEMPLATE } from '../data/enemies';
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

  generateFloor(forceNewPlayer: boolean = false, startFloor: number = 0) {
    const result = this.initMap(forceNewPlayer, startFloor);
    const floorMult = 1 + (this.state.player.floor - 1) * 0.075;
    const occupiedPositions = new Set<number>();
    const corridorTiles = this.collectCorridorTiles(result.rooms);

    this.selectSpecialRooms(result.rooms);
    this.spawnEnemies(result.rooms, corridorTiles, floorMult, occupiedPositions);
    this.scatterTraps(result.rooms, occupiedPositions);

    this.state.fov.compute(this.state.map, this.state.player.x, this.state.player.y);
  }

  spawnFragments(x: number, y: number) {
    const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let spawned = 0;
    for (const [dx, dy] of dirs) {
      if (spawned >= 2) break;
      const nx = x + dx;
      const ny = y + dy;
      if (this.state.map.isInBounds(nx, ny) && this.state.map.tiles[ny][nx] === TileType.FLOOR) {
        const e = new Enemy(FRAGMENT_TEMPLATE, nx, ny);
        e.setTarget(this.state.player.x, this.state.player.y);
        this.state.enemies.push(e);
        spawned++;
      }
    }
  }

  private collectCorridorTiles(rooms: GameMap['rooms']): { x: number; y: number }[] {
    const inRoom: boolean[][] = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(false));
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (this.state.map.isInBounds(x, y)) inRoom[y][x] = true;
        }
      }
    }
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (this.state.map.tiles[y][x] === TileType.FLOOR && !inRoom[y][x]) {
          tiles.push({ x, y });
        }
      }
    }
    return tiles;
  }

  private initMap(forceNewPlayer: boolean, startFloor: number = 0): ReturnType<typeof MapGen.generate> {
    Enemy.resetId();
    const result = MapGen.generate(MAP_W, MAP_H);
    this.state.map = result.map;

    const classDef = getClassById(this.state.classId);

    if (!this.state.player || forceNewPlayer) {
      this.state.player = new Player(classDef, result.rooms[0].cx, result.rooms[0].cy);
      if (startFloor > 1) {
        this.state.player.floor = startFloor;
      }
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
    this.state.altarRoomIdx = -1;

    if (isBossFloor && rooms.length > 2) {
      this.state.bossRoomIdx = 1 + Math.floor(Math.random() * (rooms.length - 1));
    } else if (isMinibossFloor && rooms.length > 2) {
      this.state.minibossRoomIdx = 1 + Math.floor(Math.random() * (rooms.length - 1));
    }

    if (!isBossFloor) {
      this.state.altarRoomIdx = this.pickSpecialRoom(rooms, [this.state.bossRoomIdx, this.state.minibossRoomIdx]);
    }

    if (!isBossFloor && Math.random() < 0.80) {
      const chestRoomIdx = this.pickSpecialRoom(rooms, [
        this.state.bossRoomIdx, this.state.minibossRoomIdx,
        this.state.altarRoomIdx,
      ]);
      if (chestRoomIdx !== -1) {
        const r = rooms[chestRoomIdx];
        this.state.chests.set(`${r.cx},${r.cy}`, false);
      }
    }
  }

  private spawnEnemies(rooms: GameMap['rooms'], corridorTiles: { x: number; y: number }[], floorMult: number, occupiedPositions: Set<number>) {
    for (let i = 1; i < rooms.length; i++) {
      const r = rooms[i];
      if (r.cx === this.state.player.x && r.cy === this.state.player.y) continue;

      this.placeRoomFeatures(r, i);
      const spawnCount = this.getSpawnCount(i);

      for (let e = 0; e < spawnCount; e++) {
        const pos = this.randomSpawnPos(r, e, occupiedPositions);
        occupiedPositions.add(pos.y * MAP_W + pos.x);
        this.createEnemy(pos, i, floorMult);
      }
    }

    this.spawnCorridorEnemies(corridorTiles, occupiedPositions, floorMult);
  }

  private spawnCorridorEnemies(corridorTiles: { x: number; y: number }[], occupiedPositions: Set<number>, floorMult: number) {
    const corridorCount = Math.floor(this.state.player.floor / 5);
    if (corridorCount === 0) return;

    const shuffled = [...corridorTiles].sort(() => Math.random() - 0.5);
    let placed = 0;
    for (const tile of shuffled) {
      if (placed >= corridorCount) break;
      const key = tile.y * MAP_W + tile.x;
      if (!occupiedPositions.has(key)) {
        occupiedPositions.add(key);
        this.createEnemy(tile, -1, floorMult);
        placed++;
      }
    }
  }

  private scatterTraps(rooms: GameMap['rooms'], occupiedPositions: Set<number>) {
    const trapCount = 2 + Math.floor(this.state.player.floor / 2);
    const selected: { x: number; y: number }[] = [];

    const startRoom = rooms[0];
    const map = this.state.map;
    let scanned = 0;

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (map.tiles[y][x] !== TileType.FLOOR) continue;
        if (occupiedPositions.has(y * MAP_W + x)) continue;
        if (x >= startRoom.x && x < startRoom.x + startRoom.w && y >= startRoom.y && y < startRoom.y + startRoom.h) continue;
        scanned++;
        if (selected.length < trapCount) {
          selected.push({ x, y });
        } else {
          const j = Math.floor(Math.random() * scanned);
          if (j < trapCount) selected[j] = { x, y };
        }
      }
    }

    for (const t of selected) {
      map.setTile(t.x, t.y, TileType.TRAP);
      occupiedPositions.add(t.y * MAP_W + t.x);
    }
  }

  private placeRoomFeatures(r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, idx: number) {
    if (this.state.altarRoomIdx !== -1 && idx === this.state.altarRoomIdx) {
      this.state.map.setTile(r.cx, r.cy, TileType.ALTAR);
    }
  }

  private getSpawnCount(idx: number): number {
    const isBossRoom = idx === this.state.bossRoomIdx;
    const isMinibossRoom = idx === this.state.minibossRoomIdx;
    if (isBossRoom || isMinibossRoom) return 0;
    return Math.min(5, 1 + Math.floor(this.state.player.floor / 3));
  }

  private randomSpawnPos(r: { x: number; y: number; w: number; h: number; cx: number; cy: number }, eIdx: number, occupiedPositions: Set<number>): { x: number; y: number } {
    if (eIdx === 0) return { x: r.cx, y: r.cy };
    const maxX = Math.max(1, r.w - 2);
    const maxY = Math.max(1, r.h - 2);
    for (let attempt = 0; attempt < 10; attempt++) {
      const tx = r.x + 1 + Math.floor(Math.random() * maxX);
      const ty = r.y + 1 + Math.floor(Math.random() * maxY);
      if (!occupiedPositions.has(ty * MAP_W + tx)) return { x: tx, y: ty };
    }
    return { x: r.cx, y: r.cy };
  }

  private createEnemy(pos: { x: number; y: number }, roomIdx: number, floorMult: number) {
    if (roomIdx === this.state.bossRoomIdx) {
      const floor = this.state.player.floor;
      const scaled = {
        ...BOSS_TEMPLATE,
        hp: Math.ceil(BOSS_TEMPLATE.hp * floorMult + floor * 5),
        attack: Math.ceil(BOSS_TEMPLATE.attack * floorMult + floor * 2),
        defense: Math.ceil(BOSS_TEMPLATE.defense * floorMult + floor * 0.5),
      };
      const e = new Enemy(scaled, pos.x, pos.y);
      e.setTarget(this.state.player.x, this.state.player.y);
      this.state.enemies.push(e);
    } else if (roomIdx === this.state.minibossRoomIdx) {
      const floor = this.state.player.floor;
      const scaled = {
        ...MINIBOSS_TEMPLATE,
        hp: Math.ceil(MINIBOSS_TEMPLATE.hp * floorMult + floor * 3),
        attack: Math.ceil(MINIBOSS_TEMPLATE.attack * floorMult + floor * 1),
        defense: Math.ceil(MINIBOSS_TEMPLATE.defense * floorMult + floor * 0.3),
      };
      const e = new Enemy(scaled, pos.x, pos.y);
      e.setTarget(this.state.player.x, this.state.player.y);
      this.state.enemies.push(e);
    } else {
      const floor = this.state.player.floor;
      const t = randomEnemyTemplate(floor);
      const scaled = {
        ...t,
        hp: Math.ceil(t.hp * floorMult + floor * 1.5),
        attack: Math.ceil(t.attack * floorMult + floor * 0.5),
        defense: Math.ceil(t.defense * floorMult + floor * 0.2),
      };
      const e = new Enemy(scaled, pos.x, pos.y);
      if (roomIdx !== -1 && Math.random() < 0.15) {
        e.isElite = true;
        e.maxHp = Math.ceil(e.maxHp * 1.5);
        e.hp = e.maxHp;
        e.attack = Math.ceil(e.attack * 1.3);
        e.defense = Math.ceil(e.defense * 1.2);
      }
      e.setTarget(this.state.player.x, this.state.player.y);
      this.state.enemies.push(e);
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
