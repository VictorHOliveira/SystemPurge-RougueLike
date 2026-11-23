import { FOV } from 'rot-js';
import { GameMap } from '../world/GameMap';
import { MAP_W } from '../constants';

interface FOVInstance {
  compute(x: number, y: number, radius: number, callback: (x: number, y: number, r: number, visibility: number) => void): void;
}

export class FOVSystem {
  private fov: FOVInstance;
  private radius: number;
  private currentMap: GameMap | null = null;
  private prevVisible = new Set<number>();

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

  compute(map: GameMap, ox: number, oy: number, onVisibilityChange?: (x: number, y: number) => void): void {
    this.currentMap = map;

    const nextVisible = new Set<number>();
    this.fov.compute(ox, oy, this.radius, (x, y, _r, visibility) => {
      if (visibility > 0 && map.isInBounds(x, y)) {
        const key = y * MAP_W + x;
        nextVisible.add(key);
        if (!map.visible[y][x]) {
          map.visible[y][x] = true;
          map.explored[y][x] = true;
          onVisibilityChange?.(x, y);
        }
      }
    });

    for (const key of this.prevVisible) {
      if (nextVisible.has(key)) continue;
      const x = key % MAP_W;
      const y = Math.floor(key / MAP_W);
      if (map.visible[y][x]) {
        map.visible[y][x] = false;
        onVisibilityChange?.(x, y);
      }
    }

    this.prevVisible = nextVisible;
  }
}
