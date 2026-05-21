import { describe, it, expect } from 'vitest';
import { isAdjacent, MAP_W, MAP_H, TILE, TRAP_DMG_MIN, TRAP_DMG_MAX } from '../constants';

describe('isAdjacent', () => {
  it('returns true for orthogonal neighbors', () => {
    expect(isAdjacent(0, 0, 0, 1)).toBe(true);
    expect(isAdjacent(0, 0, 1, 0)).toBe(true);
    expect(isAdjacent(5, 3, 5, 4)).toBe(true);
    expect(isAdjacent(5, 3, 4, 3)).toBe(true);
  });

  it('returns false for diagonal', () => {
    expect(isAdjacent(0, 0, 1, 1)).toBe(false);
  });

  it('returns false for same tile', () => {
    expect(isAdjacent(0, 0, 0, 0)).toBe(false);
  });

  it('returns false for distance > 1', () => {
    expect(isAdjacent(0, 0, 0, 2)).toBe(false);
  });
});

describe('map dimensions', () => {
  it('has positive size', () => {
    expect(MAP_W).toBeGreaterThan(0);
    expect(MAP_H).toBeGreaterThan(0);
  });

  it('has reasonable tile size', () => {
    expect(TILE).toBe(32);
  });
});

describe('trap damage', () => {
  it('has min <= max', () => {
    expect(TRAP_DMG_MIN).toBeLessThanOrEqual(TRAP_DMG_MAX);
  });
});
