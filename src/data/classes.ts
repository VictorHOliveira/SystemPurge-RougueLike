export interface ClassAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number;          // turnos de cooldown
  type: 'melee_aoe' | 'projectile_barrage' | 'defense_buff' | 'aoe_damage' | 'dot' | 'heal' | 'self_buff' | 'shield' | 'knockback' | 'reflect_buff';
  damage?: number;
  duration?: number;         // duração em turnos (buffs/dot)
}

export interface PlayerClass {
  id: string;
  name: string;
  description: string;
  textureKey: string;
  hp: number;
  attack: number;
  defense: number;
  moveSpeed: number;
  fov: number;
  canMelee: boolean;
  canShoot: boolean;
  meleeBonus: number;
  meleeMultiplier: number;
  ignoreDefense: boolean;
  projectilesPierce: boolean;
  reflectPercent: number;
  pressureDamage: number;
  abilities: ClassAbility[];
  exclusiveUpgradeIds: string[];
}

export const CLASSES: PlayerClass[] = [
  {
    id: 'limpador',
    name: 'Limpador de Registro',
    description: 'Especialista em combate corpo a corpo. Varre o sistema com golpes diretos.',
    textureKey: 'class_limpador',
    hp: 30,
    attack: 5,
    defense: 2,
    moveSpeed: 1.3,
    fov: 8,
    canMelee: true,
    canShoot: false,
    meleeBonus: 2,
    meleeMultiplier: 1,
    ignoreDefense: false,
    projectilesPierce: false,
    reflectPercent: 0,
    pressureDamage: 0,
    abilities: [
      {
        id: 'varredura',
        name: 'Varredura',
        description: 'Ataca todos os inimigos adjacentes',
        cooldown: 5,
        type: 'melee_aoe',
        damage: 0, // usa ATQ do player
      },
    ],
    exclusiveUpgradeIds: ['lamina_energizada', 'golpe_duplo'],
  },
  {
    id: 'ping_sniper',
    name: 'Ping Sniper',
    description: 'Atirador de elite. Analisa o sistema de longe com projéteis precisos.',
    textureKey: 'class_ping',
    hp: 22,
    attack: 7,
    defense: 1,
    moveSpeed: 1.3,
    fov: 10,
    canMelee: false,
    canShoot: true,
    meleeBonus: 0,
    meleeMultiplier: 1,
    ignoreDefense: false,
    projectilesPierce: true,
    reflectPercent: 0,
    pressureDamage: 0,
    abilities: [
      {
        id: 'rajada',
        name: 'Rajada de Pacotes',
        description: '3 projéteis em leque com 1,5× de dano',
        cooldown: 6,
        type: 'projectile_barrage',
        damage: 0, // usa ATQ do player
      },
    ],
    exclusiveUpgradeIds: ['mira_a_laser', 'recarga_rapida'],
  },
  {
    id: 'muralha',
    name: 'Muralha de Dados',
    description: 'Firewall ambulante. Absorve dano e retorna o ataque.',
    textureKey: 'class_muralha',
    hp: 45,
    attack: 3,
    defense: 5,
    moveSpeed: 1.3,
    fov: 8,
    canMelee: true,
    canShoot: true,
    meleeBonus: 0,
    meleeMultiplier: 0.5,
    ignoreDefense: false,
    projectilesPierce: false,
    reflectPercent: 50,
    pressureDamage: 1,
    abilities: [
      {
        id: 'criptografia',
        name: 'Criptografia Total',
        description: 'Reduz dano recebido em 50% por 3 ataques',
        cooldown: 8,
        type: 'defense_buff',
        damage: 0,
        duration: 3,
      },
    ],
    exclusiveUpgradeIds: ['escudo_reativo', 'campo_pressurizado'],
  },
  {
    id: 'daemon',
    name: 'Daemon',
    description: 'Processo oculto que corrompe o sistema com scripts maliciosos.',
    textureKey: 'class_daemon',
    hp: 25,
    attack: 3,
    defense: 2,
    moveSpeed: 1.3,
    fov: 8,
    canMelee: false,
    canShoot: true,
    meleeBonus: 0,
    meleeMultiplier: 1,
    ignoreDefense: true,
    projectilesPierce: false,
    reflectPercent: 0,
    pressureDamage: 0,
    abilities: [
      {
        id: 'overflow',
        name: 'Overflow de Pilha',
        description: '8 de dano em área + sangra 2 por 6 turnos',
        cooldown: 5,
        type: 'aoe_damage',
        damage: 8,
        duration: 6,
      },
      {
        id: 'vazamento',
        name: 'Vazamento de Memória',
        description: '10 de dano ao inimigo mais próximo',
        cooldown: 4,
        type: 'dot',
        damage: 10,
      },
    ],
    exclusiveUpgradeIds: ['script_compactado', 'dados_corrompidos', 'estouro_em_cascata'],
  },
];

export function getClassById(id: string): PlayerClass {
  const c = CLASSES.find(c => c.id === id);
  if (!c) throw new Error(`Classe desconhecida: ${id}`);
  return c;
}
