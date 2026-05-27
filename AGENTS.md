# System Purge — Conhecimento do Projeto

## Visão Geral
Roguelike turn-based com tema de computador/vírus em web (Phaser 3 + TypeScript + rot.js). O jogador é `process.exe` e limpa diretórios (andares) infestados de malware.
- **Versão**: 0.4.0
- **Canvas**: 1024×640 (640 game + 384 painel direito HUD)
- **Tile**: 32×32 pixels
- **Mapa**: 60×40 tiles
- **URL**: `https://anomalyco.github.io/SystemPurge-RougueLike/`
- **Deploy**: GitHub Actions (push em `master` → GitHub Pages, base path `/SystemPurge-RougueLike/`)

## Stack
- **Engine**: Phaser 3 v3.80+
- **Linguagem**: TypeScript 5.4+ (strict)
- **Mapa**: rot.js v2.2 (Map.Digger)
- **FOV**: rot.js FOV.PreciseShadowcasting
- **Bundler**: Vite 5.4+
- **Testes**: Vitest v4 (156 testes)
- **Build**: `tsc && vite build` | Dev: `vite` | Test: `vitest run`

## Estrutura de Arquivos
```
/
├── index.html
├── package.json
├── tsconfig.json / vite.config.ts
├── .github/workflows/deploy.yml
├── AGENTS.md
├── public/sprites/{tiles/,entities/}
└── src/
    ├── main.ts              — Config Phaser (1024×640, 12 cenas)
    ├── theme.ts             — FONT (Consolas), COLORS, FONT_SIZES
    ├── RegistryKeys.ts      — Chaves do registry para HUD
    ├── constants.ts         — MAP_W/MAP_H/TILE, constantes de combate
    ├── data/
    │   ├── tiles.ts         — TileType enum (WALL/FLOOR/STAIRS/TRAP/ALTAR/BURNED)
    │   ├── enemies.ts       — 6 templates + boss + miniboss + fragment
    │   ├── classes.ts       — 4 classes jogáveis com habilidades
    │   ├── upgrades.ts      — 30 upgrades (ALL_UPGRADES), rollUpgrades/rollRewards
    │   ├── items.ts         — 5 itens consumíveis (ItemDef sem icon)
    │   ├── purchasableAbilities.ts — 6 habilidades universais (800 bits cada)
    │   ├── metaUpgrades.ts  — 6 melhorias permanentes (bits), class floor unlocks
    │   └── keybindings.ts   — Bindings (localStorage), displayKey/actionLabel
    ├── entities/
    │   ├── Entity.ts        — Classe base (hp/maxHp/atk/def/takeDamage/heal)
    │   ├── Player.ts        — Stats, applyUpgrade, turn end (regen/bleed), inventory
    │   └── Enemy.ts         — AI: melee/ranged/suicide/splitter, moveToward/wander
    ├── systems/
    │   ├── GameState.ts     — Interface do estado global
    │   ├── TurnSystem.ts    — PLAYER → ENEMY → DONE
    │   ├── FOV.ts           — rot.js PreciseShadowcasting
    │   ├── MapGen.ts        — Digger + leaf rooms + pruneDeadEnds
    │   ├── FloorGenerator.ts— Geração de andar, spawn inimigos/boss/baús/armadilhas/altar
    │   ├── RenderSystem.ts  — RenderTexture, dirty tiles, minimap, entity sprites, HP bars
    │   ├── CombatSystem.ts  — Melee, projétil, dodge, reflect, life steal, bleed, fatal guard
    │   ├── ProjectileSystem.ts — Raycast + tween de projéteis
    │   └── ActionSystem.ts  — Habilidades (aoe, barrage, buffs, heal, shield, knockback, etc.)
    ├── scenes/
    │   ├── BootScene.ts     — Carrega PNGs, gera chests procedural
    │   ├── MainMenuScene.ts — Menu inicial com boot log, SOBRE, Comandos, Loja
    │   ├── ClassSelectScene.ts — Seleção de classe (grid de cards)
    │   ├── GameScene.ts     — Loop principal, input, turnos, death/unlock handling
    │   ├── HUDScene.ts      — 5 painéis (Stats, Habilidades+Itens, Melhorias, Log, Footer)
    │   ├── UpgradeScene.ts  — Overlay de escolha de upgrade (choice/reveal)
    │   ├── PauseScene.ts    — Menu ESC (Continuar, Comandos, Reiniciar)
    │   ├── KeyBindScene.ts  — Rebind de teclas interativo
    │   ├── ShopScene.ts     — Loja de melhorias permanentes e habilidades (bits)
    │   ├── CompendiumScene.ts — 5 abas (INIMIGOS, HABILIDADES, MELHORIAS, CLASSES, ITENS)
    │   ├── ClassUnlockScene.ts — Overlay de nova classe desbloqueada
    │   └── GameOverScene.ts — Tela de morte com resumo
    └── utils/
        └── metaSave.ts      — localStorage para bits/upgrades/unlocks/abilities
```

