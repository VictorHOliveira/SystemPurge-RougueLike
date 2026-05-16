import { Map } from 'rot-js';
import { GameMap, Room } from '../world/GameMap';
import { TileType } from '../data/tiles';

function isInRoom(x: number, y: number, rooms: Room[]): boolean {
  for (const room of rooms) {
    if (x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h) {
      return true;
    }
  }
  return false;
}

function countWalkableNeighbors(x: number, y: number, map: GameMap): number {
  let count = 0;
  if (map.isInBounds(x, y - 1) && map.tiles[y - 1][x] !== TileType.WALL) count++;
  if (map.isInBounds(x, y + 1) && map.tiles[y + 1][x] !== TileType.WALL) count++;
  if (map.isInBounds(x - 1, y) && map.tiles[y][x - 1] !== TileType.WALL) count++;
  if (map.isInBounds(x + 1, y) && map.tiles[y][x + 1] !== TileType.WALL) count++;
  return count;
}

function pruneDeadEnds(map: GameMap, rooms: Room[]): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.tiles[y][x] !== TileType.FLOOR) continue;
        if (isInRoom(x, y, rooms)) continue;
        if (countWalkableNeighbors(x, y, map) <= 1) {
          map.setTile(x, y, TileType.WALL);
          changed = true;
        }
      }
    }
  }
}

export interface MapGenResult {
  map: GameMap;
  rooms: GameMap['rooms'];
  stairsPos: { x: number; y: number };
}

function countRoomExits(room: Room, map: GameMap): number {
  let exits = 0;
  const topY = room.y - 1;
  for (let x = room.x; x < room.x + room.w; x++) {
    if (map.isInBounds(x, topY) && map.tiles[topY][x] === TileType.FLOOR) { exits++; break; }
  }
  const botY = room.y + room.h;
  for (let x = room.x; x < room.x + room.w; x++) {
    if (map.isInBounds(x, botY) && map.tiles[botY][x] === TileType.FLOOR) { exits++; break; }
  }
  const leftX = room.x - 1;
  for (let y = room.y; y < room.y + room.h; y++) {
    if (map.isInBounds(leftX, y) && map.tiles[y][leftX] === TileType.FLOOR) { exits++; break; }
  }
  const rightX = room.x + room.w;
  for (let y = room.y; y < room.y + room.h; y++) {
    if (map.isInBounds(rightX, y) && map.tiles[y][rightX] === TileType.FLOOR) { exits++; break; }
  }
  return exits;
}

function digCorridor(map: GameMap, x1: number, y1: number, x2: number, y2: number): void {
  let x = x1, y = y1;
  const horizFirst = Math.random() < 0.5;
  if (horizFirst) {
    while (x !== x2) {
      x += Math.sign(x2 - x);
      if (map.tiles[y][x] === TileType.WALL) map.setTile(x, y, TileType.FLOOR);
    }
    while (y !== y2) {
      y += Math.sign(y2 - y);
      if (map.tiles[y][x] === TileType.WALL) map.setTile(x, y, TileType.FLOOR);
    }
  } else {
    while (y !== y2) {
      y += Math.sign(y2 - y);
      if (map.tiles[y][x] === TileType.WALL) map.setTile(x, y, TileType.FLOOR);
    }
    while (x !== x2) {
      x += Math.sign(x2 - x);
      if (map.tiles[y][x] === TileType.WALL) map.setTile(x, y, TileType.FLOOR);
    }
  }
}

export class MapGen {
  static generate(width: number, height: number): MapGenResult {
    const gameMap = new GameMap(width, height);

    const digger = new Map.Digger(width, height, {
      roomWidth: [4, 10],
      roomHeight: [4, 8],
      corridorLength: [2, 5],
      dugPercentage: 0.25,
    });

    digger.create((x: number, y: number, value: number) => {
      gameMap.setTile(x, y, value === 0 ? TileType.FLOOR : TileType.WALL);
    });

    const rooms = digger.getRooms().map((r) => ({
      x: r.getLeft(),
      y: r.getTop(),
      w: r.getRight() - r.getLeft() + 1,
      h: r.getBottom() - r.getTop() + 1,
      cx: Math.floor(r.getCenter()[0]),
      cy: Math.floor(r.getCenter()[1]),
    }));

    gameMap.rooms = rooms;

    for (let i = 1; i < rooms.length - 1; i++) {
      if (countRoomExits(rooms[i], gameMap) >= 2) continue;
      let best = -1;
      let bestDist = Infinity;
      for (let j = 0; j < rooms.length; j++) {
        if (i === j) continue;
        const d = Math.abs(rooms[j].cx - rooms[i].cx) + Math.abs(rooms[j].cy - rooms[i].cy);
        if (d < bestDist) { bestDist = d; best = j; }
      }
      if (best !== -1) digCorridor(gameMap, rooms[i].cx, rooms[i].cy, rooms[best].cx, rooms[best].cy);
    }

    pruneDeadEnds(gameMap, rooms);

    const lastRoom = rooms[rooms.length - 1];
    const stairsPos = { x: lastRoom.cx, y: lastRoom.cy };
    gameMap.setTile(stairsPos.x, stairsPos.y, TileType.STAIRS_DOWN);

    return { map: gameMap, rooms, stairsPos };
  }
}
