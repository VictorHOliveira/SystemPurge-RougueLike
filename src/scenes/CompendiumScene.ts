import Phaser from 'phaser';
import { ENEMY_TEMPLATES, BOSS_TEMPLATE, MINIBOSS_TEMPLATE, FRAGMENT_TEMPLATE } from '../data/enemies';
import { CLASSES } from '../data/classes';
import { PURCHASABLE_ABILITIES } from '../data/purchasableAbilities';
import { ALL_UPGRADES } from '../data/upgrades';
import { ALL_ITEMS } from '../data/items';
import { FONT, COLORS } from '../theme';
import { version } from '../../package.json';

const BEHAVIOR_LABEL: Record<string, string> = {
  melee: 'Corpo a Corpo',
  ranged: 'À Distância',
  suicide: 'Suicida',
  splitter: 'Divisor',
};

const TAB_COUNT = 5;
const TAB_NAMES = ['INIMIGOS', 'HABILIDADES', 'MELHORIAS', 'CLASSES', 'ITENS'];
const TAB_X = [300, 400, 500, 600, 700];
const CONTENT_X = 220;
const CONTENT_Y = 146;
const ROW_H = 13;
const POOL_SIZE = 30;
const SEP = '  ';

const CLASS_UPGRADE_NAMES: Record<string, string[]> = {
  limpador: ['Lâmina Energizada', 'Golpe Duplo'],
  ping_sniper: ['Mira a Laser', 'Recarga Rápida'],
  muralha: ['Escudo Reativo', 'Campo Pressurizado'],
  daemon: ['Script Compactado', 'Dados Corrompidos', 'Estouro em Cascata'],
};

interface ColDef {
  label: string;
  w: number;
  align: 'l' | 'r';
}

const COLS: ColDef[][] = [
  [ // INIMIGOS
    { label: 'Nome', w: 22, align: 'l' },
    { label: 'HP', w: 4, align: 'r' },
    { label: 'ATQ', w: 4, align: 'r' },
    { label: 'DEF', w: 4, align: 'r' },
    { label: 'Tipo', w: 14, align: 'l' },
    { label: 'Andar', w: 6, align: 'r' },
  ],
  [ // HABILIDADES
    { label: '', w: 4, align: 'l' },
    { label: 'Nome', w: 22, align: 'l' },
    { label: 'CD', w: 4, align: 'r' },
    { label: 'Descrição', w: 40, align: 'l' },
    { label: 'Custo', w: 8, align: 'r' },
  ],
  [ // MELHORIAS
    { label: 'Nome', w: 24, align: 'l' },
    { label: 'Descrição', w: 46, align: 'l' },
    { label: 'Tipo', w: 10, align: 'l' },
  ],
  [ // CLASSES
    { label: 'Atributo', w: 22, align: 'l' },
    { label: 'Valor', w: 56, align: 'l' },
  ],
  [ // ITENS
    { label: 'Nome', w: 22, align: 'l' },
    { label: 'Descrição', w: 58, align: 'l' },
  ],
];

interface AccentRule {
  prefixChars: number;
  prefixColor: string;
}

function pad(text: string, w: number, align: 'l' | 'r'): string {
  if (text.length > w) return text.slice(0, w);
  return align === 'r' ? text.padStart(w) : text.padEnd(w);
}

function fmtRow(cells: string[], cols: ColDef[]): string {
  return cells.map((c, i) => pad(c, cols[i].w, cols[i].align)).join(SEP);
}

function hdrRow(cols: ColDef[]): string {
  return fmtRow(cols.map(c => c.label), cols);
}

function sepRow(cols: ColDef[]): string {
  return cols.map(c => '\u2500'.repeat(c.w)).join(SEP);
}

function col1End(cols: ColDef[]): number {
  return cols[0].w + SEP.length;
}

export class CompendiumScene extends Phaser.Scene {
  private currentTab = 0;
  private scrollOffset = 0;
  private returnScene = 'MainMenu';

