import { version } from '../../package.json';
import { GameState } from '../systems/GameState';
import { Player } from '../entities/Player';
import { EnemyBehavior } from '../data/enemies';
import { GameMap } from '../world/GameMap';
import type { Enemy } from '../entities/Enemy';
import { TileType } from '../data/tiles';
import { MAP_W, MAP_H } from '../constants';

const STORAGE_KEY = 'systempurge_run';
const CHECKPOINT_KEY = 'systempurge_checkpoint';

export interface RunSaveData {
  version: string;
  timestamp: number;
  player: {
    x: number; y: number; hp: number; maxHp: number;
    attack: number; defense: number;
    xp: number; level: number; xpToNext: number; floor: number;
    classId: string;
    acquiredUpgrades: [string, number][];
    inventory: (string | null)[];
    unlockedSlots: number;
    tempAtkBonus: number; tempAtkMultiplier: number; tempAtkCharges: number;
    tempDefBonus: number; tempDefCharges: number;
    bonusFov: number; bonusProjectileRange: number; projectileDamageBonus: number; moveSpeed: number;
    fatalGuardUsed: boolean; fatalGuardTriggered: boolean; encryptionLayerUsed: boolean;
    regenTicker: number; regenAccum: number; hasRegenCached: boolean;
    cooldowns: number[]; cooldownReduction: number;
    defenseBuffCharges: number;
    bleedTicks: number; bleedDamage: number; hasUsedAbility: boolean;
    extraBleedDamage: number; overflowRange: number;
    shieldNextHit?: boolean; shieldCharges?: number; reflectBuffCharges: number;
  };
  enemies: {
    idx: number;
    name: string; x: number; y: number;
    hp: number; maxHp: number; attack: number; defense: number;
    textureKey: string; behavior: EnemyBehavior;
    isElite: boolean; splitOnDeath?: string;
    skipNextTurn: boolean; xpValue: number;
    rangedRange?: number; fleeDistance?: number;
  }[];
  game: {
    kills: number;
    bossRoomIdx: number;
    minibossRoomIdx: number;
    altarRoomIdx: number;
    altarUsed: boolean;
    bossKilled: boolean;
    bossSeen: boolean;
    chests: [string, boolean][];
    enemyBleeds: [number, { ticks: number; damage: number }][];
    messages: string[];
  };
  map: {
    tiles: number[][];
    explored: boolean[][];
  };
}

function buildRunData(state: GameState): RunSaveData {
  const p = state.player;
  return {
    version,
    timestamp: Date.now(),
    player: {
      x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp,
      attack: p.attack, defense: p.defense,
      xp: p.xp, level: p.level, xpToNext: p.xpToNext, floor: p.floor,
      classId: state.classId,
      acquiredUpgrades: [...p.acquiredUpgrades.entries()],
      inventory: [...p.inventory],
      unlockedSlots: p.unlockedSlots,
      tempAtkBonus: p.tempAtkBonus, tempAtkMultiplier: p.tempAtkMultiplier, tempAtkCharges: p.tempAtkCharges,
      tempDefBonus: p.tempDefBonus, tempDefCharges: p.tempDefCharges,
      bonusFov: p.bonusFov, bonusProjectileRange: p.bonusProjectileRange, projectileDamageBonus: p.projectileDamageBonus, moveSpeed: p.moveSpeed,
      fatalGuardUsed: p.fatalGuardUsed, fatalGuardTriggered: p.fatalGuardTriggered,
      encryptionLayerUsed: p.encryptionLayerUsed,
      regenTicker: p.regenTicker, regenAccum: p.regenAccum,
      hasRegenCached: p.hasRegenCached,
      cooldowns: [...p.cooldowns], cooldownReduction: p.cooldownReduction,
      defenseBuffCharges: p.defenseBuffCharges,
      bleedTicks: p.bleedTicks, bleedDamage: p.bleedDamage,
      hasUsedAbility: p.hasUsedAbility,
      extraBleedDamage: p.extraBleedDamage, overflowRange: p.overflowRange,
      shieldNextHit: p.shieldNextHit, shieldCharges: p.shieldCharges, reflectBuffCharges: p.reflectBuffCharges,
    },
    enemies: state.enemies
      .filter(e => e.isAlive)
      .map((e, idx) => ({
        idx,
        name: e.name, x: e.x, y: e.y,
        hp: e.hp, maxHp: e.maxHp, attack: e.attack, defense: e.defense,
        textureKey: e.textureKey, behavior: e.behavior,
        isElite: e.isElite, splitOnDeath: e.splitOnDeath,
        skipNextTurn: e.skipNextTurn, xpValue: e.xpValue,
        rangedRange: e.rangedRange, fleeDistance: e.fleeDistance,
      })),
    game: {
      kills: state.kills,
      bossRoomIdx: state.bossRoomIdx,
      minibossRoomIdx: state.minibossRoomIdx,
      altarRoomIdx: state.altarRoomIdx,
      altarUsed: state.altarUsed,
      bossKilled: state.bossKilled,
      bossSeen: state.bossSeen,
      chests: [...state.chests.entries()],
      enemyBleeds: [...state.enemyBleeds.entries()].map(([id, val]) => {
        const enemy = state.enemies.find(e => e.id === id);
        return [enemy ? state.enemies.indexOf(enemy) : -1, val] as [number, { ticks: number; damage: number }];
      }).filter(([idx]) => idx >= 0),
      messages: state.messageLog?.messages ?? [],
    },
    map: {
      tiles: state.map.tiles.map(row => [...row]),
      explored: state.map.explored.map(row => [...row]),
    },
  };
}

