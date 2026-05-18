# System Purge — Conhecimento do Projeto

## Visão Geral

Roguelike turn-based com tema de computador/vírus em web (Phaser 3 + TypeScript + rot.js). O jogador é `process.exe` e deve limpar diretórios (andares) infestados de malware, subindo de nível com melhorias e enfrentando um chefe (`rootkit.exe`) a cada 5 andares.

- **Canvas**: 1024×640 (640 game + 384 painel direito HUD)
- **Tile**: 32×32 pixels
- **Mapa**: 60×40 tiles
- **URL**: `https://anomalyco.github.io/SystemPurge-RougueLike/`
- **Versão atual**: 0.1.5

---

## Stack

| Camada | Tecnologia |
|---|---|
| Game engine | Phaser 3 v3.80+ |
| Linguagem | TypeScript 5.4+ (strict) |
| Geração de mapa | rot.js v2.2 (Map.Digger) |
| FOV | rot.js FOV.PreciseShadowcasting |
| Bundler | Vite 5.4+ |
| Build | `tsc && vite build` |
| Deploy | GitHub Actions (push em master → GitHub Pages) |
| Base path | `/SystemPurge-RougueLike/` (vite.config.ts) |

---

## Estrutura de Arquivos

```
/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .github/workflows/deploy.yml
├── public/sprites/
│   ├── tiles/          (PNGs carregados no BootScene)
│   └── entities/       (PNGs de player, inimigos, projetil)
└── src/
    ├── main.ts         (config Phaser, 1024×640)
    ├── data/
    │   ├── tiles.ts    (TileType enum, walkable/transparent)
    │   ├── enemies.ts  (templates de inimigos + chefe)
    │   └── upgrades.ts (22 upgrades, rollUpgrades)
    ├── entities/
    │   ├── Entity.ts   (classe base HP/ATK/DEF)
    │   ├── Player.ts   (stats, applyUpgrade, passivas)
    │   └── Enemy.ts    (AI: chase/wander)
    ├── systems/
    │   ├── FOV.ts      (PreciseShadowcasting)
    │   ├── MapGen.ts   (Digger + leaf rooms + pruneDeadEnds)
    │   └── TurnSystem.ts (PLAYER → ENEMY → DONE)
    ├── ui/
    │   └── MessageLog.ts (buffer de 100 msgs, getLast(10))
    ├── world/
    │   └── GameMap.ts  (tiles[][], explored[][], visible[][])
    └── scenes/
        ├── BootScene.ts    (carrega PNGs, gera chests procedural)
        ├── GameScene.ts    (loop principal, combate, projetil)
        ├── HUDScene.ts     (painel direito com stats/log)
        ├── UpgradeScene.ts (seleção de melhorias overlay)
        └── PauseScene.ts   (menu ESC com Comandos)
```

---

## Cenas (Scenes)

### BootScene
- `preload()`: Carrega todos os PNGs de `public/sprites/tiles/` e `public/sprites/entities/`.
- `create()`: Gera texturas de baú proceduralmente (chest, chest_opened e variações dim).
- Inicia `GameScene`.

### GameScene
- **create()**: `generateFloor()`, configura câmera (viewport 0,0,640,640, bounds até 60×40 tiles), registra teclas e handler.
- **update()**: Sincroniza registry (HUD lê daqui), processa movimento com arrow keys (cooldown delta-based).
- **generateFloor()**: Gera mapa via MapGen, spawna jogador na sala 0, spawna inimigos (3 tipos aleatórios + chefe se floor%5===0), baus (80% chance), configura FOV e turn system.
- **handleInput(e)**: ESC pausa, R reinicia (morto), Space/. wait, WASD projétil.
- **processMove(dx,dy)**: Verifica inimigo adjacente (ataca), parede (cancela), STAIRS_DOWN com boss vivo (bloqueia), STAIRS_DOWN sem boss (próximo andar), chão (move+tween+endTurn), baú (abre overlay).
- **meleeAttack(attacker,defender)**: `max(1, ATK - DEF)`, processa dodge, encryption layer, life steal, reflect, fatal guard.
- **fireProjectile(dx,dy)**: Raycast até FOV range, tween 80ms, consome 1 turno.
- **endTurn()**: Fim do turno jogador → processa ataques adjacentes → AI inimigos → reset → redraw.
- **showUpgradeChoices()**: Pausa, lança UpgradeScene com 3 opções.
- **redrawRT()**: RenderTexture com tiles explorados (versões visible/dim), baus sobrepostos.
- **syncEntitySprites()**: Posiciona sprites de entidades, oculta inimigos não visíveis.
- **centerOnPlayer()**: camera.pan com Sine.easeInOut 80ms.

