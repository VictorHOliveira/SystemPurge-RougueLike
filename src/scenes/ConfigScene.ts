import Phaser from 'phaser';
import { FONT, COLORS } from '../theme';
import { sound } from '../audio/SoundManager';

export class ConfigScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];
  private returnScene = 'Pause';

  constructor() {
    super('Config');
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? 'Pause';
  }

  create() {
    this.selectedIndex = 0;
    this.buttons = [];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(270, 130, 484, 300, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(270, 130, 484, 300, 6);

    this.add.text(512, 165, 'CONFIGURAÇÕES', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(310, 190, 714, 190);

    this.addButton(512, 240, '[ Controles ]', COLORS.menuAccent, () => this.openKeybinds());
    this.addButton(512, 300, '[ Áudio ]', COLORS.subtitle, () => this.openAudio());

    this.add.text(512, 370, 'ESC para voltar', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.highlight(0);

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') { this.goBack(); return; }
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

  private addButton(x: number, y: number, label: string, color: string, cb: () => void) {
    const idx = this.buttons.length;
    const text = this.add.text(x, y, label, {
      fontFamily: FONT,
      fontSize: '22px',
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

  private openKeybinds() {
    const parent = this.returnScene;
    this.scene.stop();
    this.scene.launch('KeyBind', { returnScene: parent });
  }

  private openAudio() {
    const parent = this.returnScene;
    this.scene.stop();
    this.scene.launch('Audio', { returnScene: parent });
  }

  private goBack() {
    sound.confirm();
    this.scene.resume(this.returnScene);
    this.scene.stop();
  }
}
