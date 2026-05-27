import { Entity } from './Entity';
import { PlayerClass, ClassAbility } from '../data/classes';

export class Player extends Entity {
  xp: number;
  level: number;
  xpToNext: number;
  floor: number;

  classDef: PlayerClass;

  unlockedSlots: number = 2;
  acquiredUpgrades: Map<string, number> = new Map();
  inventory: (string | null)[] = [];
  tempAtkBonus: number = 0;
  tempAtkCharges: number = 0;
  tempDefBonus: number = 0;
  tempDefCharges: number = 0;
  bonusFov: number = 0;
  moveSpeed: number;
  fatalGuardUsed: boolean = false;
  fatalGuardTriggered: boolean = false;
  encryptionLayerUsed: boolean = false;
  regenTicker: number = 0;
  regenAccum: number = 0;
  hasRegenCached: boolean = false;

  cooldowns: number[] = [];
  cooldownReduction: number = 0;
  defenseBuffCharges: number = 0;
  bleedTicks: number = 0;
  bleedDamage: number = 0;
  hasUsedAbility: boolean = false;
  extraBleedDamage: number = 0;
  overflowRange: number = 2;
  shieldNextHit: boolean = false;
  reflectBuffCharges: number = 0;

  constructor(classDef: PlayerClass, x: number, y: number) {
    super('player', classDef.name, x, y, classDef.hp, classDef.attack, classDef.defense, classDef.textureKey);
    this.classDef = classDef;
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 20;
    this.floor = 1;
    this.moveSpeed = classDef.moveSpeed;
    this.cooldowns = classDef.abilities.map(() => 0);
    this.inventory = [null, null, null, null, null, null];
  }

  freeSlots(): number {
    let count = 0;
    for (let i = 0; i < this.unlockedSlots; i++) {
      if (this.inventory[i] === null) count++;
    }
    return count;
  }

  addItem(id: string): boolean {
    for (let i = 0; i < this.unlockedSlots; i++) {
      if (this.inventory[i] === null) {
        this.inventory[i] = id;
        return true;
      }
    }
    return false;
  }

  removeItem(slot: number): string | null {
    if (slot < 0 || slot >= this.unlockedSlots) return null;
    const id = this.inventory[slot];
    this.inventory[slot] = null;
    return id;
  }

  getItem(slot: number): string | null {
    if (slot < 0 || slot >= this.unlockedSlots) return null;
    return this.inventory[slot];
  }

  get effectiveAtk(): number {
    return this.attack + this.tempAtkBonus;
  }

  get effectiveDef(): number {
    return this.defense + this.tempDefBonus;
  }

  get effectiveFov(): number {
    return this.classDef.fov + this.bonusFov;
  }

  get effectiveMoveSpeed(): number {
    return this.moveSpeed;
  }

  get hasDodge(): boolean {
    return this.acquiredUpgrades.has('registry_cleaner');
  }

  get reflectChance(): number {
    const lvl = this.acquiredUpgrades.get('network_shield') ?? 0;
    if (lvl >= 3) return 0.50;
    if (lvl >= 2) return 0.30;
    if (lvl >= 1) return 0.15;
    return 0;
  }

  get hasRegen(): boolean {
    return this.acquiredUpgrades.has('cache_partition');
  }

  get hasFatalGuard(): boolean {
    return this.acquiredUpgrades.has('boot_sector') && !this.fatalGuardUsed;
  }

  get hasEncryption(): boolean {
    return this.acquiredUpgrades.has('encryption_layer') && !this.encryptionLayerUsed;
  }

  get lifeStealAmount(): number {
    const lvl = this.acquiredUpgrades.get('life_steal') ?? 0;
    if (lvl >= 3) return 8;
    if (lvl >= 2) return 4;
    if (lvl >= 1) return 2;
    return 0;
  }

  get classAbilities(): ClassAbility[] {
    return this.classDef.abilities;
  }

