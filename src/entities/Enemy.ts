import { Entity } from './Entity';
import { EnemyTemplate } from '../data/enemies';

let nextId = 1;

export class Enemy extends Entity {
  xpValue: number;

  constructor(template: EnemyTemplate, x: number, y: number) {
    super(
      `enemy_${nextId++}`,
      template.name,
      x,
      y,
      template.hp,
      template.attack,
      template.defense,
      template.textureKey,
    );
    this.xpValue = Math.max(1, template.hp + template.attack);
  }

  takeTurn(
    playerX: number,
    playerY: number,
    canSeePlayer: boolean,
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    if (!canSeePlayer) {
      this.wander(isWalkable, isOccupied);
      return;
    }
    this.moveToward(playerX, playerY, isWalkable, isOccupied);
  }

  private moveToward(
    tx: number,
    ty: number,
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    const dx = Math.sign(tx - this.x);
    const dy = Math.sign(ty - this.y);

    const moves: [number, number][] = [];
    if (dx !== 0) moves.push([dx, 0]);
    if (dy !== 0) moves.push([0, dy]);
    if (dx !== 0 && dy !== 0) moves.push([dx, dy]);

    for (const [mx, my] of moves) {
      const nx = this.x + mx;
      const ny = this.y + my;
      if (isWalkable(nx, ny) && !isOccupied(nx, ny)) {
        this.x = nx;
        this.y = ny;
        return;
      }
    }
  }

  private wander(
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    const dirs: [number, number][] = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
    ];
    const shuffled = dirs.sort(() => Math.random() - 0.5);
    for (const [dx, dy] of shuffled) {
      const nx = this.x + dx;
      const ny = this.y + dy;
      if (isWalkable(nx, ny) && !isOccupied(nx, ny)) {
        this.x = nx;
        this.y = ny;
        return;
      }
    }
  }
}
