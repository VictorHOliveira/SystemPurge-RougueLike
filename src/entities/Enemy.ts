import { Entity } from './Entity';
import { EnemyTemplate, type EnemyBehavior } from '../data/enemies';

let nextId = 1;

export class Enemy extends Entity {
  static resetId() { nextId = 1; }

  xpValue: number;
  behavior: EnemyBehavior;
  isElite: boolean = false;
  splitOnDeath?: string;
  skipNextTurn: boolean = false;

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
    this.behavior = template.behavior;
    this.splitOnDeath = template.splitOnDeath;
  }

  takeTurn(
    playerX: number,
    playerY: number,
    canSeePlayer: boolean,
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    if (this.skipNextTurn) {
      this.skipNextTurn = false;
      return;
    }
    this.targetX = playerX;
    this.targetY = playerY;

    if (this.behavior === 'ranged') {
      this.rangedTurn(playerX, playerY, canSeePlayer, isWalkable, isOccupied);
      return;
    }
    if (this.behavior === 'suicide') {
      this.suicideTurn(playerX, playerY, canSeePlayer, isWalkable, isOccupied);
      return;
    }
    this.defaultTurn(canSeePlayer, isWalkable, isOccupied);
  }

  private defaultTurn(
    canSeePlayer: boolean,
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    if (!canSeePlayer) {
      this.wander(isWalkable, isOccupied);
      return;
    }
    this.moveToward(isWalkable, isOccupied);
  }

  private rangedTurn(
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
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.max(Math.abs(dx), Math.abs(dy));

    if (dist < 3) {
      const moveDx = Math.sign(dx) * -1;
      const moveDy = Math.sign(dy) * -1;
      const nx = this.x + moveDx;
      const ny = this.y + moveDy;
      if (isWalkable(nx, ny) && !isOccupied(nx, ny)) {
        this.x = nx;
        this.y = ny;
        return;
      }
      const moves: [number, number][] = [];
      if (moveDx !== 0) moves.push([moveDx, 0]);
      if (moveDy !== 0) moves.push([0, moveDy]);
      for (const [mx, my] of moves) {
        const nnx = this.x + mx;
        const nny = this.y + my;
        if (isWalkable(nnx, nny) && !isOccupied(nnx, nny)) {
          this.x = nnx;
          this.y = nny;
          return;
        }
      }
    }
  }

  private suicideTurn(
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
    this.moveToward(isWalkable, isOccupied);
  }

  private moveToward(
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    const tx = this.targetX;
    const ty = this.targetY;
    const dx = Math.sign(tx - this.x);
    const dy = Math.sign(ty - this.y);

    const moves: [number, number][] = [];
    if (dx !== 0 && dy !== 0) moves.push([dx, dy]);
    if (dx !== 0) moves.push([dx, 0]);
    if (dy !== 0) moves.push([0, dy]);

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

  private targetX = 0;
  private targetY = 0;

  setTarget(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  private wander(
    isWalkable: (x: number, y: number) => boolean,
    isOccupied: (x: number, y: number) => boolean,
  ): void {
    const dirs: [number, number][] = [
      [0, -1], [0, 1], [-1, 0], [1, 0],
    ];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy] of dirs) {
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
