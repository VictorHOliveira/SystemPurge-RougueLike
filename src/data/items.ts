export interface ItemDef {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ALL_ITEMS: ItemDef[] = [
  { id: 'health_patch', name: 'Patch de Sa\u00fade', description: 'Recupera 25% da vida m\u00e1xima', icon: 'item_health_patch' },
  { id: 'network_pulse', name: 'Pulso de Rede', description: 'Dano 6 a todos no FOV', icon: 'item_network_pulse' },
  { id: 'packet_sniffer', name: 'Packet Sniffer', description: 'Revela todo o mapa do andar atual', icon: 'item_packet_sniffer' },
  { id: 'overclock_inject', name: 'Overclock Inject', description: 'ATQ +5 por 5 ataques', icon: 'item_overclock_inject' },
  { id: 'defrag_shield', name: 'Defrag Shield', description: 'DEF +5 por 5 ataques', icon: 'item_defrag_shield' },
];
