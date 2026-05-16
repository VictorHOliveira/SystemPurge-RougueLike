import { TileType, tileIsWalkable, tileIsTransparent } from '../data/tiles';

export interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export class GameMap {
  width: number;
  height: number;
  tiles: TileType[][];
  explored: boolean[][];
  visible: boolean[][];
  rooms: Room[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.rooms = [];

    this.tiles = [];
    this.explored = [];
    this.visible = [];

    for (let y = 0; y < height; y++) {
      this.tiles[y] = [];
      this.explored[y] = [];
      this.visible[y] = [];
      for (let x = 0; x < width; x++) {
        this.tiles[y][x] = TileType.WALL;
        this.explored[y][x] = false;
        this.visible[y][x] = false;
      }
    }
  }

  isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return tileIsWalkable(this.tiles[y][x]);
  }

  isTransparent(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    return tileIsTransparent(this.tiles[y][x]);
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  setTile(x: number, y: number, type: TileType): void {
    if (this.isInBounds(x, y)) {
      this.tiles[y][x] = type;
    }
  }
}
