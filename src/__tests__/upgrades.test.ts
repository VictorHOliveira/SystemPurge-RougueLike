import { describe, it, expect, vi } from 'vitest';
import { ALL_UPGRADES, rollUpgrades, rollRewards } from '../data/upgrades';

describe('ALL_UPGRADES', () => {
  it('has at least some upgrades', () => {
    expect(ALL_UPGRADES.length).toBeGreaterThan(20);
  });

  it('has no duplicate ids', () => {
    const ids = ALL_UPGRADES.map(u => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every upgrade has required fields', () => {
    for (const u of ALL_UPGRADES) {
      expect(u.id).toBeTruthy();
      expect(u.name).toBeTruthy();
      expect(u.description).toBeTruthy();
      expect(['stat', 'passive']).toContain(u.category);
    }
  });
});

describe('rollUpgrades', () => {
  it('excludes already acquired unique upgrades', () => {
    const acquired = new Map<string, number>([['registry_cleaner', 1]]);
    const result = rollUpgrades(acquired, 100, 'limpador');
    expect(result.some(u => u.id === 'registry_cleaner')).toBe(false);
  });

  it('excludes upgrades beyond maxLevel', () => {
    const acquired = new Map<string, number>([['speed_boost', 3]]);
    const result = rollUpgrades(acquired, 100, 'limpador');
    expect(result.some(u => u.id === 'speed_boost')).toBe(false);
  });

  it('includes upgradable items not at maxLevel', () => {
    const acquired = new Map<string, number>([['speed_boost', 2]]);
    const result = rollUpgrades(acquired, 100, 'limpador');
    expect(result.some(u => u.id === 'speed_boost')).toBe(true);
  });

  it('excludes upgrades for other classes', () => {
    const result = rollUpgrades(new Map(), 100, 'limpador');
    expect(result.some(u => u.classId === 'muralha')).toBe(false);
    expect(result.some(u => u.classId === 'ping_sniper')).toBe(false);
    expect(result.some(u => u.classId === 'daemon')).toBe(false);
  });

  it('respects count parameter', () => {
    const result = rollUpgrades(new Map(), 3, 'limpador');
    expect(result.length).toBe(3);
  });
});

describe('rollRewards', () => {
  it('returns RewardOption array', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const result = rollRewards(new Map(), 0, 3, 'limpador');
    for (const r of result) {
      expect(r).toHaveProperty('kind');
      expect(r).toHaveProperty('id');
      expect(['upgrade', 'item']).toContain(r.kind);
    }
    vi.restoreAllMocks();
  });

  it('includes items when slots available', () => {
    const result = rollRewards(new Map(), 3, 100, 'limpador');
    expect(result.some(r => r.kind === 'item')).toBe(true);
  });

  it('excludes items when no slots', () => {
    const result = rollRewards(new Map(), 0, 10, 'limpador');
    expect(result.every(r => r.kind === 'upgrade')).toBe(true);
  });

  it('does not exceed count', () => {
    const result = rollRewards(new Map(), 0, 2, 'limpador');
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
