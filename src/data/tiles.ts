export enum TileType {
  WALL = 0,
  FLOOR = 1,
  STAIRS_DOWN = 2,
  STAIRS_UP = 3,
  TRAP = 4,
  ALTAR = 5,
  BURNED = 6,
}

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
  return type === TileType.FLOOR || type === TileType.STAIRS_DOWN || type === TileType.STAIRS_UP || type === TileType.TRAP || type === TileType.ALTAR || type === TileType.BURNED;
}

export function tileIsTransparent(type: TileType): boolean {
  return type === TileType.FLOOR || type === TileType.STAIRS_DOWN || type === TileType.STAIRS_UP || type === TileType.TRAP || type === TileType.ALTAR || type === TileType.BURNED;
}
