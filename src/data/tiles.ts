export enum TileType {
  WALL = 0,
  FLOOR = 1,
  STAIRS_DOWN = 2,
  STAIRS_UP = 3,
}

export function tileName(type: TileType): string {
  switch (type) {
    case TileType.WALL: return 'wall';
    case TileType.FLOOR: return 'floor';
    case TileType.STAIRS_DOWN: return 'stairs';
    case TileType.STAIRS_UP: return 'stairs_up';
  }
}

export function tileIsWalkable(type: TileType): boolean {
  return type === TileType.FLOOR || type === TileType.STAIRS_DOWN || type === TileType.STAIRS_UP;
}

export function tileIsTransparent(type: TileType): boolean {
  return type === TileType.FLOOR || type === TileType.STAIRS_DOWN || type === TileType.STAIRS_UP;
}
