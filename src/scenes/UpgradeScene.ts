import Phaser from 'phaser';
import { Upgrade } from '../data/upgrades';

export class UpgradeScene extends Phaser.Scene {
  private options: Upgrade[] = [];
  private onSelect!: (id: string) => void;
  private acquired!: Map<string, number>;
  private selectedIndex = 0;
  private cards: { bg: Phaser.GameObjects.Graphics; y: number }[] = [];
  private mode: 'choice' | 'reveal' = 'choice';

  constructor() {
    super('Upgrade');
  }

  init(data: { options: Upgrade[]; onSelect: (id: string) => void; acquired: Map<string, number>; mode?: 'choice' | 'reveal' }) {
    this.options = data.options;
    this.onSelect = data.onSelect;
    this.acquired = data.acquired;
    this.mode = data.mode ?? 'choice';
  }

  create() {
    this.selectedIndex = 0;
    this.cards = [];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 960, 640);

    const title = this.mode === 'reveal' ? 'CHEST UPGRADE' : 'SYSTEM UPGRADE';
    const titleColor = this.mode === 'reveal' ? '#ffd700' : '#00ff88';
    this.add.text(480, 100, title, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '28px',
      color: titleColor,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, titleColor, 12, false, true);

    const div = this.add.graphics();
    div.lineStyle(2, 0x1a3a2a);
    div.lineBetween(240, 132, 720, 132);

    const startY = this.mode === 'reveal' ? 240 : 220;
    this.options.forEach((u, i) => this.drawCard(u, i, startY + i * 100));

    const footerText = this.mode === 'reveal' ? 'ENTER to continue' : 'Arrows to navigate | ENTER to choose';
    this.add.text(480, 560, footerText, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      color: '#445566',
    }).setOrigin(0.5);

    if (this.mode === 'reveal') {
      this.highlight(0);
      this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          this.confirm();
        }
      });
    } else {
      this.highlight(0);
      this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
          this.selectedIndex = (this.selectedIndex - 1 + this.options.length) % this.options.length;
          this.highlight(this.selectedIndex);
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
          this.selectedIndex = (this.selectedIndex + 1) % this.options.length;
          this.highlight(this.selectedIndex);
        }
        if (e.key === 'Enter') {
          this.confirm();
        }
      });
    }
  }

  private confirm() {
    this.onSelect(this.options[this.selectedIndex].id);
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

  private drawCard(upgrade: Upgrade, index: number, y: number) {
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
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '22px',
      color: '#44ddbb',
      fontStyle: 'bold',
    });

    const tagColor = upgrade.category === 'passive' ? '#ff9944' : '#4488ff';
    this.add.text(cx - w / 2 + 78, y + 10, upgrade.category.toUpperCase(), {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '9px',
      color: tagColor,
    });

    const curLevel = this.acquired.get(upgrade.id) ?? 0;
    const lvlTag = curLevel > 0 ? `  lv${curLevel} \u2192 lv${curLevel + 1}` : '';

    this.add.text(cx - w / 2 + 78, y + 24, `${upgrade.name}${lvlTag}`, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '15px',
      color: '#eef8ff',
    });

    this.add.text(cx - w / 2 + 78, y + 46, upgrade.description, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#8899aa',
    });
  }
}
