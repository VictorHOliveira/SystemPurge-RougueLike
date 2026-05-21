import { FOV } from 'rot-js';
import { GameMap } from '../world/GameMap';

export class FOVSystem {
  private fov: any;
  private radius: number;
  private lightPasses: (x: number, y: number) => boolean = () => true;

  constructor(radius: number = 8) {
    this.radius = radius;
    this.fov = new FOV.PreciseShadowcasting(
      (x: number, y: number) => this.lightPasses(x, y),
      { topology: 4 },
    );
  }

  setRadius(radius: number): void {
    this.radius = radius;
  }

  compute(map: GameMap, ox: number, oy: number): void {
    this.lightPasses = (x: number, y: number) => map.isTransparent(x, y);

    for (let y = -this.radius; y <= this.radius; y++) {
      for (let x = -this.radius; x <= this.radius; x++) {
        const tx = ox + x;
        const ty = oy + y;
        if (map.isInBounds(tx, ty)) {
          map.visible[ty][tx] = false;
        }
      }
    }

    this.fov.compute(ox, oy, this.radius, (x: number, y: number, _r: number, visibility: number) => {
      if (visibility > 0 && map.isInBounds(x, y)) {
        map.visible[y][x] = true;
        map.explored[y][x] = true;
      }
    });
  }
}