## Cenas (Scenes)

### BootScene
- `preload()`: Carrega PNGs de `public/sprites/tiles/` e `entities/`.
- `create()`: Gera texturas de baú proceduralmente.
- Inicia `MainMenuScene`.

### MainMenuScene
- Boot animation com log de inicialização.
- Opções: NOVO JOGO, SOBRE (Comandos/Cheats/Compêndio/Créditos), Lojas, Créditos.
- Navegação por setas + ENTER.

### ClassSelectScene
- Grid de cards com as 4 classes.
- Classes bloqueadas mostram requisito de andar.
- Limpador de Registro sempre desbloqueado.

### GameScene
- `create()`: Gera andar, configura câmera (640×640), input, HUD, meta upgrades, habilidades ativas.
- `update()`: Movement cooldown delta-based.
- `generateFloor()`: Gera mapa, spawna inimigos (comuns, mini-chefe a cada 3 andares, chefe a cada 10), baús (80%), armadilhas, altar.
- `endTurn()`: Processa pressão de classe → FOV → ataques adjacentes → AI inimiga → bleeds → turno jogador.
- Sistema de unlock automático de classes ao atingir andares específicos.
- Habilidades ativas carregadas do meta save (limite: 2 para maioria, 1 para Daemon).

### HUDScene
- 5 painéis no lado direito (648–1006):
  1. **Stats**: Nome, classe, HP bar (verde), XP bar (azul), andar, abates, status (SANGRA/CRIPTO/BOOT).
  2. **Habilidades + Itens**: Dividido verticalmente (esquerda habilidades, direita itens). Mostra cooldowns e stats das habilidades. Itens com teclas 1-6.
  3. **Melhorias**: Lista em 2 colunas com níveis.
  4. **Log**: 8 linhas com fade, cores por tipo (levelup/ouro, erro/vermelho, dano/laranja, morte/vermelho escuro, sistema/ciano).
  5. **Footer**: Versão, teclas de habilidade e item.
- Sincroniza via `registry` (hudVersion cache).

