import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { sound } from '../audio/SoundManager';
import { FONT, COLORS } from '../theme';

const CLASS_MAP: Record<string, { name: string; textureKey: string }> = {};
for (const c of CLASSES) {
  CLASS_MAP[c.id] = { name: c.name, textureKey: c.textureKey };
}

export class ClassUnlockScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];

  constructor() {
    super('ClassUnlock');
  }

  init(data: { classId: string }) {
    this.classId = data.classId;
  }

  private classId: string = '';

  create() {
    this.selectedIndex = 0;
    this.buttons = [];

    const classInfo = CLASS_MAP[this.classId];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(212, 120, 600, 400, 6);
    panel.lineStyle(2, 0x44ddbb);
    panel.strokeRoundedRect(212, 120, 600, 400, 6);

    this.add.text(512, 180, 'NOVA CLASSE DESBLOQUEADA', {
      fontFamily: FONT,
      fontSize: '22px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accent, 8, false, true);

    if (classInfo) {
      this.add.image(512, 250, classInfo.textureKey).setScale(4);

      this.add.text(512, 310, classInfo.name, {
        fontFamily: FONT,
        fontSize: '24px',
        color: COLORS.gold,
        fontStyle: 'bold',
      }).setOrigin(0.5);
    }

    this.addButton(512, 390, '[ Continuar ]', COLORS.subtitle, () => this.continueGame());
    this.addButton(512, 440, '[ Menu Inicial ]', COLORS.gold, () => this.goToMainMenu());

    this.add.text(512, 500, 'ENTER Continuar | ESC Menu Inicial', {
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
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      this.selectedIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'Enter') {
      sound.confirm();
      this.buttons[this.selectedIndex].cb();
    }
    if (e.key === 'Escape') {
      this.continueGame();
    }
  }

  private addButton(x: number, y: number, label: string, color: string, cb: () => void) {
    const idx = this.buttons.length;
    const text = this.add.text(x, y, label, {
      fontFamily: FONT,
      fontSize: '20px',
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

  private continueGame() {
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  private goToMainMenu() {
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.stop();
    this.scene.start('MainMenu');
  }
}
