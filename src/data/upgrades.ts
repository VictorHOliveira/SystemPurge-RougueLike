export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: 'stat' | 'passive';
  unique: boolean;
  maxLevel?: number;
}

export const ALL_UPGRADES: Upgrade[] = [
  // --- Stat upgrades (stackable) ---
  { id: 'virus_scan', name: 'Virus Scan', description: 'ATK +2', category: 'stat', unique: false },
  { id: 'patch_firewall', name: 'Patch Firewall', description: 'DEF +2', category: 'stat', unique: false },
  { id: 'memory_expansion', name: 'Memory Expansion', description: 'Max HP +10, heal +10', category: 'stat', unique: false },
  { id: 'kernel_optimization', name: 'Kernel Optimization', description: 'FOV radius +2', category: 'stat', unique: false },
  { id: 'root_access', name: 'Root Access', description: 'ATK +1', category: 'stat', unique: false },
  { id: 'disk_cleanup', name: 'Disk Cleanup', description: 'ATK +1, DEF +1', category: 'stat', unique: false },
  { id: 'ram_overclock', name: 'RAM Overclock', description: 'Max HP +8, FOV +1', category: 'stat', unique: false },
  { id: 'cache_boost', name: 'Cache Boost', description: 'ATK +3', category: 'stat', unique: false },
  { id: 'memory_page', name: 'Memory Page', description: 'DEF +3', category: 'stat', unique: false },
  { id: 'hyperthreading', name: 'HyperThreading', description: 'Max HP +15', category: 'stat', unique: false },
  { id: 'data_bus', name: 'Data Bus', description: 'ATK +2, FOV +1', category: 'stat', unique: false },

  // --- Unique stat upgrades ---
  { id: 'system_restore', name: 'System Restore', description: 'Fully restore HP', category: 'stat', unique: true },
  { id: 'compression_algorithm', name: 'Compression Algorithm', description: 'Max HP +2 per level', category: 'stat', unique: true },

  // --- Speed Boost (stackable, max 3) ---
  { id: 'speed_boost', name: 'Speed Boost', description: 'Move speed 2.0×/2.5×/3.0× (lv1/2/3)', category: 'stat', unique: false, maxLevel: 3 },

  // --- Life Steal (stackable, max 3) ---
  { id: 'life_steal', name: 'Life Steal', description: '50% chance: heal 2/4/8 HP per hit (lv1/2/3)', category: 'stat', unique: false, maxLevel: 3 },


  // --- Passive upgrades (unique) ---
  { id: 'registry_cleaner', name: 'Registry Cleaner', description: '15% chance to dodge attacks', category: 'passive', unique: true },
  { id: 'network_shield', name: 'Network Shield', description: '15%/30%/50% chance to reflect damage (lv1/2/3)', category: 'passive', unique: false, maxLevel: 3 },
  { id: 'cache_partition', name: 'Cache Partition', description: 'Regen 0.3 HP every 6 turns', category: 'passive', unique: true },
  { id: 'boot_sector', name: 'Boot Sector Protection', description: 'Survive fatal hit with 1 HP (once)', category: 'passive', unique: true },
  { id: 'encryption_layer', name: 'Encryption Layer', description: 'First hit per floor reduced by 3', category: 'passive', unique: true },
];

export function rollUpgrades(
  acquired: Map<string, number>,
  count: number,
): Upgrade[] {
  const pool = ALL_UPGRADES.filter(u => {
    if (u.unique && acquired.has(u.id)) return false;
    if (u.maxLevel !== undefined && (acquired.get(u.id) ?? 0) >= u.maxLevel) return false;
    return true;
  });

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
