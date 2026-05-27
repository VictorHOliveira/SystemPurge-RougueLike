import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcBitsEarned, defaultMeta, loadMeta, saveMeta, BITS_PER_FLOOR, BITS_PER_KILL, BITS_BOSS_BONUS } from '../utils/metaSave';

function mockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((_i: number) => null),
  };
}

describe('calcBitsEarned', () => {
  it('calculates base bits from floor and kills', () => {
    const result = calcBitsEarned(5, 10, false);
    expect(result).toBe(5 * BITS_PER_FLOOR + 10 * BITS_PER_KILL);
  });

  it('adds boss bonus when boss killed', () => {
    const withBoss = calcBitsEarned(5, 10, true);
    const withoutBoss = calcBitsEarned(5, 10, false);
    expect(withBoss - withoutBoss).toBe(BITS_BOSS_BONUS);
  });

  it('returns 0 for floor 0 and no kills', () => {
    expect(calcBitsEarned(0, 0, false)).toBe(0);
  });
});

describe('defaultMeta', () => {
  it('returns default structure', () => {
    const meta = defaultMeta();
    expect(meta.bits).toBe(0);
    expect(meta.upgrades).toEqual({});
    expect(meta.unlocks.limpador).toBe(true);
    expect(meta.activeAbilities).toEqual([]);
  });
});

describe('saveMeta / loadMeta', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loadMeta returns defaults when nothing saved', () => {
    const meta = loadMeta();
    expect(meta.bits).toBe(0);
  });

  it('round-trips save and load', () => {
    const data = { bits: 100, upgrades: { meta_hp: 1 }, unlocks: { limpador: true, ping_sniper: true }, activeAbilities: [] };
    saveMeta(data);
    const loaded = loadMeta();
    expect(loaded.bits).toBe(100);
    expect(loaded.upgrades.meta_hp).toBe(1);
    expect(loaded.unlocks.ping_sniper).toBe(true);
  });
});