### UpgradeScene
- Overlay com 3 cards (level up) ou 1 card (baú, modo reveal).
- Categorias: STAT (#4488ff), PASSIVE (#ff9944).
- Navegação por setas + ENTER.

### PauseScene
- Overlay com Continuar, Comandos (submenu com teclas), Reiniciar.
- ESC sai.

### KeyBindScene
- Rebind de teclas interativo.
- Bindings em localStorage (`systempurge_bindings`).
- Prevenção de conflitos (movimento separado).

### ShopScene
- Loja com scroll via setas/mouse wheel.
- Seções: Melhorias Permanentes (6 itens) + Habilidades Universais (6 itens, 800 bits).
- Highlight verde no selecionado, botoes COMPRAR/ATIVA/DESATIVADA/MAX.
- Limite de habilidades ativas (2/1 para Daemon) com popup.
- Sistema de toggle (ativar/desativar habilidades compradas).

### CompendiumScene
- 5 abas clicáveis: INIMIGOS, HABILIDADES, MELHORIAS, CLASSES, ITENS.
- Colunas com labels, separador `│`, cores: vermelho para inimigos, verde para nomes de classe/COMPRÁVEIS, azul para melhorias/itens.
- Pool de 60 objetos Text reutilizados, scroll via setas.
- `v${version}` no canto.

### ClassUnlockScene
- Overlay ao desbloquear nova classe (andar 10/20/30).
- Mostra sprite + nome, opções Continuar / Menu Inicial.

### GameOverScene
- Resumo: nome, classe, andar, nível, abates.
- Botões: Tentar Novamente, Menu Inicial.

## Classes (4)

| Classe | Desbloqueio | HP | ATQ | DEF | FOV | Habilidade | CD | Passivas |
|--------|------------|----|-----|-----|-----|------------|----|----------|
| Limpador de Registro | Inicial | 30 | 5 | 2 | 8 | Varredura (melee AOE) | 5 | Melee+2 |
| Ping Sniper | Andar 10 | 22 | 7 | 1 | 10 | Rajada de Pacotes (3 projéteis leque 1.5×) | 6 | Projéteis perfurantes |
| Muralha de Dados | Andar 20 | 45 | 3 | 5 | 8 | Criptografia Total (-50% dmg 3 atq) | 8 | Reflexo 50%, Pressão 1/turno, Melee×0.5 |
| Daemon | Andar 30 | 25 | 3 | 2 | 8 | Overflow de Pilha (8 AOE+sangra) + Vazamento (10 dot) | 5/4 | Ignora defesa |

### Melhorias Exclusivas por Classe
- **Limpador**: Lâmina Energizada (sangramento), Golpe Duplo (30% ×2)
- **Ping Sniper**: Mira a Laser (+3 ATQ projétil), Recarga Rápida (CD -1)
- **Muralha**: Escudo Reativo (DEF+1, reflexo +15%), Campo Pressurizado (Pressão+1)
- **Daemon**: Script Compactado (CD-1), Dados Corrompidos (sangra+1), Estouro em Cascata (+1 alcance/nv)

## Habilidades Compartilhadas (6) — 800 bits cada
| Habilidade | CD | Efeito |
|-----------|-----|--------|
| Injeção de Vírus | 25 | 6 dano + sangra 3 por 4 turnos (dot no mais próximo) |
| Pulso de Emergência | 30 | Knockback em todos adjacentes |
| Sobrecarga de Kernel | 35 | +5 ATQ por 4 ataques |
| Barreira de Protocolo | 35 | Absorve próximo ataque |
| Restauração de Sistema | 40 | Cura 50% da vida perdida |
| Espelhamento | 40 | 100% reflect por 2 ataques |

Limite: 2 ativas (1 para Daemon). Slot R.

## Itens (5)
| Item | Efeito |
|------|--------|
| Patch de Saúde | Cura 15 HP |
| Pulso de Rede | 6 dano a todos no FOV |
| Packet Sniffer | Revela o andar |
| Overclock Inject | ATQ +5 por 5 ataques |
| Defrag Shield | DEF +5 por 5 ataques |

Slots de inventário: 2 base + até 4 via Mochila Extra (meta upgrade). Teclas 1-6.

## Upgrades (30)

### Stat Gerais (stackable)
- ATQ: Varredura de Vírus (+2), Acesso Root (+1), Cache Acelerado (+3), Barramento de Dados (+2)
- DEF: Firewall Reforçado (+2), Página de Memória (+3), Limpeza de Disco (+1)
- HP: Expansão de Memória (+10), Overclock de RAM (+8), HyperThreading (+15), Algoritmo de Compressão (+2/nível)
- Visão: Otimização do Kernel (+2), Overclock de RAM (+1), Barramento de Dados (+1)
- Misto: Limpeza de Disco (ATQ+1/DEF+1), Overclock de RAM (HP+8/Visão+1), Barramento de Dados (ATQ+2/Visão+1)

### Únicos
- Restauração do Sistema: Cura total
- Algoritmo de Compressão: HP max +2 por nível do jogador

### Passivas
- Velocidade: 2.0×/2.5×/3.0× (max 3)
- Dreno de Vida: 50% chance cura 2/4/8 (max 3)
- Escudo de Rede: Reflect 15%/30%/50% (max 3)
- Limpador de Registro: 15% dodge
- Cache Particionado: 0.3 HP/6 turnos
- Proteção do Setor de Boot: Fatal guard (1×, 25% HP)
- Camada de Criptografia: -3 dano 1º golpe/andar

## Melhorias Permanentes (6) — compradas com bits
| Melhoria | Efeito/nível | Max | Custo base |
|----------|-------------|-----|-----------|
| Núcleo Expandido | HP Max +5 | 10 | 50 |
| Compilador Ofensivo | ATQ +2 | 10 | 50 |
| Barreira Persistente | DEF +1 | 10 | 50 |
| Scanner Aprimorado | Visão +1 | 5 | 80 |
| Mochila Extra | +1 slot inv | 4 | 400 |
| Boot Acelerado | +15% XP bônus | 5 | 100 |

Custo = costBase × (level + 1). Bits ganhos: 10/andar + 2/abate + 50/boss.

## Inimigos
| Template | HP | ATQ | DEF | Comportamento | Andar mín |
|----------|-----|-----|-----|---------------|-----------|
| trojan.exe | 8 | 3 | 1 | melee | 1 |
| worm.dll | 5 | 2 | 0 | melee | 1 |
| spyware.sys | 10 | 1 | 2 | melee | 1 |
| malware.bat | 6 | 2 | 0 | ranged | 4 |
| ransomware.exe | 12 | 0 | 3 | suicide | 6 |
| overflow.dll | 8 | 1 | 1 | splitter (2 fragments) | 8 |
| admin.exe (miniboss) | 18 | 5 | 2 | melee | 3 |
| rootkit.exe (boss) | 30 | 5 | 2 | melee | 10 |

Escalabilidade: floorMult = 1 + (floor-1) * 0.075. Inimigos comuns ganham HP/ATQ/DEF extras baseados no andar. Elite (15%): 1.5× HP, 1.3× ATK, 1.2× DEF.

## Sistema de Progressão
- **XP**: Nível base 20, multiplica 1.5× por nível. Level up: HP+8, ATK+2, DEF+1 (não cura).
- **Andar**: Boss a cada 10 andares, miniboss a cada 3, escadas trancadas até boss morrer.
- **Baús**: 80% chance por andar (não boss), 1 upgrade (modo reveal).
- **Altar**: Sala especial com BURNED tile (não em andar de boss).
- **Armadilhas**: 2 + floor/2 por andar, fora da sala inicial.

## Mecânicas de Combate
- Dano = `max(1, ATK - DEF)` + meleeBonus × meleeMultiplier
- Ordem: dodge → shield → criptografia (buff) → encryption layer → fatal guard
- Life steal: 50% chance cura 2/4/8
- Reflect: upgrade (15/30/50%) OU classe (50%) OU escudo reativo (+15%)
- Golpe Duplo: 30% chance de atacar 2× no melee
- Sangramento: Lâmina Energizada causa 1 dano/3 turnos
- Pressão de Pacotes (Muralha): 1 dano/turno em adjacentes
- Knockback: empurra inimigos adjacentes (Pulso de Emergência)

## Geração de Mapa (MapGen.ts)
1. **rot.js Map.Digger**: room [4,10]×[4,8], corridor [2,5], dugPercentage 0.25.
2. **Leaf rooms**: Salas com 1 saída ganham corredor L-shaped extra.
3. **pruneDeadEnds()**: Remove FLOORs com ≤1 vizinho (fora de salas).
4. **Stairs**: STAIRS_DOWN na última sala, STAIRS_UP na sala 0 (floor ≥ 2).

## HUD (Painel Direito)
- 384px (640–1024), fundo `#0a0a18`, divisor vertical `x=640`.
- 5 sub-painéis com bordas arredondadas `#0a1a18`.
- Log: 8 linhas, cores por tipo, fade alpha.
- Footer: `System Purge v{version} [Q/E/R] Hab [1-6] Usar`

## Controles
| Tecla (padrão) | Ação |
|----------------|------|
| Setas | Mover |
| W/A/S/D | Atirar projétil |
| Q / E / R | Habilidades (classe + ativas) |
| 1–6 | Itens |
| Espaço | Aguardar turno |
| ESC | Pausar |

Todas as teclas são rebindáveis via KeyBindScene (localStorage).

## Sistema de Bits (meta save)
- localStorage: `systempurge_meta`.
- Bits: 10/andar + 2/abate + 50/boss.
- Gasto em melhorias permanentes e habilidades universais.
- `calcBitsEarned(floor, kills, bossKilled)` calcula ganho ao morrer.

## Registro (Registry)
- Comunicação GameScene → HUDScene via `this.registry` do Phaser.
- `RegistryKeys` centraliza todas as chaves.
- `hudVersion` incrementa a cada sync para evitar redraws desnecessários.

## Testes (156 testes, Vitest)
- Cobertura: Player, Enemy, Entity, upgrades (rollUpgrades/rollRewards), classes, enemies, keybindings, tiles, TurnSystem, MessageLog, metaSave, metaUpgrades, constants.
- Testes de shuffle usam Fisher-Yates (não sort-based).

## Convenções
- **PT-BR**: Todo texto jogável em português. Identificadores internos em inglês.
- **Nomenclatura**: Arquivos PascalCase para classes, camelCase para funções/variáveis.
- **Sem comentários**: Código sem comentários explicativos.
- **Sprites**: PNGs carregados no BootScene. Baús gerados proceduralmente.

## Cheat Codes
- Menu SOBRE → seção Cheats (em desenvolvimento).
