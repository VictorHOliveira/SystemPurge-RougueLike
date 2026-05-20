import Phaser from 'phaser';
import { version } from '../../package.json';
import { ALL_ITEMS } from '../data/items';
import { CLASSES } from '../data/classes';

const HUD_X = 648;
const PANEL_W = 358;
const RIGHT = 1006;

const ITEM_NAMES: Record<string, string> = {};
for (const item of ALL_ITEMS) {
  ITEM_NAMES[item.id] = `${item.icon} ${item.name}`;
}

const CLASS_NAMES: Record<string, string> = {};
for (const c of CLASSES) {
  CLASS_NAMES[c.id] = c.name;
}

const UPGRADE_NAMES: Record<string, string> = {
  virus_scan: 'Varredura de Vírus',
  patch_firewall: 'Firewall Reforçado',
  memory_expansion: 'Expansão de Memória',
  kernel_optimization: 'Otimização do Kernel',
  root_access: 'Acesso Root',
  disk_cleanup: 'Limpeza de Disco',
  ram_overclock: 'Overclock de RAM',
  cache_boost: 'Cache Acelerado',
  memory_page: 'Página de Memória',
  hyperthreading: 'HyperThreading',
  data_bus: 'Barramento de Dados',
  system_restore: 'Restauração do Sistema',
  compression_algorithm: 'Algoritmo de Compressão',
  life_steal: 'Dreno de Vida',
  speed_boost: 'Aumento de Velocidade',
  registry_cleaner: 'Limpador de Registro',
  network_shield: 'Escudo de Rede',
  cache_partition: 'Cache Particionado',
  boot_sector: 'Proteção do Setor de Boot',
  encryption_layer: 'Camada de Criptografia',
  lamina_energizada: 'Lâmina Energizada',
  golpe_duplo: 'Golpe Duplo',
  mira_a_laser: 'Mira a Laser',
  recarga_rapida: 'Recarga Rápida',
  escudo_reativo: 'Escudo Reativo',
  campo_pressurizado: 'Campo Pressurizado',
  script_compactado: 'Script Compactado',
  dados_corrompidos: 'Dados Corrompidos',
  estouro_em_cascata: 'Estouro em Cascata',
};

const UPGRADE_DISP: Record<string, { fmt(lvl: number, plvl: number): string; color: string }> = {
  virus_scan:           { color: '#4488ff', fmt: (l) => `ATQ+${2*l}` },
  patch_firewall:       { color: '#44cc88', fmt: (l) => `DEF+${2*l}` },
  memory_expansion:     { color: '#ffdd44', fmt: (l) => `HP+${10*l}` },
  kernel_optimization:  { color: '#88ddff', fmt: (l) => `VIS+${2*l}` },
  root_access:          { color: '#4488ff', fmt: (l) => `ATQ+${1*l}` },
  disk_cleanup:         { color: '#44aaaa', fmt: (l) => `ATQ+${1*l}/DEF+${1*l}` },
  ram_overclock:        { color: '#ccaa44', fmt: (l) => `HP+${8*l}/VIS+${1*l}` },
  cache_boost:          { color: '#4488ff', fmt: (l) => `ATQ+${3*l}` },
  memory_page:          { color: '#44cc88', fmt: (l) => `DEF+${3*l}` },
  hyperthreading:       { color: '#ffdd44', fmt: (l) => `HP+${15*l}` },
  data_bus:             { color: '#44aaaa', fmt: (l) => `ATQ+${2*l}/VIS+${1*l}` },
  speed_boost:          { color: '#44ddbb', fmt: (l) => `VEL+${(0.5*l).toFixed(1)}` },
  compression_algorithm:{ color: '#ffdd44', fmt: (l, p) => p ? `HP+${p*2*l}` : `HP+?` },
  life_steal:           { color: '#aa88cc', fmt: (l) => l >= 3 ? 'Dreno 8' : l >= 2 ? 'Dreno 4' : 'Dreno 2' },
  system_restore:       { color: '#ffdd44', fmt: () => 'Cura total' },
  registry_cleaner:     { color: '#aa88cc', fmt: () => 'Esq 15%' },
  network_shield:       { color: '#aa88cc', fmt: (l) => l >= 3 ? 'Ref 50%' : l >= 2 ? 'Ref 30%' : 'Ref 15%' },
  cache_partition:      { color: '#aa88cc', fmt: () => 'Regen 0.3' },
  boot_sector:          { color: '#ff8844', fmt: () => 'Salva 1×' },
  encryption_layer:     { color: '#ff8844', fmt: () => '-3 1×/and' },
  lamina_energizada:    { color: '#aa88cc', fmt: () => 'Sangra 1' },
  golpe_duplo:          { color: '#aa88cc', fmt: () => '×2 30%' },
  mira_a_laser:         { color: '#4488ff', fmt: (l) => `ATQ+${3*l}` },
  recarga_rapida:       { color: '#aa88cc', fmt: () => 'CD-1' },
  escudo_reativo:       { color: '#44cc88', fmt: (l) => `DEF+${1*l}` },
  campo_pressurizado:   { color: '#aa88cc', fmt: () => 'Pressão+1' },
  script_compactado:    { color: '#aa88cc', fmt: () => 'CD-1' },
  dados_corrompidos:    { color: '#aa88cc', fmt: () => 'Sangra+1' },
  estouro_em_cascata:   { color: '#aa88cc', fmt: (l) => `Alc+${l}` },
};

