export interface ItemDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ALL_ITEMS: ItemDef[] = [
  { id: 'health_patch', name: 'Patch de Sa\u0301ude', description: 'Cura 15 HP', icon: '+' },
  { id: 'network_pulse', name: 'Pulso de Rede', description: 'Dano 6 a todos no FOV', icon: '=' },
  { id: 'packet_sniffer', name: 'Packet Sniffer', description: 'Revela o andar', icon: 'O' },
  { id: 'overclock_inject', name: 'Overclock Inject', description: 'ATQ +5 por 5 turnos', icon: 'Z' },
  { id: 'defrag_shield', name: 'Defrag Shield', description: 'DEF +5 por 5 turnos', icon: 'D' },
];
