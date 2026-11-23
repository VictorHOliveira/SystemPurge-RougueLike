import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveCheckpoint, loadCheckpoint, hasCheckpoint, deleteCheckpoint, restoreCheckpoint } from '../utils/runSave';

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

function fakeState(floor: number) {
  return {
    classId: 'limpador',
    player: {
      x: 3, y: 4, hp: 20, maxHp: 30, attack: 5, defense: 2,
      xp: 0, level: 1, xpToNext: 20, floor,
      acquiredUpgrades: new Map<string, number>(),
      inventory: [],
      unlockedSlots: 2,
      tempAtkBonus: 0, tempAtkMultiplier: 1, tempAtkCharges: 0,
      tempDefBonus: 0, tempDefCharges: 0,
      bonusFov: 0, bonusProjectileRange: 0, projectileDamageBonus: 0, moveSpeed: 1,
      fatalGuardUsed: false, fatalGuardTriggered: false,
      encryptionLayerUsed: false,
      regenTicker: 0, regenAccum: 0, hasRegenCached: false,
      cooldowns: new Map<string, number>(), cooldownReduction: 0,
      defenseBuffCharges: 0,
      bleedTicks: 0, bleedDamage: 0,
      hasUsedAbility: false,
      extraBleedDamage: 0, overflowRange: 0,
      shieldNextHit: false, shieldCharges: 0, reflectBuffCharges: 0,
    },
    enemies: [],
    kills: 0,
    bossRoomIdx: -1,
    minibossRoomIdx: -1,
    altarRoomIdx: -1,
    altarUsed: false,
    bossKilled: false,
    bossSeen: false,
    chests: new Map<number, boolean>(),
    enemyBleeds: new Map<number, { ticks: number; damage: number }>(),
    messageLog: { messages: [] },
    map: {
      tiles: [[0, 0], [0, 0]],
      explored: [[true, false], [false, false]],
    },
  } as any;
}

describe('checkpoint de run', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('salva em chave separada do save normal', () => {
    saveCheckpoint(fakeState(10));

    expect(storage.getItem('systempurge_checkpoint')).not.toBeNull();
    expect(storage.getItem('systempurge_run')).toBeNull();
    expect(loadCheckpoint()?.player.floor).toBe(10);
    expect(hasCheckpoint()).toBe(true);
  });

  it('restaura o checkpoint para o save normal', () => {
    saveCheckpoint(fakeState(5));

    expect(restoreCheckpoint()).toBe(true);
    expect(loadCheckpoint()?.player.floor).toBe(5);
    expect(storage.getItem('systempurge_run')).not.toBeNull();
  });

  it('não restaura quando não há checkpoint', () => {
    expect(restoreCheckpoint()).toBe(false);
  });

  it('remove o checkpoint', () => {
    saveCheckpoint(fakeState(15));
    deleteCheckpoint();

    expect(hasCheckpoint()).toBe(false);
    expect(loadCheckpoint()).toBeNull();
  });

  it('ignora checkpoint corrompido', () => {
    storage.setItem('systempurge_checkpoint', '{invalid');
    expect(loadCheckpoint()).toBeNull();

    storage.setItem('systempurge_checkpoint', JSON.stringify({ version: 1 }));
    expect(loadCheckpoint()).toBeNull();
  });
});
