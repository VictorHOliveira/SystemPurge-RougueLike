import Phaser from 'phaser';
import { sound } from '../audio/SoundManager';
import { FONT, COLORS, FONT_SIZES } from '../theme';

export class PauseScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];

  constructor() {
    super('Pause');
  }

  create() {
    this.selectedIndex = 0;
    this.buttons = [];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, 960, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(280, 140, 400, 360, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(280, 140, 400, 360, 6);

    this.add.text(480, 175, 'PAUSADO', {
      fontFamily: FONT,
      fontSize: '32px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accent, 10, false, true);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x2a4a3a);
    divider.lineBetween(340, 205, 620, 205);

    this.addButton(480, 250, '[ Continuar ]', COLORS.subtitle, () => this.resumeGame());
    this.addButton(480, 310, '[ Controles ]', COLORS.menuAccent, () => this.showControls());
    this.addButton(480, 370, '[ Reiniciar ]', COLORS.abilityCd, () => this.restartGame());
    this.addButton(480, 430, '[ Menu Inicial ]', COLORS.gold, () => this.goToMainMenu());

    this.add.text(480, 480, 'Setas para navegar | ENTER para selecionar', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.add.text(480, 498, 'ESC para continuar', {
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
    if (e.key === 'Escape') { this.resumeGame(); return; }
    if (e.key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowDown') {
      this.selectedIndex = Math.min(this.buttons.length - 1, this.selectedIndex + 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'Enter') {
      sound.confirm();
      this.buttons[this.selectedIndex].cb();
    }
  }

  private showControls() {
    this.scene.pause();
    this.scene.launch('KeyBind', { returnScene: 'Pause' });
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

  private resumeGame() {
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
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
