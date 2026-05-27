export type EnemyBehavior = 'melee' | 'ranged' | 'suicide' | 'splitter';

export interface EnemyTemplate {
  name: string;
  hp: number;
  attack: number;
  defense: number;
  color: number;
  textureKey: string;
  behavior: EnemyBehavior;
  minFloor: number;
  splitOnDeath?: string;
}

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    name: 'trojan.exe',
    hp: 8,
    attack: 3,
    defense: 1,
    color: 0xff3355,
    textureKey: 'enemy_trojan',
    behavior: 'melee',
    minFloor: 1,
  },
  {
    name: 'worm.dll',
    hp: 5,
    attack: 2,
    defense: 0,
    color: 0xff8800,
    textureKey: 'enemy_worm',
    behavior: 'melee',
    minFloor: 1,
  },
  {
    name: 'spyware.sys',
    hp: 10,
    attack: 1,
    defense: 2,
    color: 0xaa44ff,
    textureKey: 'enemy_spyware',
    behavior: 'melee',
    minFloor: 1,
  },
  {
    name: 'malware.bat',
    hp: 6,
    attack: 2,
    defense: 0,
    color: 0xff8800,
    textureKey: 'enemy_malware',
    behavior: 'ranged',
    minFloor: 4,
  },
  {
    name: 'ransomware.exe',
    hp: 12,
    attack: 0,
    defense: 3,
    color: 0xff0044,
    textureKey: 'enemy_ransomware',
    behavior: 'suicide',
    minFloor: 6,
  },
  {
    name: 'overflow.dll',
    hp: 8,
    attack: 1,
    defense: 1,
    color: 0x44ffaa,
    textureKey: 'enemy_overflow',
    behavior: 'splitter',
    minFloor: 8,
    splitOnDeath: 'fragment',
  },
];

export const BOSS_TEMPLATE: EnemyTemplate = {
  name: 'rootkit.exe',
  hp: 30,
  attack: 5,
  defense: 2,
  color: 0xff0044,
  textureKey: 'enemy_boss',
  behavior: 'melee',
  minFloor: 10,
};

export const MINIBOSS_TEMPLATE: EnemyTemplate = {
  name: 'admin.exe',
  hp: 18,
  attack: 5,
  defense: 2,
  color: 0xff44aa,
  textureKey: 'enemy_miniboss',
  behavior: 'melee',
  minFloor: 3,
};

export const FRAGMENT_TEMPLATE: EnemyTemplate = {
  name: 'fragment',
  hp: 3,
  attack: 1,
  defense: 0,
  color: 0x44ffaa,
  textureKey: 'enemy_fragment',
  behavior: 'melee',
  minFloor: 1,
};

export function randomEnemyTemplate(floor: number): EnemyTemplate {
  const pool = ENEMY_TEMPLATES.filter(t => t.minFloor <= floor);
  return pool[Math.floor(Math.random() * pool.length)];
}
