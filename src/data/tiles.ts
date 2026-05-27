export enum TileType {
  WALL = 0,
  FLOOR = 1,
  STAIRS_DOWN = 2,
  STAIRS_UP = 3,
  TRAP = 4,
  ALTAR = 5,
  BURNED = 6,
}

const WALKABLE_TILES = new Set([TileType.FLOOR, TileType.STAIRS_DOWN, TileType.STAIRS_UP, TileType.TRAP, TileType.ALTAR, TileType.BURNED]);
const TRANSPARENT_TILES = new Set([TileType.FLOOR, TileType.STAIRS_DOWN, TileType.STAIRS_UP, TileType.TRAP, TileType.ALTAR, TileType.BURNED]);

export function tileName(type: TileType): string {
  switch (type) {
    case TileType.WALL: return 'wall';
    case TileType.FLOOR: return 'floor';
    case TileType.STAIRS_DOWN: return 'stairs';
    case TileType.STAIRS_UP: return 'stairs_up';
    case TileType.TRAP: return 'trap';
    case TileType.ALTAR: return 'altar';
    case TileType.BURNED: return 'burned';
  }
}

export function tileIsWalkable(type: TileType): boolean {
  return WALKABLE_TILES.has(type);
}

export function tileIsTransparent(type: TileType): boolean {
  return TRANSPARENT_TILES.has(type);
}
