export interface EnemyTemplate {
  name: string;
  hp: number;
  attack: number;
  defense: number;
  color: number;
  textureKey: string;
}

export const ENEMY_TEMPLATES: EnemyTemplate[] = [
  {
    name: 'trojan.exe',
    hp: 8,
    attack: 3,
    defense: 1,
    color: 0xff3355,
    textureKey: 'enemy_trojan',
  },
  {
    name: 'worm.dll',
    hp: 5,
    attack: 2,
    defense: 0,
    color: 0xff8800,
    textureKey: 'enemy_worm',
  },
  {
    name: 'spyware.sys',
    hp: 10,
    attack: 1,
    defense: 2,
    color: 0xaa44ff,
    textureKey: 'enemy_spyware',
  },
];

export const BOSS_TEMPLATE: EnemyTemplate = {
  name: 'rootkit.exe',
  hp: 30,
  attack: 5,
  defense: 2,
  color: 0xff0044,
  textureKey: 'enemy_boss',
};

export const MINIBOSS_TEMPLATE: EnemyTemplate = {
  name: 'admin.exe',
  hp: 18,
  attack: 5,
  defense: 2,
  color: 0xff44aa,
  textureKey: 'enemy_miniboss',
};

export function randomEnemyTemplate(): EnemyTemplate {
  return ENEMY_TEMPLATES[Math.floor(Math.random() * ENEMY_TEMPLATES.length)];
}