### HUDScene
- Painel direito 640–1024, fundo `#0a0a18`.
- **Header**: Nome do processo, "NV {level} │ DIR: /system/{floor}".
- **Barras**: HP (verde/amarelo/vermelho, 18px), XP (azul, 10px).
- **Stats**: "ATQ {atk} DEF {def} ABATES {kills}".
- **Melhorias**: Lista com ▸ nome nv{lvl}.
- **Log**: 10 linhas, 12px monospace, cores por tipo (dano=laranja, ouro=levelup/baú, vermelho=erro, ciano=entrada/sistema, padrão=cinza).
- **Footer**: "System Purge v{version}" + "[ESC] Menu".
- Mensagens > 46 chars truncadas com "...".

### UpgradeScene
- Overlay 960×640 com fundo semi-transparente.
- Modos: 'choice' (setas + ENTER, 3 cards) ou 'reveal' (ENTER, 1 card, para baú).
- Cards com número, categoria (STAT/PASSIVE), nome, nível atual → próximo, descrição.
- Chama onSelect callback, para a cena.

### PauseScene
- Overlay com 3 botões: Continuar, Comandos (submenu com teclas), Reiniciar.
- Navegação por setas + ENTER, ESC sai.

---

## Mecânicas do Jogo

### Turnos
```
PLAYER_TURN → (jogador age) → ENEMY_TURN → DONE → reset → PLAYER_TURN
```
- `endTurn()` no GameScene: fecha turno jogador, processa ataques adjacentes, AI, reset.
- Segurar seta: cooldown = `max(40, 120 / effectiveMoveSpeed)` ms, delta-based.
- Tween de movimento: `max(20, 60 / effectiveMoveSpeed)` ms.

### Combate
```
dano = max(1, ATK_atacante - DEF_defensor)
```
- Inimigos adjacentes ao jogador atacam no início da fase ENEMY_TURN (**processAdjacentAttacks**).
- Inimigos que se movem para perto do jogador durante AI atacam em seguida.
- Dodge (15%, Registry Cleaner), Dano reduzido (-3, Encryption Layer), Life Steal (50%, 2/4/8), Reflect (15/30/50%, 2 dano), Fatal Guard (1 HP, Boot Sector).

### Projétil (WASD)
- Atira na direção, raycast até FOV range.
- Dano = `meleeAttack()` (usa ATK do jogador).
- Tween 80ms, consome 1 turno.
- Pode acertar parede ou inimigo.

### Progressão
- **XP**: Nível base 20, multiplica 1.5× a cada nível.
- **Level up**: HPmax+8, ATK+2, DEF+1, cura NÃO automática (só upgrades que explicitamente curam).
- **Andar**: Stairs na última sala, STAIRS_UP na sala 0 a partir do andar 2.
- **Boss** a cada 5 andares: escadas trancadas até boss morrer, baú de tesouro aparece na morte.

### Fórmulas de Escalabilidade

**Multiplicador de andar:**
```
floorMult = 1 + (floor - 1) * 0.075
```

**Inimigos comuns:**
```
hp = ceil(template.hp * floorMult)
atk = ceil(template.attack * floorMult)
def = ceil(template.defense * floorMult)
```

**Boss (rootkit.exe):**
```
hp = ceil(player.maxHp * floorMult * 0.5 + 10)
atk = ceil(3 + player.attack * floorMult * 0.4)
def = ceil(1 + player.defense * floorMult * 0.3)
```

---

## Sistema de Upgrades (22 upgrades)

### Stat upgrades (stackable)
| id | Nome (PT-BR) | Efeito |
|---|---|---|
| virus_scan | Varredura de Vírus | ATQ +2 |
| patch_firewall | Firewall Reforçado | DEF +2 |
| memory_expansion | Expansão de Memória | HPmax+10, cura 10 |
| kernel_optimization | Otimização do Kernel | Visão +2 |
| root_access | Acesso Root | ATQ +1 |
| disk_cleanup | Limpeza de Disco | ATQ+1, DEF+1 |
| ram_overclock | Overclock de RAM | HPmax+8, Visão+1, cura 8 |
| cache_boost | Cache Acelerado | ATQ +3 |
| memory_page | Página de Memória | DEF +3 |
| hyperthreading | HyperThreading | HPmax+15, cura 15 |
| data_bus | Barramento de Dados | ATQ+2, Visão+1 |

