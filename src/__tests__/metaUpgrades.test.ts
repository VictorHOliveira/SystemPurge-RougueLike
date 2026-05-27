import { describe, it, expect } from 'vitest';
import { META_UPGRADES, getMetaCost } from '../data/metaUpgrades';
import { Player } from '../entities/Player';
import { getClassById } from '../data/classes';

describe('META_UPGRADES', () => {
  it('has no duplicate ids', () => {
    const ids = META_UPGRADES.map(u => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all have positive costBase', () => {
    for (const u of META_UPGRADES) {
      expect(u.costBase).toBeGreaterThan(0);
    }
  });
});

describe('getMetaCost', () => {
  it('level 0 equals costBase', () => {
    expect(getMetaCost(META_UPGRADES[0], 0)).toBe(META_UPGRADES[0].costBase);
  });

  it('level 1 is 2x costBase', () => {
    expect(getMetaCost(META_UPGRADES[0], 1)).toBe(META_UPGRADES[0].costBase * 2);
  });

  it('level 9 is 10x costBase', () => {
    expect(getMetaCost(META_UPGRADES[0], 9)).toBe(META_UPGRADES[0].costBase * 10);
  });
});

describe('meta_hp apply', () => {
  it('level 3 gives +15 HP', () => {
    const p = new Player(getClassById('limpador'), 0, 0);
    const meta = META_UPGRADES.find(u => u.id === 'meta_hp')!;
    meta.apply(p, 3);
    expect(p.maxHp).toBe(getClassById('limpador').hp + 15);
    expect(p.hp).toBe(getClassById('limpador').hp + 15);
  });
});

describe('meta_atk apply', () => {
  it('level 2 gives +4 ATK', () => {
    const p = new Player(getClassById('limpador'), 0, 0);
    const meta = META_UPGRADES.find(u => u.id === 'meta_atk')!;
    meta.apply(p, 2);
    expect(p.attack).toBe(getClassById('limpador').attack + 4);
  });
});

describe('meta_inv apply', () => {
  it('level 2 unlocks 4 slots', () => {
    const p = new Player(getClassById('limpador'), 0, 0);
    const meta = META_UPGRADES.find(u => u.id === 'meta_inv')!;
    meta.apply(p, 2);
    expect(p.unlockedSlots).toBe(4);
  });
});
