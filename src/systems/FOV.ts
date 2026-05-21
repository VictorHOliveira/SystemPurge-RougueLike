import { FOV } from 'rot-js';
import { GameMap } from '../world/GameMap';

export class FOVSystem {
  private fov: any;
  private radius: number;
  private currentMap: GameMap | null = null;

  constructor(radius: number = 8) {
    this.radius = radius;
    this.fov = new FOV.PreciseShadowcasting(
      (x: number, y: number) => this.currentMap?.isTransparent(x, y) ?? true,
      { topology: 4 },
    );
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }

  compute(map: GameMap, ox: number, oy: number): void {
    this.currentMap = map;

    this.fov.compute(ox, oy, this.radius, (x: number, y: number, _r: number, visibility: number) => {
      if (visibility > 0 && map.isInBounds(x, y)) {
        map.visible[y][x] = true;
        map.explored[y][x] = true;
      }
    });
  }
}