### Unique stat upgrades
| id | Nome | Efeito |
|---|---|---|
| system_restore | Restauração do Sistema | Cura total |
| compression_algorithm | Algoritmo de Compressão | HPmax+2/level, cura igual |

### Speed Boost (stackable, maxLevel: 3)
| id | Nome | Nv1 | Nv2 | Nv3 |
|---|---|---|---|---|
| speed_boost | Aumento de Velocidade | 2.0× | 2.5× | 3.0× |

Base de 1.5×; cooldown mínimo 40ms.

### Life Steal (stackable, maxLevel: 3)
| id | Nome | Nv1 | Nv2 | Nv3 |
|---|---|---|---|---|
| life_steal | Dreno de Vida | 2 HP (50%) | 4 HP (50%) | 8 HP (50%) |

### Passive upgrades
| id | Nome | Efeito | unique | maxLevel |
|---|---|---|---|---|
| registry_cleaner | Limpador de Registro | 15% dodge | sim | — |
| network_shield | Escudo de Rede | Reflect 15/30/50% (dano 2) | não | 3 |
| cache_partition | Cache Particionado | 0.3 HP a cada 6 turnos | sim | — |
| boot_sector | Proteção do Setor de Boot | Fatal guard (1×) | sim | — |
| encryption_layer | Camada de Criptografia | -3 dano 1º golpe/andar | sim | — |

### Seleção
- `rollUpgrades(acquired, count)`: Filtra pool (exclui unique já adquiridos, respeita maxLevel), shuffle, pega N.
- Level-up: 3 opções. Baú: 1 opção (modo reveal).
- Navegação por setas + ENTER.

---

## Geração de Mapa (MapGen.ts)

1. **rot.js Map.Digger** com parâmetros:
   - roomWidth: [4, 10], roomHeight: [4, 8]
   - corridorLength: [2, 5]
   - dugPercentage: 0.25
2. **Pós-processamento**: Salas "leaf" (com apenas 1 saída) ganham corredor L-shaped extra para a sala mais próxima.
3. **pruneDeadEnds()**: Remove tiles FLOOR fora de salas com ≤1 vizinho caminhável (elimina corredores sem saída). Loop até estabilizar.
4. **Stairs**: STAIRS_DOWN na última sala, STAIRS_UP na sala 0 (floor ≥ 2).

---

## Sprites

### Carregados de PNG (BootScene preload)
**Tiles:** `tile_wall`, `tile_wall_dim`, `tile_floor`, `tile_floor_dim`, `tile_stairs`, `tile_stairs_dim`, `tile_stairs_up`, `tile_stairs_up_dim`

**Entities:** `entity_player`, `enemy_trojan`, `enemy_worm`, `enemy_spyware`, `enemy_boss`, `projectile_player`

### Gerados proceduralmente (BootScene create)
`tile_chest`, `tile_chest_dim`, `tile_chest_opened`, `tile_chest_opened_dim`

---

## HUD (Painel Direito)

- **Largura**: 384px (640–1024)
- **Fundo**: `#0a0a18`
- **Divisor vertical**: x=640, `#1a2a3a`
- **Área de log**: fillRoundedRect(644, 444, 366, 170, 3), fundo `#040810`
- **Texto do log**: HUD_X+6=654, 12px monospace, 10 linhas com 16px spacing
- **Truncamento**: MAX_LOG_CHARS = 46, mensagens maiores cortadas com "..."
- **Cores do log**:
  - `#ffdd44`: Level up / baú / ATUALIZADO 
  - `#ff4444`: FALHOU / erro
  - `#ff9977`: Ataque com dano
  - `#ff6655`: neutralizado
  - `#44ddbb`: Entrada de andar / sistema
  - `#8899aa`: Padrão

---

## Controles

| Tecla | Ação |
|---|---|
| Setas | Mover |
| W/A/S/D | Atirar projétil |
| Space / . | Aguardar turno |
| ESC | Menu de pausa |
| R | Reiniciar (quando morto) |

---

## Mensagens PT-BR (chave)

