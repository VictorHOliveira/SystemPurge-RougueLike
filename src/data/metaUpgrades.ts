import type { Player } from '../entities/Player';

export interface MetaUpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costBase: number;
  apply: (player: Player, level: number) => void;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'meta_hp',
    name: 'Núcleo Expandido',
    description: 'HP Máx +5 por nível',
    maxLevel: 10,
    costBase: 50,
    apply: (p, lvl) => { p.maxHp += 5 * lvl; p.hp += 5 * lvl; },
  },
  {
    id: 'meta_atk',
    name: 'Compilador Ofensivo',
    description: 'ATQ +2 por nível',
    maxLevel: 10,
    costBase: 50,
    apply: (p, lvl) => { p.attack += 2 * lvl; },
  },
  {
    id: 'meta_def',
    name: 'Barreira Persistente',
    description: 'DEF +1 por nível',
    maxLevel: 10,
    costBase: 50,
    apply: (p, lvl) => { p.defense += 1 * lvl; },
  },
  {
    id: 'meta_fov',
    name: 'Scanner Aprimorado',
    description: 'Visão +1 por nível',
    maxLevel: 5,
    costBase: 80,
    apply: (p, lvl) => { p.bonusFov += 1 * lvl; },
  },
  {
    id: 'meta_inv',
    name: 'Mochila Extra',
    description: 'Desbloqueia +1 slot de inventário por nível (máx 6)',
    maxLevel: 4,
    costBase: 400,
    apply: (p, lvl) => { p.unlockedSlots = 2 + lvl; },
  },
  {
    id: 'meta_xp',
    name: 'Boot Acelerado',
    description: 'XP inicial bônus por nível',
    maxLevel: 5,
    costBase: 100,
    apply: (p, lvl) => { p.xp += Math.floor(p.xpToNext * 0.15 * lvl); },
  },
];

export const CLASS_UNLOCK_COST: Record<string, number> = {
  ping_sniper: 200,
  muralha: 350,
  daemon: 500,
};

export function getMetaCost(def: MetaUpgradeDef, level: number): number {
  return def.costBase * (level + 1);
}
