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
  { id: 'virus_scan', name: 'Varredura de Vírus', description: 'ATQ +2', category: 'stat', unique: false },
  { id: 'patch_firewall', name: 'Firewall Reforçado', description: 'DEF +2', category: 'stat', unique: false },
  { id: 'memory_expansion', name: 'Expansão de Memória', description: 'HP Máx +10, cura +10', category: 'stat', unique: false },
  { id: 'kernel_optimization', name: 'Otimização do Kernel', description: 'Alcance de Visão +2', category: 'stat', unique: false },
  { id: 'root_access', name: 'Acesso Root', description: 'ATQ +1', category: 'stat', unique: false },
  { id: 'disk_cleanup', name: 'Limpeza de Disco', description: 'ATQ +1, DEF +1', category: 'stat', unique: false },
  { id: 'ram_overclock', name: 'Overclock de RAM', description: 'HP Máx +8, Visão +1', category: 'stat', unique: false },
  { id: 'cache_boost', name: 'Cache Acelerado', description: 'ATQ +3', category: 'stat', unique: false },
  { id: 'memory_page', name: 'Página de Memória', description: 'DEF +3', category: 'stat', unique: false },
  { id: 'hyperthreading', name: 'HyperThreading', description: 'HP Máx +15', category: 'stat', unique: false },
  { id: 'data_bus', name: 'Barramento de Dados', description: 'ATQ +2, Visão +1', category: 'stat', unique: false },

  // --- Unique stat upgrades ---
  { id: 'system_restore', name: 'Restauração do Sistema', description: 'Recupera HP totalmente', category: 'stat', unique: true },
  { id: 'compression_algorithm', name: 'Algoritmo de Compressão', description: 'HP Máx +2 por nível', category: 'stat', unique: true },

  // --- Speed Boost (stackable, max 3) ---
  { id: 'speed_boost', name: 'Aumento de Velocidade', description: 'Velocidade 2.0×/2.5×/3.0× (nv1/2/3)', category: 'stat', unique: false, maxLevel: 3 },

  // --- Life Steal (stackable, max 3) ---
  { id: 'life_steal', name: 'Dreno de Vida', description: '50% chance: cura 2/4/8 HP por golpe (nv1/2/3)', category: 'stat', unique: false, maxLevel: 3 },


  // --- Passive upgrades (unique) ---
  { id: 'registry_cleaner', name: 'Limpador de Registro', description: '15% de chance de desviar ataques', category: 'passive', unique: true },
  { id: 'network_shield', name: 'Escudo de Rede', description: '15%/30%/50% de chance de refletir dano (nv1/2/3)', category: 'passive', unique: false, maxLevel: 3 },
  { id: 'cache_partition', name: 'Cache Particionado', description: 'Regenera 0,3 HP a cada 6 turnos', category: 'passive', unique: true },
  { id: 'boot_sector', name: 'Proteção do Setor de Boot', description: 'Sobrevive a golpe fatal com 1 HP (uma vez)', category: 'passive', unique: true },
  { id: 'encryption_layer', name: 'Camada de Criptografia', description: 'Primeiro golpe por andar reduzido em 3', category: 'passive', unique: true },
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
