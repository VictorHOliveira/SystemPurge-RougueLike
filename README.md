# System Purge

**Versão 0.3.0**

Roguelike de terminal onde você elimina ameaças do sistema operacional e purga o kernel de rootkits.

---

## Tecnologias

Phaser 3 · rot-js · TypeScript · Vite

---

## Como executar

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # build de produção (saída em dist/)
npm run preview   # preview do build
```

---

## Classes (4)

| Classe | Habilidade | Efeito | CD |
|--------|-----------|--------|----|
| **Limpador de Registro** | Varredura | Ataca todos inimigos adjacentes (usa ATQ) | 5 |
| **Ping Sniper** (200 bits) | Rajada de Pacotes | 3 projéteis em leque com 1.5× dano | 6 |
| **Muralha de Dados** (350 bits) | Criptografia Total | Reduz dano recebido em 50% por 3 turnos | 8 |
| **Daemon** (500 bits) | Overflow de Pilha | 8 dano em área + sangra 2 por 6 turnos | 5 |
| | Vazamento de Memória | 10 dano ao inimigo mais próximo | 4 |

---

## Habilidades Compartilhadas (6) — 800 bits cada

| Habilidade | Tipo | Efeito | CD |
|-----------|------|--------|----|
| Injeção de Vírus | Dot | 6 dano + sangra 3 por 4 turnos | 25 |
| Pulso de Emergência | Knockback | Empurra todos inimigos adjacentes | 30 |
| Sobrecarga de Kernel | Self Buff | +5 ATQ por 4 turnos | 35 |
| Barreira de Protocolo | Shield | Absorve completamente o próximo ataque | 35 |
| Restauração de Sistema | Heal | Cura 50% da vida perdida | 40 |
| Espelhamento | Reflect Buff | 100% chance de refletir dano por 2 turnos | 40 |

> Limite: até 2 ativas por classe (1 para Daemon).

---

## Itens (5)

| Item | Efeito |
|------|--------|
| Patch de Saúde | Cura 15 HP |
| Pulso de Rede | 6 dano a todos inimigos no FOV |
| Packet Sniffer | Revela o andar inteiro |
| Overclock Inject | ATQ +5 por 5 turnos |
| Defrag Shield | DEF +5 por 5 turnos |

---

## Melhorias Permanentes (6)

| Melhoria | Efeito por nível | Nv máx | Custo base |
|----------|-----------------|--------|-----------|
| Núcleo Expandido | HP Máx +5 | 10 | 50 bits |
| Compilador Ofensivo | ATQ +2 | 10 | 50 bits |
| Barreira Persistente | DEF +1 | 10 | 50 bits |
| Scanner Aprimorado | Visão +1 | 5 | 80 bits |
| Mochila Extra | +1 slot inventário | 4 | 400 bits |
| Boot Acelerado | +15% XP bônus | 5 | 100 bits |

---

## Controles

| Tecla | Ação |
|-------|------|
| Setas | Mover |
| W/A/S/D | Atirar |
| Q / E / R | Habilidades |
| 1–6 | Itens |
| Espaço | Aguardar turno |
| ESC | Pausar / Menu |

---

## Cheat Codes

Cheats serão liberados em breve de forma escondida no menu SOBRE.

---

## Créditos

Victor Oliveira  
Participação especial de Helena Oliveira
