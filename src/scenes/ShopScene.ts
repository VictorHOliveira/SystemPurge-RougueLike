import Phaser from 'phaser';
import { META_UPGRADES, getMetaCost } from '../data/metaUpgrades';
import { PURCHASABLE_ABILITIES } from '../data/purchasableAbilities';
import { loadMeta, saveMeta } from '../utils/metaSave';
import { FONT, COLORS } from '../theme';

interface SelectableItem {
  name: string;
  desc: string;
  costLabel?: string;
  maxed: boolean;
  canAfford: boolean;
  onBuy?: () => boolean | void;
  active?: boolean;
}

const ROW_H = 62;
const LIST_Y = 118;
const LIST_H = 480;

export class ShopScene extends Phaser.Scene {
  private selectedIndex = 0;
  private scrollOffset = 0;
  private maxScroll = 0;
  private meta = loadMeta();
  private bitsText!: Phaser.GameObjects.Text;
  private highlightBgs: Phaser.GameObjects.Graphics[] = [];
  private items: SelectableItem[] = [];
  private container!: Phaser.GameObjects.Container;
  private scrollUpArrow!: Phaser.GameObjects.Text;
  private scrollDownArrow!: Phaser.GameObjects.Text;
  private popupActive = false;
  private popupElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Shop');
  }

  create() {
    this.meta = loadMeta();
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.highlightBgs = [];
    this.items = [];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000810);
    overlay.fillRect(0, 0, 1024, 640);

    this.add.text(512, 40, '\u25c8 NUCLEO DO SISTEMA \u25c8', {
      fontFamily: FONT,
      fontSize: '28px',
      color: COLORS.gold,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.gold, 12, false, true);

    this.bitsText = this.add.text(512, 78, '', {
      fontFamily: FONT,
      fontSize: '18px',
      color: COLORS.accent,
    }).setOrigin(0.5);
    this.updateBitsDisplay();

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(200, 100, 824, 100);

    this.items = this.buildItemList();
    const totalH = this.items.length * ROW_H;
    this.maxScroll = Math.max(0, totalH - LIST_H);

    this.container = this.add.container(0, 0);

    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(160, LIST_Y, 704, LIST_H);
    const mask = new Phaser.Display.Masks.GeometryMask(this, maskShape);
    this.container.setMask(mask);

    this.scrollUpArrow = this.add.text(870, 130, '\u25b2', {
      fontFamily: FONT,
      fontSize: '18px',
      color: COLORS.dimText,
    }).setOrigin(0.5).setAlpha(0);

    this.scrollDownArrow = this.add.text(870, 580, '\u25bc', {
      fontFamily: FONT,
      fontSize: '18px',
      color: COLORS.dimText,
    }).setOrigin(0.5).setAlpha(0);

    this.rebuildItems();

    this.add.text(512, 615, 'SETAS navegar | ENTER comprar | ESC sair', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.updateHighlight();

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (this.popupActive) {
        if (e.key === 'Enter' || e.key === 'Escape') this.closePopup();
        return;
      }
      if (e.key === 'ArrowDown') { this.select(this.selectedIndex + 1); return; }
      if (e.key === 'ArrowUp') { this.select(this.selectedIndex - 1); return; }
      if (e.key === 'Enter') { this.activate(this.selectedIndex); return; }
      if (e.key === 'Escape') this.scene.start('MainMenu');
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], dz: number[]) => {
      this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + dz[0] * 0.5, 0, this.maxScroll);
      this.applyScroll();
    });

    this.events.on('shutdown', () => {
      if (this.popupActive) this.closePopup();
      this.input.keyboard?.removeAllListeners();
      this.input.off('wheel');
    });
  }

  private rebuildItems() {
    this.container.removeAll(true);
    this.highlightBgs = [];

    this.items.forEach((item, i) => {
      const y = LIST_Y + i * ROW_H;

      const bg = this.add.graphics();
      bg.fillStyle(0x0a1a18);
      bg.fillRoundedRect(160, y, 704, ROW_H - 4, 4);
      bg.lineStyle(1, 0x2a4a3a);
      bg.strokeRoundedRect(160, y, 704, ROW_H - 4, 4);
      this.highlightBgs.push(bg);
      this.container.add(bg);

      const name = this.add.text(180, y + 6, item.name, {
        fontFamily: FONT,
        fontSize: '14px',
        color: COLORS.lightText,
        fontStyle: 'bold',
      });
      this.container.add(name);

      const desc = this.add.text(180, y + 26, item.desc, {
        fontFamily: FONT,
        fontSize: '11px',
        color: COLORS.muted,
      });
      this.container.add(desc);

      const isToggle = item.active !== undefined;
      const costColor = isToggle
        ? (item.active ? COLORS.accent : COLORS.dimText)
        : item.canAfford ? COLORS.gold : COLORS.error;
      const cost = this.add.text(700, y + 8, item.costLabel ?? '', {
        fontFamily: FONT,
        fontSize: '12px',
        color: costColor,
      }).setOrigin(0.5, 0);
      this.container.add(cost);

      const btnLabel = isToggle
        ? (item.active ? '[ ATIVA ]' : '[ DESATIVADA ]')
        : item.canAfford ? '[ COMPRAR ]' : item.maxed ? '[ MAX ]' : '[---]';
      const btnColor = isToggle
        ? (item.active ? COLORS.accent : COLORS.dimText)
        : item.canAfford ? COLORS.accent : COLORS.dimText;
      const btn = this.add.text(700, y + 28, btnLabel, {
        fontFamily: FONT,
        fontSize: '13px',
        color: btnColor,
        fontStyle: 'bold',
      }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true });
      this.container.add(btn);

      btn.on('pointerover', () => { if (isToggle || item.canAfford) btn.setColor(COLORS.gold); this.select(i); });
      btn.on('pointerout', () => { btn.setColor(btnColor); });
      btn.on('pointerdown', () => this.activate(i));
    });

    this.applyScroll();
    this.updateHighlight();
  }

  private select(idx: number) {
    if (idx < 0 || idx >= this.items.length) return;
    this.selectedIndex = idx;

    const topY = idx * ROW_H;
    const botY = topY + ROW_H;
    if (topY < this.scrollOffset) {
      this.scrollOffset = topY;
    } else if (botY > this.scrollOffset + LIST_H) {
      this.scrollOffset = botY - LIST_H;
    }
    this.applyScroll();
    this.updateHighlight();
  }

  private applyScroll() {
    this.container.y = -this.scrollOffset;
    this.scrollUpArrow.setAlpha(this.scrollOffset > 0 ? 0.6 : 0);
    this.scrollDownArrow.setAlpha(this.scrollOffset < this.maxScroll ? 0.6 : 0);
  }

  private updateHighlight() {
    this.highlightBgs.forEach((bg, i) => {
      bg.clear();
      const y = LIST_Y + i * ROW_H;
      if (i === this.selectedIndex) {
        bg.fillStyle(0x0f2a20);
        bg.fillRoundedRect(160, y, 704, ROW_H - 4, 4);
        bg.lineStyle(2, 0x00ff88);
        bg.strokeRoundedRect(160, y, 704, ROW_H - 4, 4);
      } else {
        bg.fillStyle(0x0a1a18);
        bg.fillRoundedRect(160, y, 704, ROW_H - 4, 4);
        bg.lineStyle(1, 0x2a4a3a);
        bg.strokeRoundedRect(160, y, 704, ROW_H - 4, 4);
      }
    });
  }

  private activate(idx: number) {
    const item = this.items[idx];
    if (!item.canAfford || !item.onBuy) return;
    const result = item.onBuy();
    if (result !== false) this.refresh();
  }

  private updateBitsDisplay() {
    this.bitsText.setText(`Bits: ${this.meta.bits}`);
  }

  private refresh() {
    const selSav = this.selectedIndex;
    const scrollSav = this.scrollOffset;

    this.meta = loadMeta();
    this.updateBitsDisplay();
    this.items = this.buildItemList();

    const totalH = this.items.length * ROW_H;
    this.maxScroll = Math.max(0, totalH - LIST_H);
    this.selectedIndex = Math.min(selSav, this.items.length - 1);
    this.scrollOffset = Math.min(scrollSav, this.maxScroll);

    this.rebuildItems();
  }

  private buildItemList(): SelectableItem[] {
    const items: SelectableItem[] = [];

    for (const def of META_UPGRADES) {
      const lvl = this.meta.upgrades[def.id] ?? 0;
      const cost = getMetaCost(def, lvl);
      const canAfford = this.meta.bits >= cost && lvl < def.maxLevel;
      items.push({
        name: `${def.name}  nv${lvl}/${def.maxLevel}`,
        desc: def.description,
        costLabel: canAfford || lvl < def.maxLevel ? `${cost} Bits` : '',
        maxed: lvl >= def.maxLevel,
        canAfford,
        onBuy: canAfford ? () => {
          this.meta.bits -= cost;
          this.meta.upgrades[def.id] = (this.meta.upgrades[def.id] ?? 0) + 1;
          saveMeta(this.meta);
        } : undefined,
      });
    }

    const divider: SelectableItem = {
      name: '\u2500\u2500\u2500  HABILIDADES  \u2500\u2500\u2500',
      desc: 'Habilidades universais (slot R)',
      maxed: true,
      canAfford: false,
    };
    items.push(divider);

    for (const def of PURCHASABLE_ABILITIES) {
      const owned = this.meta.purchasedAbilities?.includes(def.id) ?? false;
      const active = this.meta.activeAbilities?.includes(def.id) ?? false;
      const cost = def.cost;
      const canBuy = this.meta.bits >= cost && !owned;
      items.push({
        name: def.name,
        desc: `CD: ${def.cooldown}  |  ${def.description}`,
        costLabel: owned ? (active ? '[ATIVA]' : '[DESATIVADA]') : `${cost} Bits`,
        maxed: false,
        canAfford: owned || canBuy,
        active: owned ? active : undefined,
        onBuy: owned
          ? () => this.toggleAbility(def.id)
          : canBuy
          ? () => {
              this.meta.bits -= cost;
              this.meta.purchasedAbilities = [...(this.meta.purchasedAbilities ?? []), def.id];
              saveMeta(this.meta);
              return true;
            }
          : undefined,
      });
    }

    return items;
  }

  private showPopup(message: string) {
    if (this.popupActive) return;
    this.popupActive = true;
    this.popupElements = [];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, 1024, 640);
    this.popupElements.push(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(262, 230, 500, 180, 6);
    panel.lineStyle(2, 0xff8844);
    panel.strokeRoundedRect(262, 230, 500, 180, 6);
    this.popupElements.push(panel);

    const text = this.add.text(512, 290, message, {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.lightText,
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    this.popupElements.push(text);

    const ok = this.add.text(512, 380, '[ OK ]', {
      fontFamily: FONT,
      fontSize: '16px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    ok.on('pointerdown', () => this.closePopup());
    this.popupElements.push(ok);
  }

  private closePopup() {
    this.popupElements.forEach(e => e.destroy());
    this.popupElements = [];
    this.popupActive = false;
  }

  private toggleAbility(id: string): boolean {
    const active = this.meta.activeAbilities ?? [];
    if (active.includes(id)) {
      this.meta.activeAbilities = active.filter(a => a !== id);
      saveMeta(this.meta);
      return true;
    }
    if (active.length >= 2) {
      this.showPopup(
        'Limite de habilidades ativas atingido!\n\n' +
        'Limpador de Registro, Ping Sniper\n' +
        'e Muralha de Dados: at\u00e9 2 ativas.\n' +
        'Daemon: at\u00e9 1 ativa.\n\n' +
        'Desative uma para ativar outra.'
      );
      return false;
    }
    this.meta.activeAbilities = [...active, id];
    saveMeta(this.meta);
    return true;
  }
}
