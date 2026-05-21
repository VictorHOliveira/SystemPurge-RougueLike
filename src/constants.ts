export const MAP_W = 60;
export const MAP_H = 40;
export const TILE = 32;
export const MOVE_COOLDOWN_BASE = 120;
export const TWEEN_DURATION_BASE = 60;

export function isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}
