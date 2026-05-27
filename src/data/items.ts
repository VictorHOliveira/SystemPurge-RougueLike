export interface ItemDef {
  id: string;
  name: string;
  description: string;
}

export const ALL_ITEMS: ItemDef[] = [
  { id: 'health_patch', name: 'Patch de Sa\u00fade', description: 'Cura 15 HP' },
  { id: 'network_pulse', name: 'Pulso de Rede', description: 'Dano 6 a todos no FOV' },
  { id: 'packet_sniffer', name: 'Packet Sniffer', description: 'Revela o andar' },
  { id: 'overclock_inject', name: 'Overclock Inject', description: 'ATQ +5 por 5 ataques' },
  { id: 'defrag_shield', name: 'Defrag Shield', description: 'DEF +5 por 5 ataques' },
];
