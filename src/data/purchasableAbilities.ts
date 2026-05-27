export interface PurchasableAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  type: 'heal' | 'self_buff' | 'shield' | 'knockback' | 'reflect_buff' | 'dot';
  damage?: number;
  duration?: number;
  cost: number;
}

export const PURCHASABLE_ABILITIES: PurchasableAbility[] = [
  {
    id: 'injecao_virus',
    name: 'Inje\u00e7\u00e3o de V\u00edrus',
    description: '6 de dano + sangra 3 por 4 turnos no inimigo mais pr\u00f3ximo',
    cooldown: 25,
    type: 'dot',
    damage: 6,
    duration: 4,
    cost: 800,
  },
  {
    id: 'pulso_emergencia',
    name: 'Pulso de Emerg\u00eancia',
    description: 'Empurra todos os inimigos adjacentes para longe',
    cooldown: 30,
    type: 'knockback',
    cost: 800,
  },
  {
    id: 'sobrecarga_kernel',
    name: 'Sobrecarga de Kernel',
    description: '+5 de ATQ por 4 ataques',
    cooldown: 35,
    type: 'self_buff',
    damage: 5,
    duration: 4,
    cost: 800,
  },
  {
    id: 'barreira_protocolo',
    name: 'Barreira de Protocolo',
    description: 'Absorve completamente o pr\u00f3ximo ataque recebido',
    cooldown: 35,
    type: 'shield',
    cost: 800,
  },
  {
    id: 'restauracao_sistema',
    name: 'Restaura\u00e7\u00e3o de Sistema',
    description: 'Cura 50% da vida perdida',
    cooldown: 40,
    type: 'heal',
    cost: 800,
  },
  {
    id: 'espelhamento',
    name: 'Espelhamento',
    description: '100% de chance de refletir dano por 2 ataques',
    cooldown: 40,
    type: 'reflect_buff',
    duration: 2,
    cost: 800,
  },
];