  get isDefenseBuffed(): boolean {
    return this.defenseBuffCharges > 0;
  }

  get isBleeding(): boolean {
    return this.bleedTicks > 0;
  }

  canUseAbility(index: number): boolean {
    if (index < 0 || index >= this.cooldowns.length) return false;
    return this.cooldowns[index] === 0 && !this.hasUsedAbility;
  }

  useAbility(index: number): void {
    if (!this.canUseAbility(index)) return;
    const base = this.classDef.abilities[index].cooldown;
    this.cooldowns[index] = Math.max(1, base - this.cooldownReduction);
    this.hasUsedAbility = true;
  }

  addXp(amount: number): boolean {
    this.xp += amount;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.levelUp();
      leveled = true;
    }
    return leveled;
  }

  levelUp(): void {
    this.level++;
    this.xp -= this.xpToNext;
    this.xpToNext = Math.floor(this.xpToNext * 1.5);
    this.maxHp += 8;
    this.attack += 2;
    this.defense += 1;
  }

  applyUpgrade(id: string): void {
    const curLevel = this.acquiredUpgrades.get(id) ?? 0;
    this.acquiredUpgrades.set(id, curLevel + 1);
    const fn = UPGRADE_APPLY[id];
    if (fn) fn(this, this.level);
    if (id === 'cache_partition') this.hasRegenCached = true;
  }

  processTurnEnd(): void {
    this.fatalGuardTriggered = false;
    this.hasUsedAbility = false;
    for (let i = 0; i < this.cooldowns.length; i++) {
      if (this.cooldowns[i] > 0) this.cooldowns[i]--;
    }

    if (this.isBleeding) {
      const bleedDmg = this.bleedDamage + this.extraBleedDamage;
      this.takeDamage(bleedDmg);
      this.bleedTicks--;
    }

    if (!this.hasRegenCached) return;
    this.regenTicker++;
    if (this.regenTicker >= 6) {
      this.regenTicker = 0;
      this.regenAccum += 3;
      if (this.regenAccum >= 10) {
        this.regenAccum -= 10;
        this.hp = Math.min(this.maxHp, this.hp + 1);
      }
    }
  }

  onNewFloor(): void {
    this.encryptionLayerUsed = false;
  }
}

const UPGRADE_APPLY: Record<string, (p: Player, level: number) => void> = {
  virus_scan: (p) => { p.attack += 2; },
  patch_firewall: (p) => { p.defense += 2; },
  memory_expansion: (p) => { p.maxHp += 10; p.hp += 10; },
  kernel_optimization: (p) => { p.bonusFov += 2; },
  root_access: (p) => { p.attack += 1; },
  disk_cleanup: (p) => { p.attack += 1; p.defense += 1; },
  ram_overclock: (p) => { p.maxHp += 8; p.hp += 8; p.bonusFov += 1; },
  cache_boost: (p) => { p.attack += 3; },
  memory_page: (p) => { p.defense += 3; },
  hyperthreading: (p) => { p.maxHp += 15; p.hp += 15; },
  data_bus: (p) => { p.attack += 2; p.bonusFov += 1; },
  speed_boost: (p) => { p.moveSpeed += 0.5; },
  life_steal: () => {},
  system_restore: (p) => { p.hp = p.maxHp; },
  compression_algorithm: (p, lvl) => { const bonus = lvl * 2; p.maxHp += bonus; p.hp += bonus; },
  lamina_energizada: () => {},
  golpe_duplo: () => {},
  mira_a_laser: (p) => { p.attack += 3; },
  recarga_rapida: (p) => { p.cooldownReduction++; },
  escudo_reativo: (p) => { p.defense += 1; },
  campo_pressurizado: () => {},
  script_compactado: (p) => { p.cooldownReduction++; },
  dados_corrompidos: (p) => { p.extraBleedDamage++; },
  estouro_em_cascata: (p) => { p.overflowRange = 2 + (p.acquiredUpgrades.get('estouro_em_cascata') ?? 0); },
};
