import Phaser from 'phaser';
import { Upgrade } from '../data/upgrades';
import { ItemDef } from '../data/items';
import { trackEvent } from '../analytics';
import { FONT, COLORS, FONT_SIZES } from '../theme';

interface CardOption {
  kind: 'upgrade' | 'item' | 'heal';
  id: string;
  name: string;
  description: string;
  tag: string;
  tagColor: string;
  subtitle?: string;
}

export class UpgradeScene extends Phaser.Scene {
  private options: CardOption[] = [];
  private onSelect!: (kind: 'upgrade' | 'item' | 'heal', id: string) => void;
  private selectedIndex = 0;
  private cards: { bg: Phaser.GameObjects.Graphics; y: number }[] = [];
  private mode: 'choice' | 'reveal' = 'choice';
  private floor: number = 1;
  private pickCount: number = 1;

  constructor() {
    super('Upgrade');
  }

  init(data: {
    upgrades: Upgrade[];
    items: ItemDef[];
    heals?: { id: string; name: string; description: string; amount: number }[];
    acquired: Map<string, number>;
    onSelect: (kind: 'upgrade' | 'item' | 'heal', id: string) => void;
    mode?: 'choice' | 'reveal';
    floor?: number;
    pickCount?: number;
    title?: string;
  }) {
    this.pickCount = data.pickCount ?? 1;
    this.options = [];
    for (const u of data.upgrades) {
      const curLevel = data.acquired.get(u.id) ?? 0;
      const lvlTag = curLevel > 0 ? `  nv${curLevel} \u2192 nv${curLevel + 1}` : '';
      this.options.push({
        kind: 'upgrade',
        id: u.id,
        name: u.name,
        description: u.description,
        tag: u.category.toUpperCase(),
        tagColor: u.category === 'passive' ? COLORS.tagAccent : COLORS.statAtk,
        subtitle: lvlTag,
      });
    }
    for (const item of data.items) {
      this.options.push({
        kind: 'item',
        id: item.id,
        name: item.name,
        description: item.description,
        tag: 'ITEM',
        tagColor: COLORS.gold,
      });
    }
    if (data.heals) {
      for (const h of data.heals) {
        this.options.push({
          kind: 'heal',
          id: h.id,
          name: h.name,
          description: h.description,
          tag: 'CURA',
          tagColor: COLORS.accent,
        });
      }
    }
    this.options.sort(() => Math.random() - 0.5);
    this.onSelect = data.onSelect;
    this.mode = data.mode ?? 'choice';
    this.floor = data.floor ?? 1;
  }

  create() {
    this.selectedIndex = 0;
    this.cards = [];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 1024, 640);

    const titleText = (this.scene.settings.data as Record<string, unknown>)?.title as string | undefined;
    const title = titleText ?? (this.mode === 'reveal' ? 'BAÚ DE RECOMPENSA' : 'RECOMPENSA DO SISTEMA');
    const titleColor = this.mode === 'reveal' ? COLORS.gold : COLORS.accent;
    this.add.text(480, 100, title, {
      fontFamily: FONT,
      fontSize: '28px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, titleColor, 12, false, true);

    const div = this.add.graphics();
    div.lineStyle(2, 0x1a3a2a);
    div.lineBetween(240, 132, 720, 132);

    const cardH = 74;
    const cardGap = this.options.length > 3 ? 10 : 14;
    const totalH = this.options.length * (cardH + cardGap) - cardGap;
    const startY = Math.max(150, Math.floor((560 - totalH) / 2));
    this.options.forEach((opt, i) => this.drawCard(opt, i, startY + i * (cardH + cardGap)));

    const footerText = this.mode === 'reveal' ? 'ENTER para continuar' : `Setas para navegar | ENTER para escolher (${this.pickCount} restante(s))`;
    this.add.text(480, 580, footerText, {
      fontFamily: FONT,
      fontSize: '14px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.highlight(0);
    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === '1') { this.selectedIndex = 0; this.confirm(); return; }
    if (e.key === '2') { this.selectedIndex = 1; this.confirm(); return; }
    if (e.key === '3') { this.selectedIndex = 2; this.confirm(); return; }
    if (this.mode === 'reveal') {
      if (e.key === 'Enter') { this.confirm(); }
      return;
    }
    if (e.key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlight(this.selectedIndex);
    }
    if (e.key === 'ArrowDown') {
      this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
      this.highlight(this.selectedIndex);
    }
    if (e.key === 'Enter') {
      this.confirm();
    }
  }

  private confirm() {
    const opt = this.options[this.selectedIndex];
    trackEvent('upgrade_select', { upgrade_id: opt.id, upgrade_name: opt.name, floor: this.floor });
    this.onSelect(opt.kind, opt.id);
    this.scene.stop();
  }

  private highlight(idx: number) {
    this.cards.forEach((card, i) => {
      card.bg.clear();
      card.bg.fillStyle(0x0a1a18);
      card.bg.fillRoundedRect(260, card.y, 440, 74, 4);
      card.bg.lineStyle(i === idx ? 2 : 1, i === idx ? 0x44ddbb : 0x2a4a3a);
      card.bg.strokeRoundedRect(260, card.y, 440, 74, 4);
    });
  }

  private drawCard(opt: CardOption, index: number, y: number) {
    const cx = 480;
    const w = 440;
    const h = 74;

    const bg = this.add.graphics();
    bg.fillStyle(0x0a1a18);
    bg.fillRoundedRect(260, y, w, h, 4);
    bg.lineStyle(1, 0x2a4a3a);
    bg.strokeRoundedRect(260, y, w, h, 4);

    this.cards.push({ bg, y });

    this.add.text(cx - w / 2 + 22, y + 14, `[${index + 1}]`, {
      fontFamily: FONT,
      fontSize: '22px',
      color: COLORS.subtitle,
      fontStyle: 'bold',
    });

    this.add.text(cx - w / 2 + 78, y + 10, opt.tag, {
      fontFamily: FONT,
      fontSize: '9px',
      color: opt.tagColor,
    });

    const nameText = `${opt.name}${opt.subtitle ?? ''}`;
    this.add.text(cx - w / 2 + 78, y + 24, nameText, {
      fontFamily: FONT,
      fontSize: '15px',
      color: COLORS.lightText,
    });

    this.add.text(cx - w / 2 + 78, y + 46, opt.description, {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.muted,
    });
  }
}
