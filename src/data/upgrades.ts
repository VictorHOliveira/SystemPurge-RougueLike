import { ALL_ITEMS } from './items';

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: 'stat' | 'passive';
  unique: boolean;
  maxLevel?: number;
  classId?: string; // exclusive to a class
}

export const ALL_UPGRADES: Upgrade[] = [
  // --- General stat upgrades (stackable) ---
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
  { id: 'projectile_range', name: 'Alcance Estendido', description: 'Alcance de projétil +2 (máx 3)', category: 'stat', unique: false, maxLevel: 3 },

  // --- Unique stat upgrades ---
  { id: 'system_restore', name: 'Restauração do Sistema', description: 'Recupera HP totalmente', category: 'stat', unique: true },
  { id: 'compression_algorithm', name: 'Algoritmo de Compressão', description: 'HP Máx +2 por nível', category: 'stat', unique: true },

  // --- Speed Boost (stackable, max 3) ---
  { id: 'speed_boost', name: 'Aumento de Velocidade', description: 'Velocidade +0,2× por nível (máx 3)', category: 'stat', unique: false, maxLevel: 3 },

  // --- Life Steal (stackable, max 3) ---
  { id: 'life_steal', name: 'Dreno de Vida', description: '50% chance: cura 2/4/8 HP por golpe (nv1/2/3)', category: 'stat', unique: false, maxLevel: 3 },


  // --- Passive upgrades (unique) ---
  { id: 'registry_cleaner', name: 'Limpador de Registro', description: '15% de chance de desviar ataques', category: 'passive', unique: true },
  { id: 'network_shield', name: 'Escudo de Rede', description: '15%/30%/50% de chance de refletir dano (nv1/2/3)', category: 'passive', unique: false, maxLevel: 3 },
  { id: 'cache_partition', name: 'Cache Particionado', description: 'Regenera 0,3 HP a cada 6 turnos', category: 'passive', unique: true },
  { id: 'boot_sector', name: 'Proteção do Setor de Boot', description: 'Sobrevive a um golpe fatal recuperando 25% da vida (uma vez)', category: 'passive', unique: true },
  { id: 'encryption_layer', name: 'Camada de Criptografia', description: 'Primeiro golpe por andar reduzido em 3', category: 'passive', unique: true },
  { id: 'trap_resistance', name: 'Blindagem de Trilha', description: 'Dano de armadilha -15% por nível (máx 3)', category: 'passive', unique: false, maxLevel: 3 },

  // --- Class-exclusive upgrades ---
  { id: 'lamina_energizada', name: 'Lâmina Energizada', description: 'Golpes corpo a corpo causam sangramento (1 dmg 3 turnos)', category: 'passive', unique: true, classId: 'limpador' },
  { id: 'golpe_duplo', name: 'Golpe Duplo', description: '30% de chance de atacar duas vezes no melee', category: 'passive', unique: true, classId: 'limpador' },
  { id: 'mira_a_laser', name: 'Mira a Laser', description: 'Projéteis causam +3 de dano', category: 'stat', unique: true, classId: 'ping_sniper' },
  { id: 'recarga_rapida', name: 'Recarga Rápida', description: 'Cooldown das habilidades reduzido em 1', category: 'passive', unique: true, classId: 'ping_sniper' },
  { id: 'escudo_reativo', name: 'Escudo Reativo', description: 'DEF +1, reflexo +15%', category: 'stat', unique: true, classId: 'muralha' },
  { id: 'campo_pressurizado', name: 'Campo Pressurizado', description: 'Pressão de Pacotes causa +1 de dano', category: 'passive', unique: true, classId: 'muralha' },
  { id: 'script_compactado', name: 'Script Compactado', description: 'Cooldown das habilidades reduzido em 1', category: 'passive', unique: true, classId: 'daemon' },
  { id: 'dados_corrompidos', name: 'Dados Corrompidos', description: 'Sangramento causa +1 de dano', category: 'passive', unique: true, classId: 'daemon' },
  { id: 'estouro_em_cascata', name: 'Estouro em Cascata', description: 'Overflow alcança +1 tile por nível (max 4)', category: 'passive', unique: false, maxLevel: 4, classId: 'daemon' },
];

export const UPGRADE_ICONS: Record<string, string> = {
  virus_scan: 'ui_upgrade_atk',
  root_access: 'ui_upgrade_atk',
  cache_boost: 'ui_upgrade_atk',
  mira_a_laser: 'ui_upgrade_atk',
  patch_firewall: 'ui_upgrade_def',
  memory_page: 'ui_upgrade_def',
  disk_cleanup: 'ui_upgrade_def',
  escudo_reativo: 'ui_upgrade_def',
  memory_expansion: 'ui_upgrade_hp',
  ram_overclock: 'ui_upgrade_hp',
  hyperthreading: 'ui_upgrade_hp',
  compression_algorithm: 'ui_upgrade_hp',
  system_restore: 'ui_upgrade_hp',
  kernel_optimization: 'ui_upgrade_vis',
  data_bus: 'ui_upgrade_vis',
  projectile_range: 'ui_upgrade_vis',
  speed_boost: 'ui_upgrade_speed',
  life_steal: 'ui_upgrade_passive',
  registry_cleaner: 'ui_upgrade_passive',
  network_shield: 'ui_upgrade_passive',
  cache_partition: 'ui_upgrade_passive',
  boot_sector: 'ui_upgrade_passive',
  encryption_layer: 'ui_upgrade_passive',
  trap_resistance: 'ui_upgrade_passive',
  lamina_energizada: 'ui_upgrade_passive',
  golpe_duplo: 'ui_upgrade_passive',
  recarga_rapida: 'ui_upgrade_passive',
  campo_pressurizado: 'ui_upgrade_passive',
  script_compactado: 'ui_upgrade_passive',
  dados_corrompidos: 'ui_upgrade_passive',
  estouro_em_cascata: 'ui_upgrade_passive',
};