export function saveRun(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildRunData(state)));
  } catch {
    // localStorage full ou indisponível; run segue sem save
  }
}

export function saveCheckpoint(state: GameState): void {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(buildRunData(state)));
  } catch {
  }
}

export function loadCheckpoint(): RunSaveData | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RunSaveData;
    if (typeof data.version !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasCheckpoint(): boolean {
  try {
    return localStorage.getItem(CHECKPOINT_KEY) !== null;
  } catch {
    return false;
  }
}

export function deleteCheckpoint(): void {
  try {
    localStorage.removeItem(CHECKPOINT_KEY);
  } catch {
  }
}

export function restoreCheckpoint(): boolean {
  const data = loadCheckpoint();
  if (!data) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadRunSave(): RunSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as RunSaveData;
    if (typeof data.version !== 'string') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasRunSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function deleteRunSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function restorePlayerFromSave(data: RunSaveData, player: Player): void {
  const sp = data.player;
  player.x = sp.x; player.y = sp.y;
  player.hp = sp.hp; player.maxHp = sp.maxHp;
  player.attack = sp.attack; player.defense = sp.defense;
  player.xp = sp.xp; player.level = sp.level;
  player.xpToNext = sp.xpToNext; player.floor = sp.floor;
  player.unlockedSlots = sp.unlockedSlots;

  player.acquiredUpgrades.clear();
  for (const [id, lvl] of sp.acquiredUpgrades) {
    player.acquiredUpgrades.set(id, lvl);
  }

  for (let i = 0; i < player.inventory.length; i++) {
    player.inventory[i] = sp.inventory[i] ?? null;
  }

  player.tempAtkBonus = sp.tempAtkBonus;
  player.tempAtkMultiplier = sp.tempAtkMultiplier ?? 1;
  player.tempAtkCharges = sp.tempAtkCharges;
  player.tempDefBonus = sp.tempDefBonus;
  player.tempDefCharges = sp.tempDefCharges;
  player.bonusFov = sp.bonusFov;
  player.bonusProjectileRange = sp.bonusProjectileRange ?? 0;
  player.projectileDamageBonus = sp.projectileDamageBonus ?? 0;
  player.moveSpeed = sp.moveSpeed;

  player.fatalGuardUsed = sp.fatalGuardUsed;
  player.fatalGuardTriggered = sp.fatalGuardTriggered;
  player.encryptionLayerUsed = sp.encryptionLayerUsed;
  player.regenTicker = sp.regenTicker;
  player.regenAccum = sp.regenAccum;
  player.hasRegenCached = sp.hasRegenCached;

  player.cooldowns = [...sp.cooldowns];
  player.cooldownReduction = sp.cooldownReduction;
  player.defenseBuffCharges = sp.defenseBuffCharges;
  player.bleedTicks = sp.bleedTicks;
  player.bleedDamage = sp.bleedDamage;
  player.hasUsedAbility = sp.hasUsedAbility;
  player.extraBleedDamage = sp.extraBleedDamage;
  player.overflowRange = sp.overflowRange;
  player.shieldCharges = sp.shieldCharges ?? (sp.shieldNextHit ? 1 : 0);
  player.reflectBuffCharges = sp.reflectBuffCharges;
}

export function restoreMapFromSave(data: RunSaveData, map: GameMap): void {
  for (let y = 0; y < MAP_H && y < data.map.tiles.length; y++) {
    for (let x = 0; x < MAP_W && x < data.map.tiles[y].length; x++) {
      map.tiles[y][x] = data.map.tiles[y][x] as TileType;
      map.explored[y][x] = data.map.explored[y][x] ?? false;
      map.visible[y][x] = false;
    }
  }
}

export function restoreEnemyBleeds(data: RunSaveData, enemies: Enemy[]): Map<string, { ticks: number; damage: number }> {
  const bleeds = new Map<string, { ticks: number; damage: number }>();
  for (const [idx, bleed] of data.game.enemyBleeds) {
    if (idx >= 0 && idx < enemies.length) {
      bleeds.set(enemies[idx].id, { ...bleed });
    }
  }
  return bleeds;
}

export function restoreChests(data: RunSaveData): Map<string, boolean> {
  const chests = new Map<string, boolean>();
  for (const [key, opened] of data.game.chests) {
    chests.set(key, opened);
  }
  return chests;
}
