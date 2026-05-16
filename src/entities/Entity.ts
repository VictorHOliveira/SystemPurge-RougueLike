export class Entity {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  textureKey: string;

  constructor(
    id: string,
    name: string,
    x: number,
    y: number,
    hp: number,
    attack: number,
    defense: number,
    textureKey: string,
  ) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.attack = attack;
    this.defense = defense;
    this.textureKey = textureKey;
  }

  get isAlive(): boolean {
    return this.hp > 0;
  }

  takeDamage(amount: number): number {
    this.hp -= amount;
    return amount;
  }

  heal(amount: number): number {
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    return this.hp - before;
  }
}
