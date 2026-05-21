export const MAP_W = 60;
export const MAP_H = 40;
export const TILE = 32;
export const MOVE_COOLDOWN_BASE = 120;
export const TWEEN_DURATION_BASE = 60;

export const TRAP_DMG_MIN = 2;
export const TRAP_DMG_MAX = 4;
export const BLEED_DAMAGE = 1;
export const BLEED_TICKS = 3;
export const LAMINA_BLEED_DMG = 1;
export const LAMINA_BLEED_TICKS = 3;
export const DOT_RANGE = 3;
export const AOE_DAMAGE = 8;
export const OVERCLOCK_ATK_BONUS = 5;
export const OVERCLOCK_DURATION = 5;
export const DEFRAG_DEF_BONUS = 5;
export const DEFRAG_DURATION = 5;
export const NETWORK_PULSE_DMG = 6;
export const HEALTH_PATCH_HEAL = 15;
export const REFLECT_DAMAGE = 2;
export const ENCRYPTION_REDUCTION = 3;

export function isAdjacent(ax: number, ay: number, bx: number, by: number): boolean {
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function parseChestKey(key: string): [number, number] {
  const [x, y] = key.split(',').map(Number);
  return [x, y];
}