export class HUDScene extends Phaser.Scene {
  private panel1!: Phaser.GameObjects.Graphics;
  private panel2!: Phaser.GameObjects.Graphics;
  private panel3!: Phaser.GameObjects.Graphics;
  private panel4!: Phaser.GameObjects.Graphics;

  private headerText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private classText!: Phaser.GameObjects.Text;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Graphics;
  private xpBarBg!: Phaser.GameObjects.Graphics;
  private xpText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  private abilTexts: Phaser.GameObjects.Text[] = [];
  private invTexts: Phaser.GameObjects.Text[] = [];
  private div1!: Phaser.GameObjects.Graphics;
  private div2!: Phaser.GameObjects.Graphics;

  private upgradeTitle!: Phaser.GameObjects.Text;
  private statTexts: Phaser.GameObjects.Text[] = [];

  private logHeader!: Phaser.GameObjects.Text;
  private messageTexts: Phaser.GameObjects.Text[] = [];
  private footerText!: Phaser.GameObjects.Text;

  constructor() {
    super('HUD');
  }

  create() {
    this.abilTexts = [];
    this.invTexts = [];
    this.statTexts = [];
    this.messageTexts = [];
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a18);
    bg.fillRect(640, 0, 384, 640);

    const vert = this.add.graphics();
    vert.lineStyle(1, 0x1a2a3a);
    vert.lineBetween(640, 0, 640, 640);

    this.panel1 = this.add.graphics();
    this.panel2 = this.add.graphics();
    this.panel3 = this.add.graphics();
    this.panel4 = this.add.graphics();

