const STORAGE_KEY = 'systempurge_meta';

export const BITS_PER_FLOOR = 10;
export const BITS_PER_KILL = 2;
export const BITS_BOSS_BONUS = 50;

export interface MetaProgress {
  bits: number;
  upgrades: Record<string, number>;
  unlocks: Record<string, boolean>;
  purchasedAbilities?: string[];
  activeAbilities?: string[];
}

export function defaultMeta(): MetaProgress {
  return { bits: 0, upgrades: {}, unlocks: { limpador: true }, activeAbilities: [] };
}

export function loadMeta(): MetaProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bits: typeof parsed.bits === 'number' ? parsed.bits : 0,
        upgrades: parsed.upgrades ?? {},
        unlocks: { ...defaultMeta().unlocks, ...(parsed.unlocks ?? {}) },
        purchasedAbilities: parsed.purchasedAbilities ?? (parsed.purchasedAbility ? [parsed.purchasedAbility] : undefined),
        activeAbilities: parsed.activeAbilities ??
          (parsed.purchasedAbilities ? [...parsed.purchasedAbilities] :
           parsed.purchasedAbility ? [parsed.purchasedAbility] : []),
      };
    }
  } catch { }
  return defaultMeta();
}

export function saveMeta(meta: MetaProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export function calcBitsEarned(floor: number, kills: number, bossKilled: boolean): number {
  return floor * BITS_PER_FLOOR + kills * BITS_PER_KILL + (bossKilled ? BITS_BOSS_BONUS : 0);
}