- "*** ALERTA: ROOTKIT DETECTADO ***"
- "*** ROOTKIT ativo — elimine-o primeiro ***"
- "Acessando próximo diretório..."
- "--- /system/dir_{floor} ---"
- "SYSTEM PURGE v0.1 — Kernel inicializado."
- "{attacker} acerta {defender} com {dano} de dano."
- "{enemy} foi neutralizado."
- "*** SISTEMA ATUALIZADO para v{level} ***"
- "*** SISTEMA FALHOU — Pressione R para reiniciar ***"
- "Baú: {upgrade} ({descrição})"
- "Baú vazio."
- "Um baú de tesouro aparece!"
- "Projétil acertou a parede."
- "Limpador de Registro desviou de {attacker}."
- "Camada de Criptografia reduziu dano em 3."
- "Dreno de Vida restaurou {ls} HP."
- "Escudo de Rede refletiu {dano} de dano ({chance}% de chance)."
- "Proteção do Setor de Boot! Sobreviveu com 1 HP."

### HUD labels
- "HP", "XP"
- "ATQ {atk} DEF {def} ABATES {kills}"
- "MELHORIAS"
- "▸ {nome} nv{lvl}"
- "▸ LOG DO SISTEMA"
- "System Purge v{version}"
- "[ESC] Menu"

### Menu de pausa
- "PAUSADO"
- "[ Continuar ]"
- "[ Comandos ]"
- "[ Reiniciar ]"
- "Setas para navegar | ENTER para selecionar"
- "ESC para continuar"

### Submenu Comandos
- "COMANDOS"
- "← ↑ ↓ →" → "Mover"
- "W A S D" → "Atirar projétil"
- "Space / ." → "Aguardar um turno"
- "ESC" → "Abrir menu de pausa"
- "R" → "Reiniciar (quando morto)"
- "ESC para voltar"

### UpgradeScene
- "MELHORIA DO SISTEMA" (nível up)
- "BAÚ DE MELHORIA" (baú)
- "Setas para navegar | ENTER para escolher"
- "ENTER para continuar"
- Categorias: "STAT" (#4488ff), "PASSIVE" (#ff9944)
- Rótulo: "nv{cur} → nv{cur+1}"

---

## Configuração do Projeto

### package.json scripts
```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview"
}
```

### tsconfig.json
- target: ESNext, module: ESNext, moduleResolution: bundler
- strict: true, resolveJsonModule: true, noEmit: true

### vite.config.ts
- base: '/SystemPurge-RougueLike/' (importante para GitHub Pages)
- build.target: esnext

### Deploy (.github/workflows/deploy.yml)
- Trigger: push em master
- Node 20, npm ci, npm run build
- upload-pages-artifact + deploy-pages
- Permissions: contents:read, pages:write, id-token:write

---

## Decisões de Design

- **Reinício**: `window.location.reload()` (simples e confiável).
- **Baús**: Não alteram TileType; desenhados sobre FLOOR no redrawRT. Abertura via overlay (modo reveal).
- **Escadas**: TileTypes separados (STAIRS_UP, STAIRS_DOWN). Spawn na sala 0 (entrada) e última sala (saída).
- **XP**: Não escala com inimigos; valor fixo baseado no template (`hp + attack`).
- **Level-up não cura**: Apenas upgrades com efeito explícito de cura restauram HP.
- **Cache Partition**: Acumulador fracionário 0.3 a cada 6 turnos; cura 1 quando ≥1.
- **Ataques adjacentes**: Processados em duas levas — antes do AI (inimigos já adjacentes) e durante o AI (inimigos que se moveram para perto).
- **dead-end pruning**: Remove corredores sem saída iterativamente, ignorando tiles dentro de salas.
- **PT-BR**: Todo texto jogável em português (upgrades, mensagens, menus, HUD, comandos). Nomes de arquivo/identificadores internos em inglês.

---

## Histórico de Versões

| Versão | Mudanças |
|---|---|
| 0.1.0 | Projeto inicial, movimento, combate, FOV, turnos |
| 0.1.1 | Upgrade system, HUD, pause menu |
| 0.1.2 | Boss system, chests, smooth movement, projectiles |
| 0.1.3 | PNG sprites, GitHub Pages deploy, PT-BR translation |
| 0.1.4 | Dead-end pruning, PT-BR fixes, balance |
| 0.1.5 | Canvas expandido 960→1024, painel direito 320→384px, truncamento de log (46 chars) |