  private tabTexts: Phaser.GameObjects.Text[] = [];
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private accentTexts: Phaser.GameObjects.Text[] = [];

  private tabContent: string[][] = [[], [], [], [], []];
  private tabAccent: (AccentRule | null)[][] = [[], [], [], [], []];
  private maxVisibleLines = 28;
  private charW = 7;

  constructor() {
    super('Compendium');
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data?.returnScene ?? 'MainMenu';
  }

  create() {
    this.currentTab = 0;
    this.scrollOffset = 0;
    this.tabTexts = [];
    this.rowTexts = [];
    this.accentTexts = [];

    const temp = this.add.text(-999, -999, 'WWWWWWWWWW', {
      fontFamily: FONT, fontSize: '11px',
    });
    this.charW = Math.round(temp.width / 10);
    temp.destroy();

    this.buildEnemyContent();
    this.buildAbilityContent();
    this.buildUpgradeContent();
    this.buildClassContent();
    this.buildItemContent();

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.82);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(192, 60, 640, 520, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(192, 60, 640, 520, 6);

    this.add.text(512, 85, 'COMP\u00caNDIO', {
      fontFamily: FONT,
      fontSize: '18px',
      color: COLORS.gold,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    for (let i = 0; i < TAB_COUNT; i++) {
      const t = this.add.text(TAB_X[i], 112, TAB_NAMES[i], {
        fontFamily: FONT,
        fontSize: '12px',
        color: i === 0 ? COLORS.accent : COLORS.dimText,
        fontStyle: 'bold',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => this.setTab(i));
      this.tabTexts.push(t);
    }

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(210, 132, 814, 132);

    const style = { fontFamily: FONT, fontSize: '11px' as const };
    for (let i = 0; i < POOL_SIZE; i++) {
      const y = CONTENT_Y + i * ROW_H;
      const a = this.add.text(CONTENT_X, y, '', { ...style, color: COLORS.lightText }).setVisible(false);
      const r = this.add.text(CONTENT_X, y, '', { ...style, color: COLORS.lightText }).setVisible(false);
      this.accentTexts.push(a);
      this.rowTexts.push(r);
    }

    this.add.text(512, 562, '\u2190 \u2192 Aba  |  \u2191 \u2198 Rolar  |  ESC Voltar', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.add.text(814, 85, `v${version}`, {
      fontFamily: FONT,
      fontSize: '10px',
      color: COLORS.dimText,
    }).setOrigin(1, 0.5);

    this.renderContent();

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private setTab(idx: number) {
    if (idx === this.currentTab) return;
    this.currentTab = idx;
    this.scrollOffset = 0;
    for (let i = 0; i < TAB_COUNT; i++) {
      this.tabTexts[i].setColor(i === idx ? COLORS.accent : COLORS.dimText);
    }
    this.renderContent();
  }

  private handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      this.scene.start(this.returnScene);
      return;
    }
    if (e.key === 'ArrowLeft') {
      this.setTab(Math.max(0, this.currentTab - 1));
    }
    if (e.key === 'ArrowRight') {
      this.setTab(Math.min(TAB_COUNT - 1, this.currentTab + 1));
    }
    if (e.key === 'ArrowUp') {
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this.renderContent();
      }
    }
    if (e.key === 'ArrowDown') {
      const lines = this.tabContent[this.currentTab];
      if (this.scrollOffset + this.maxVisibleLines < lines.length) {
        this.scrollOffset++;
        this.renderContent();
      }
    }
  };

  private renderContent() {
    const lines = this.tabContent[this.currentTab];
    const accents = this.tabAccent[this.currentTab];
    const start = this.scrollOffset;

    for (let i = 0; i < POOL_SIZE; i++) {
      this.accentTexts[i].setVisible(false);
      this.rowTexts[i].setVisible(false);

      const idx = start + i;
      if (idx >= lines.length) continue;
      const line = lines[idx];
      const rule = accents[idx];

      if (!rule) {
        this.rowTexts[i].setText(line);
        this.rowTexts[i].setColor(COLORS.lightText);
        this.rowTexts[i].setX(CONTENT_X);
        this.rowTexts[i].setVisible(true);
      } else if (rule.prefixChars < 0) {
        this.rowTexts[i].setText(line);
        this.rowTexts[i].setColor(rule.prefixColor);
        this.rowTexts[i].setX(CONTENT_X);
        this.rowTexts[i].setVisible(true);
      } else {
        const n = rule.prefixChars;
        this.accentTexts[i].setText(line.slice(0, n));
        this.accentTexts[i].setColor(rule.prefixColor);
        this.accentTexts[i].setX(CONTENT_X);
        this.accentTexts[i].setVisible(true);

        this.rowTexts[i].setText(line.slice(n));
        this.rowTexts[i].setColor(COLORS.lightText);
        this.rowTexts[i].setX(CONTENT_X + n * this.charW + 1);
        this.rowTexts[i].setVisible(true);
      }
    }
  }

  private buildEnemyContent() {
    const cols = COLS[0];
    const lines: string[] = [];
    const acc: (AccentRule | null)[] = [];
    const col1EndPixel = col1End(cols);
    lines.push(hdrRow(cols)); acc.push(null);
    lines.push(sepRow(cols)); acc.push(null);
    for (const e of ENEMY_TEMPLATES) {
      const bh = BEHAVIOR_LABEL[e.behavior] ?? e.behavior;
      lines.push(fmtRow([e.name, `${e.hp}`, `${e.attack}`, `${e.defense}`, bh, `${e.minFloor}`], cols));
      acc.push({ prefixChars: col1EndPixel, prefixColor: COLORS.error });
    }
    lines.push(''); acc.push(null);
    const bosses = [BOSS_TEMPLATE, MINIBOSS_TEMPLATE, FRAGMENT_TEMPLATE];
    for (const e of bosses) {
      const label = e === FRAGMENT_TEMPLATE ? '' : e === MINIBOSS_TEMPLATE ? ' (MiniChefe)' : ' (Chefe)';
      const bh = BEHAVIOR_LABEL[e.behavior] ?? e.behavior;
      lines.push(fmtRow([e.name + label, `${e.hp}`, `${e.attack}`, `${e.defense}`, bh, `${e.minFloor}`], cols));
      acc.push({ prefixChars: col1EndPixel, prefixColor: COLORS.error });
    }
    this.tabContent[0] = lines;
    this.tabAccent[0] = acc;
  }

  private buildAbilityContent() {
    const cols = COLS[1];
    const lines: string[] = [];
    const acc: (AccentRule | null)[] = [];
    lines.push(hdrRow(cols)); acc.push(null);
    lines.push(sepRow(cols)); acc.push(null);
    for (const c of CLASSES) {
      lines.push(`  ${c.name}`); acc.push({ prefixChars: -1, prefixColor: COLORS.accent });
      const keys = ['Q', 'W'];
      c.abilities.forEach((a, i) => {
        lines.push(fmtRow([`[${keys[i]}]`, a.name, `${a.cooldown}`, a.description, ''], cols));
        acc.push(null);
      });
      lines.push(''); acc.push(null);
    }
    lines.push('  COMPR\xc1VEIS'); acc.push({ prefixChars: -1, prefixColor: COLORS.accent });
    PURCHASABLE_ABILITIES.forEach(a => {
      lines.push(fmtRow(['[E]', a.name, `${a.cooldown}`, a.description, `${a.cost}B`], cols));
      acc.push(null);
    });
    this.tabContent[1] = lines;
    this.tabAccent[1] = acc;
  }

  private buildUpgradeContent() {
    const cols = COLS[2];
    const lines: string[] = [];
    const acc: (AccentRule | null)[] = [];
    const col1EndPixel = col1End(cols);
    lines.push(hdrRow(cols)); acc.push(null);
    lines.push(sepRow(cols)); acc.push(null);
    const categories: { label: string; filter: (u: typeof ALL_UPGRADES[0]) => boolean }[] = [
      { label: '  STAT GERAIS', filter: u => u.category === 'stat' && !u.classId },
      { label: '  PASSIVAS', filter: u => u.category === 'passive' && !u.classId },
    ];
    for (const cat of categories) {
      const entries = ALL_UPGRADES.filter(cat.filter);
      if (entries.length === 0) continue;
      lines.push(cat.label); acc.push(null);
      for (const u of entries) {
        const tag = u.unique ? '\u00danica' : u.maxLevel ? `Nv\u00a0${u.maxLevel}` : '';
        lines.push(fmtRow([u.name, u.description, tag], cols));
        acc.push({ prefixChars: col1EndPixel, prefixColor: COLORS.statAtk });
      }
      lines.push(''); acc.push(null);
    }
    this.tabContent[2] = lines;
    this.tabAccent[2] = acc;
  }

  private buildClassContent() {
    const cols = COLS[3];
    const lines: string[] = [];
    const acc: (AccentRule | null)[] = [];
    lines.push(hdrRow(cols)); acc.push(null);
    lines.push(sepRow(cols)); acc.push(null);
    for (const c of CLASSES) {
      lines.push(fmtRow(['', c.name], cols));
      acc.push({ prefixChars: -1, prefixColor: COLORS.accent });
      lines.push(fmtRow(['HP', `${c.hp}`], cols)); acc.push(null);
      lines.push(fmtRow(['ATQ', `${c.attack}`], cols)); acc.push(null);
      lines.push(fmtRow(['DEF', `${c.defense}`], cols)); acc.push(null);
      lines.push(fmtRow(['VEL', `${c.moveSpeed.toFixed(1)}\u00d7`], cols)); acc.push(null);
      lines.push(fmtRow(['FOV', `${c.fov}`], cols)); acc.push(null);
      const combatLabel = c.canMelee && c.canShoot ? 'Misto'
        : c.canMelee ? 'Corpo a corpo' : '\u00c0 dist\u00e2ncia';
      lines.push(fmtRow(['Tipo', combatLabel], cols)); acc.push(null);
      const passiveParts: string[] = [];
      if (c.meleeBonus > 0 && c.canMelee) passiveParts.push(`Melee+${c.meleeBonus}`);
      if (c.ignoreDefense) passiveParts.push('Ignora defesa');
      if (c.projectilesPierce) passiveParts.push('Perfurante');
      if (c.reflectPercent > 0) passiveParts.push(`Reflexo ${c.reflectPercent}%`);
      if (c.pressureDamage > 0) passiveParts.push(`Press\u00e3o ${c.pressureDamage}/turno`);
      if (c.meleeMultiplier < 1) passiveParts.push(`Melee ${c.meleeMultiplier * 100}%`);
      if (passiveParts.length > 0) {
        lines.push(fmtRow(['Passivas', passiveParts.join(' | ')], cols)); acc.push(null);
      }
      c.abilities.forEach(a => {
        lines.push(fmtRow([`[${a.name}]`, `${a.description}  (CD ${a.cooldown})`], cols));
        acc.push(null);
      });
      const upgrades = CLASS_UPGRADE_NAMES[c.id] ?? [];
      if (upgrades.length > 0) {
        lines.push(fmtRow(['Melhorias', upgrades.join(', ')], cols)); acc.push(null);
      }
      lines.push(''); acc.push(null);
    }
    this.tabContent[3] = lines;
    this.tabAccent[3] = acc;
  }

  private buildItemContent() {
    const cols = COLS[4];
    const lines: string[] = [];
    const acc: (AccentRule | null)[] = [];
    const col1EndPixel = col1End(cols);
    lines.push(hdrRow(cols)); acc.push(null);
    lines.push(sepRow(cols)); acc.push(null);
    for (const item of ALL_ITEMS) {
      lines.push(fmtRow([item.name, item.description], cols));
      acc.push({ prefixChars: col1EndPixel, prefixColor: COLORS.statAtk });
    }
    this.tabContent[4] = lines;
    this.tabAccent[4] = acc;
  }
}