    this.buildPanel1();
    this.buildPanel2();
    this.buildPanel3();
    this.buildPanel4();
    this.buildFooter();
  }

  private panelRect(g: Phaser.GameObjects.Graphics, y: number, h: number) {
    g.fillStyle(0x0a1a18);
    g.fillRoundedRect(HUD_X + 4, y, PANEL_W - 8, h, 4);
    g.lineStyle(1, 0x2a4a3a);
    g.strokeRoundedRect(HUD_X + 4, y, PANEL_W - 8, h, 4);
  }

  private buildPanel1() {
    const y = 6;
    const h = 100;
    this.panelRect(this.panel1, y, h);

    const cx = HUD_X + 14;

    this.headerText = this.add.text(cx, y + 8, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      color: '#00ff88',
      fontStyle: 'bold',
    });

    this.subtitleText = this.add.text(cx, y + 26, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#44ddbb',
    });

    this.classText = this.add.text(cx, y + 40, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#8899aa',
    });

    this.hpBarBg = this.add.graphics();
    this.hpBarBg.fillStyle(0x1a1a2e);
    this.hpBarBg.fillRoundedRect(cx, y + 54, PANEL_W - 28, 14, 2);
    this.hpBarBg.lineStyle(1, 0x2a3a4a);
    this.hpBarBg.strokeRoundedRect(cx, y + 54, PANEL_W - 28, 14, 2);

    this.hpBarFill = this.add.graphics();

    this.hpText = this.add.text(cx + (PANEL_W - 28) / 2, y + 61, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.xpBarBg = this.add.graphics();
    this.xpBarBg.fillStyle(0x1a2a4e);
    this.xpBarBg.fillRoundedRect(cx, y + 70, PANEL_W - 28, 8, 2);
    this.xpBarBg.lineStyle(1, 0x2a3a4a);
    this.xpBarBg.strokeRoundedRect(cx, y + 70, PANEL_W - 28, 8, 2);

    this.xpBarFill = this.add.graphics();

    this.xpText = this.add.text(cx + (PANEL_W - 28) / 2, y + 70, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '7px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.statsText = this.add.text(cx, y + 84, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#778899',
    });
  }

  private buildPanel2() {
    const cx = HUD_X + 14;

    this.div1 = this.add.graphics();
    this.div2 = this.add.graphics();

    for (let i = 0; i < 2; i++) {
      this.abilTexts.push(this.add.text(cx, 0, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        color: '#44ddbb',
      }));
    }

    for (let i = 0; i < 3; i++) {
      this.invTexts.push(this.add.text(cx, 0, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        color: '#ffd700',
      }));
    }
  }

  private buildPanel3() {
    const cx = HUD_X + 14;

    this.upgradeTitle = this.add.text(cx, 0, 'MELHORIAS', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#445566',
    });

    for (let i = 0; i < 30; i++) {
      this.statTexts.push(this.add.text(cx, 0, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '10px',
        color: '#aabbcc',
      }));
    }
  }

  private buildPanel4() {
    this.logHeader = this.add.text(HUD_X + 14, 0, '\u203a LOG DO SISTEMA', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#445566',
    });

    for (let i = 0; i < 8; i++) {
      this.messageTexts.push(this.add.text(HUD_X + 14, 0, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '10px',
        color: '#8899aa',
      }));
    }
  }

  private buildFooter() {
    this.footerText = this.add.text(HUD_X + 14, 628, `System Purge v${version}    [Q/E] Hab  [1-3] Usar`, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '9px',
      color: '#334455',
    });
  }

  private messageColor(msg: string): string {
    if (msg.includes('***') || msg.includes('ATUALIZADO')) return '#ffdd44';
    if (msg.includes('FALHOU')) return '#ff4444';
    if (msg.includes('acerta') && msg.includes('dano')) return '#ff9977';
    if (msg.includes('neutralizado')) return '#ff6655';
    if (msg.includes('---') || msg.includes('Acessando') || msg.includes('SYSTEM PURGE') || msg.includes('Kernel')) return '#44ddbb';
    return '#8899aa';
  }

  update() {
    const hp = (this.registry.get('hp') as number) ?? 0;
    const maxHp = (this.registry.get('maxHp') as number) ?? 1;
    const level = (this.registry.get('level') as number) ?? 1;
    const floor = (this.registry.get('floor') as number) ?? 1;
    const atk = (this.registry.get('attack') as number) ?? 0;
    const def = (this.registry.get('defense') as number) ?? 0;
    const xp = (this.registry.get('xp') as number) ?? 0;
    const xpN = (this.registry.get('xpNext') as number) ?? 1;
    const kills = (this.registry.get('kills') as number) ?? 0;
    const name = (this.registry.get('name') as string) ?? 'process.exe';
    const msgs = (this.registry.get('messages') as string[]) ?? [];
    const upgrades = (this.registry.get('upgrades') as Map<string, number>) ?? new Map();
    const inventory = (this.registry.get('inventory') as (string | null)[]) ?? [null, null, null];
    const classId = (this.registry.get('classId') as string) ?? 'limpador';
    const cooldowns = (this.registry.get('cooldowns') as number[]) ?? [];
    const abilities = (this.registry.get('abilities') as { id: string; name: string; cooldown: number; type: string }[]) ?? [];
    const bleedTicks = (this.registry.get('bleedTicks') as number) ?? 0;
    const defenseBuff = (this.registry.get('defenseBuff') as number) ?? 0;

    const className = CLASS_NAMES[classId] ?? classId;
    const abilityCount = abilities.length;

    // ── Panel 1 — Status ──
    this.headerText.setText(name);
    this.subtitleText.setText(`NV ${level}  \u2502  /system/${floor}`);
    let classLine = `Classe: ${className}`;
    if (bleedTicks > 0) classLine += '   \u25b8 SANGRA';
    if (defenseBuff > 0) classLine += '   \u25b8 CRIPTO';
    this.classText.setText(classLine);

    const hpPct = Math.max(0, Math.min(1, hp / maxHp));
    const barColor = 0x00ff88;
    const barW = PANEL_W - 28;
    this.hpBarFill.clear();
    if (hpPct > 0) {
      this.hpBarFill.fillStyle(barColor);
      this.hpBarFill.fillRect(HUD_X + 15, 61, Math.floor((barW - 2) * hpPct), 12);
    }
    this.hpText.setText(`${hp}/${maxHp}`);
    this.hpText.setColor('#ff4444');

    const xpPct = Math.max(0, Math.min(1, xp / xpN));
    this.xpBarFill.clear();
    if (xpPct > 0) {
      this.xpBarFill.fillStyle(0x4488ff);
      this.xpBarFill.fillRect(HUD_X + 15, 77, Math.floor((barW - 2) * xpPct), 6);
    }
    this.xpText.setText(`${xp}/${xpN}`);

    this.statsText.setText(`ABATES  ${kills}`);

    // ── Panel 2 — Ações (abilities + inventory, fixed y=112 h=110) ──
    const p2y = 112;
    const p2h = 110;
    this.panel2.clear();
    this.panelRect(this.panel2, p2y, p2h);

    const cx = HUD_X + 14;
    let curY = p2y + 8;

    for (let i = 0; i < 2; i++) {
      if (i < abilityCount) {
        const a = abilities[i];
        const cd = cooldowns[i] ?? 0;
        const ready = cd === 0;
        const key = i === 0 ? 'Q' : 'E';
        const status = ready ? 'PRONTO' : `CD: ${cd}`;
        const pad = Math.max(1, 36 - a.name.length - status.length);
        this.abilTexts[i].setText(`[${key}] ${a.name}${' '.repeat(pad)}${status}`);
        this.abilTexts[i].setColor(ready ? '#44ddbb' : '#ff6644');
        this.abilTexts[i].setY(curY);
        this.abilTexts[i].setVisible(true);
        curY += 18;
      } else {
        this.abilTexts[i].setVisible(false);
      }
    }

    curY += 4;
    this.div1.clear();
    this.div1.lineStyle(1, 0x1a3a2a, 0.5);
    this.div1.lineBetween(HUD_X + 14, curY, RIGHT - 14, curY);
    curY += 6;

    for (let i = 0; i < 3; i++) {
      const id = inventory[i];
      const txt = id && ITEM_NAMES[id] ? `[${i + 1}] ${ITEM_NAMES[id]}` : `[${i + 1}] ---`;
      this.invTexts[i].setText(txt);
      this.invTexts[i].setY(curY);
      this.invTexts[i].setVisible(true);
      curY += 16;
    }

    // ── Panel 3 — Melhorias (lista de upgrades) ──
    const p3y = 230;
    const p3h = 258;
    this.panel3.clear();
    this.panelRect(this.panel3, p3y, p3h);

    curY = p3y + 8;
    this.upgradeTitle.setY(curY);
    curY += 14;

    const upgradeLines: { text: string; color: string }[] = [];
    for (const [id, lvl] of upgrades) {
      const info = UPGRADE_DISP[id];
      const bonus = info ? info.fmt(lvl, level) : '';
      const color = info ? info.color : '#aabbcc';
      const name = UPGRADE_NAMES[id] ?? id;
      upgradeLines.push({ text: `${name.padEnd(22)} ${bonus.padEnd(12)} nv${lvl}`, color });
    }

    for (let i = 0; i < this.statTexts.length; i++) {
      if (i < upgradeLines.length) {
        this.statTexts[i].setText(upgradeLines[i].text);
        this.statTexts[i].setPosition(cx, curY);
        this.statTexts[i].setColor(upgradeLines[i].color);
        this.statTexts[i].setVisible(true);
        curY += 14;
      } else {
        this.statTexts[i].setVisible(false);
      }
    }

    // ── Panel 4 — LOG (fixed y=494 h=130) ──
    const p4y = 494;
    const p4h = 130;
    this.panel4.clear();
    this.panelRect(this.panel4, p4y, p4h);
    this.logHeader.setY(p4y + 6);

    const logStartY = p4y + 20;
    const lineH = 14;
    const maxLines = 8;
    const total = msgs.length;
    const offset = Math.max(0, total - maxLines);

    for (let i = 0; i < maxLines; i++) {
      const msgIdx = i + offset;
      if (msgIdx < total) {
        const msg = msgs[msgIdx];
        this.messageTexts[i].setText(msg);
        this.messageTexts[i].setColor(this.messageColor(msg));
        const alpha = maxLines > 1 ? 0.55 + 0.45 * (i / (maxLines - 1)) : 1;
        this.messageTexts[i].setAlpha(alpha);
        this.messageTexts[i].setY(logStartY + i * lineH);
        this.messageTexts[i].setVisible(true);
      } else {
        this.messageTexts[i].setVisible(false);
      }
    }
  }
}