export function rollUpgrades(
  acquired: Map<string, number>,
  count: number,
  classId?: string,
): Upgrade[] {
  const pool = ALL_UPGRADES.filter(u => {
    if (u.unique && acquired.has(u.id)) return false;
    if (u.maxLevel !== undefined && (acquired.get(u.id) ?? 0) >= u.maxLevel) return false;
    if (u.classId && u.classId !== classId) return false;
    return true;
  });

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export interface RewardOption {
  kind: 'upgrade' | 'item';
  id: string;
}

export function rollRewards(
  acquired: Map<string, number>,
  freeSlots: number,
  count: number = 3,
  classId?: string,
): RewardOption[] {
  const upgradePool = ALL_UPGRADES.filter(u => {
    if (u.unique && acquired.has(u.id)) return false;
    if (u.maxLevel !== undefined && (acquired.get(u.id) ?? 0) >= u.maxLevel) return false;
    if (u.classId && u.classId !== classId) return false;
    return true;
  });

  const combined: RewardOption[] = [
    ...upgradePool.map(u => ({ kind: 'upgrade' as const, id: u.id })),
  ];

  if (freeSlots > 0) {
    combined.push(...ALL_ITEMS.map(i => ({ kind: 'item' as const, id: i.id })));
  }

  const shuffled = [...combined];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export const UPGRADE_DISP: Record<string, { fmt(lvl: number, plvl: number): string; color: string }> = {
  virus_scan:           { color: '#4488ff', fmt: (l) => `ATQ+${2*l}` },
  patch_firewall:       { color: '#44cc88', fmt: (l) => `DEF+${2*l}` },
  memory_expansion:     { color: '#ffdd44', fmt: (l) => `HP+${10*l}` },
  kernel_optimization:  { color: '#88ddff', fmt: (l) => `VIS+${2*l}` },
  root_access:          { color: '#4488ff', fmt: (l) => `ATQ+${1*l}` },
  disk_cleanup:         { color: '#44aaaa', fmt: (l) => `ATQ+${1*l}/DEF+${1*l}` },
  ram_overclock:        { color: '#ccaa44', fmt: (l) => `HP+${8*l}/VIS+${1*l}` },
  cache_boost:          { color: '#4488ff', fmt: (l) => `ATQ+${3*l}` },
  memory_page:          { color: '#44cc88', fmt: (l) => `DEF+${3*l}` },
  hyperthreading:       { color: '#ffdd44', fmt: (l) => `HP+${15*l}` },
  data_bus:             { color: '#44aaaa', fmt: (l) => `ATQ+${2*l}/VIS+${1*l}` },
  projectile_range:     { color: '#88ddff', fmt: (l) => `ALC+${2*l}` },
  speed_boost:          { color: '#44ddbb', fmt: (l) => `VEL+${(0.2*l).toFixed(1)}` },
  compression_algorithm:{ color: '#ffdd44', fmt: (l, p) => p ? `HP+${p*2*l}` : `HP+?` },
  life_steal:           { color: '#aa88cc', fmt: (l) => l >= 3 ? 'Dreno 8' : l >= 2 ? 'Dreno 4' : 'Dreno 2' },
  system_restore:       { color: '#ffdd44', fmt: () => 'Cura total' },
  registry_cleaner:     { color: '#aa88cc', fmt: () => 'Esq 15%' },
  network_shield:       { color: '#aa88cc', fmt: (l) => l >= 3 ? 'Ref 50%' : l >= 2 ? 'Ref 30%' : 'Ref 15%' },
  cache_partition:      { color: '#aa88cc', fmt: () => 'Regen 0.3' },
  boot_sector:          { color: '#ff8844', fmt: () => 'Cura 25%' },
  encryption_layer:     { color: '#ff8844', fmt: () => '-3 1×/and' },
  trap_resistance:      { color: '#44ddbb', fmt: (l) => `Armadilha -${15*l}%` },
  lamina_energizada:    { color: '#aa88cc', fmt: () => 'Sangra 1' },
  golpe_duplo:          { color: '#aa88cc', fmt: () => '×2 30%' },
  mira_a_laser:         { color: '#4488ff', fmt: (l) => `PROJ+${3*l}` },
  recarga_rapida:       { color: '#aa88cc', fmt: () => 'CD-1' },
  escudo_reativo:       { color: '#44cc88', fmt: (l) => `DEF+${1*l}` },
  campo_pressurizado:   { color: '#aa88cc', fmt: () => 'Pressão+1' },
  script_compactado:    { color: '#aa88cc', fmt: () => 'CD-1' },
  dados_corrompidos:    { color: '#aa88cc', fmt: () => 'Sangra+1' },
  estouro_em_cascata:   { color: '#aa88cc', fmt: (l) => `Alc+${l}` },
};
