import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { FONT, COLORS } from '../theme';
import { loadMeta, saveMeta, calcBitsEarned } from '../utils/metaSave';
import { deleteRunSave } from '../utils/runSave';

const CLASS_NAMES: Record<string, string> = {};
for (const c of CLASSES) {
  CLASS_NAMES[c.id] = c.name;
}

export class GameOverScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];
  private stats!: { floor: number; level: number; kills: number; bossKilled: boolean };
  private playerName: string = '';
  private className: string = '';
  private bitsEarned: number = 0;

  constructor() {
    super('GameOver');
  }

  init(data: { floor: number; level: number; kills: number; name: string; classId: string; bossKilled: boolean }) {
    this.stats = data;
    this.playerName = data.name;
    this.className = CLASS_NAMES[data.classId] ?? data.classId;
    this.bitsEarned = calcBitsEarned(data.floor, data.kills, data.bossKilled);
  }

  create() {
    this.selectedIndex = 0;
    this.buttons = [];

    deleteRunSave();

    const meta = loadMeta();
    meta.bits += this.bitsEarned;
    saveMeta(meta);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(262, 80, 500, 480, 6);
    panel.lineStyle(2, 0xff4444);
    panel.strokeRoundedRect(262, 80, 500, 480, 6);

    this.add.text(512, 120, 'SISTEMA FALHOU', {
      fontFamily: FONT,
      fontSize: '42px',
      color: COLORS.error,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.error, 15, false, true);

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(320, 160, 704, 160);

    const statsLines = [
      `Processo: ${this.playerName}`,
      `Classe: ${this.className}`,
      `Profundidade: /system/${this.stats.floor}`,
      `Nível: ${this.stats.level}`,
      `Abates: ${this.stats.kills}`,
    ];
    statsLines.forEach((line, i) => {
      this.add.text(512, 195 + i * 26, line, {
        fontFamily: FONT,
        fontSize: '14px',
        color: COLORS.subtitle,
      }).setOrigin(0.5);
    });

    const bitsY = 340;
    const div2 = this.add.graphics();
    div2.lineStyle(1, 0x2a4a3a);
    div2.lineBetween(320, bitsY - 10, 704, bitsY - 10);

    this.add.text(512, bitsY + 6, `Bits ganhos: +${this.bitsEarned}`, {
      fontFamily: FONT,
      fontSize: '18px',
      color: COLORS.gold,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(512, bitsY + 30, `Total: ${meta.bits} Bits`, {
      fontFamily: FONT,
      fontSize: '14px',
      color: COLORS.accent,
    }).setOrigin(0.5);

    const btnY = bitsY + 60;
    const div3 = this.add.graphics();
    div3.lineStyle(1, 0x2a4a3a);
    div3.lineBetween(320, btnY - 6, 704, btnY - 6);

    this.addButton(512, btnY + 10, '[ Reiniciar ]', COLORS.accent, () => this.restartGame());
    this.addButton(512, btnY + 65, '[ Menu Inicial ]', COLORS.gold, () => this.goToMainMenu());

    this.add.text(512, btnY + 115, 'Setas para navegar | ENTER para selecionar', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.highlight(0);

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlight(this.selectedIndex);
    }
    if (e.key === 'ArrowDown') {
      this.selectedIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
      this.highlight(this.selectedIndex);
    }
    if (e.key === 'Enter') {
      this.buttons[this.selectedIndex].cb();
    }
  }

  private addButton(x: number, y: number, label: string, color: string, cb: () => void) {
    const idx = this.buttons.length;
    const text = this.add.text(x, y, label, {
      fontFamily: FONT,
      fontSize: '24px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => { this.selectedIndex = idx; text.setColor(color); });
    text.on('pointerout', () => { this.highlight(this.selectedIndex); });
    text.on('pointerdown', cb);

    this.buttons.push({ text, color, cb });
  }

  private highlight(idx: number) {
    this.buttons.forEach((b, i) => {
      b.text.setColor(i === idx ? b.color : COLORS.muted);
    });
  }

  private restartGame() {
    this.registry.set('restartPending', true);
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  private goToMainMenu() {
    this.registry.set('restartPending', false);
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.stop();
    this.scene.start('MainMenu');
  }
}
