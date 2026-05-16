import { Entity } from './Entity';

export class Player extends Entity {
  xp: number;
  level: number;
  xpToNext: number;
  floor: number;

  acquiredUpgrades: Map<string, number> = new Map();
  bonusFov: number = 0;
  moveSpeed: number = 1.5;
  fatalGuardUsed: boolean = false;
  encryptionLayerUsed: boolean = false;
  regenTicker: number = 0;
  regenAccum: number = 0;


  constructor(x: number, y: number) {
    super('player', 'process.exe', x, y, 30, 5, 2, 'entity_player');
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 20;
    this.floor = 1;
  }

  get effectiveFov(): number {
    return 8 + this.bonusFov;
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

  addXp(amount: number): boolean {
    this.xp += amount;
    if (this.xp >= this.xpToNext) {
      this.levelUp();
      return true;
    }
    return false;
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

    switch (id) {
      case 'virus_scan':
        this.attack += 2;
        break;
      case 'patch_firewall':
        this.defense += 2;
        break;
      case 'memory_expansion':
        this.maxHp += 10;
        this.hp += 10;
        break;
      case 'kernel_optimization':
        this.bonusFov += 2;
        break;
      case 'root_access':
        this.attack += 1;
        break;
      case 'disk_cleanup':
        this.attack += 1;
        this.defense += 1;
        break;
      case 'ram_overclock':
        this.maxHp += 8;
        this.hp += 8;
        this.bonusFov += 1;
        break;
      case 'cache_boost':
        this.attack += 3;
        break;
      case 'memory_page':
        this.defense += 3;
        break;
      case 'hyperthreading':
        this.maxHp += 15;
        this.hp += 15;
        break;
      case 'data_bus':
        this.attack += 2;
        this.bonusFov += 1;
        break;
      case 'speed_boost':
        this.moveSpeed += 0.5;
        break;
      case 'life_steal':
        break;
      case 'system_restore':
        this.hp = this.maxHp;
        break;
      case 'compression_algorithm': {
        const bonus = this.level * 2;
        this.maxHp += bonus;
        this.hp += bonus;
        break;
      }
    }
  }

  processTurnEnd(): void {
    if (!this.hasRegen) return;
    this.regenTicker++;
    if (this.regenTicker >= 6) {
      this.regenTicker = 0;
      this.regenAccum += 0.3;
      if (this.regenAccum >= 1) {
        this.regenAccum -= 1;
        this.hp = Math.min(this.maxHp, this.hp + 1);
      }
    }
  }

  onNewFloor(): void {
    this.encryptionLayerUsed = false;
  }
}
