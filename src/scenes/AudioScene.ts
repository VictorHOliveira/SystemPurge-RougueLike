import Phaser from 'phaser';
import { FONT, COLORS } from '../theme';
import { sound } from '../audio/SoundManager';
import { bgm } from '../audio/BGMPlayer';
import { loadAudioSettings, saveAudioSettings } from '../utils/audioSave';

export class AudioScene extends Phaser.Scene {
  private selectedIndex = 0;
  private settings = loadAudioSettings();
  private musicBar!: Phaser.GameObjects.Graphics;
  private sfxBar!: Phaser.GameObjects.Graphics;
  private musicLabel!: Phaser.GameObjects.Text;
  private sfxLabel!: Phaser.GameObjects.Text;
  private returnScene = 'MainMenu';

  constructor() {
    super('Audio');
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? 'MainMenu';
  }

  create() {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(270, 130, 484, 300, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(270, 130, 484, 300, 6);

    this.add.text(512, 165, 'CONFIG ÁUDIO', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(310, 190, 714, 190);

    this.musicLabel = this.add.text(320, 235, `Música   ${Math.round(this.settings.musicVolume * 100)}%`, {
      fontFamily: FONT,
      fontSize: '16px',
      color: COLORS.lightText,
    });
    this.musicBar = this.add.graphics();
    this.drawBar(this.musicBar, 320, 260, this.settings.musicVolume, 0x44aaff);

    this.sfxLabel = this.add.text(320, 295, `Efeitos  ${Math.round(this.settings.sfxVolume * 100)}%`, {
      fontFamily: FONT,
      fontSize: '16px',
      color: COLORS.lightText,
    });
    this.sfxBar = this.add.graphics();
    this.drawBar(this.sfxBar, 320, 320, this.settings.sfxVolume, 0x44ff88);

    this.add.text(512, 375, '↑↓ selecionar  ← → ajustar  ESC voltar', {
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
    if (e.key === 'Escape') {
      sound.confirm();
      this.scene.resume(this.returnScene);
      this.scene.stop();
      return;
    }
    if (e.key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowDown') {
      this.selectedIndex = Math.min(1, this.selectedIndex + 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowLeft') {
      this.adjust(-0.1);
    }
    if (e.key === 'ArrowRight') {
      this.adjust(0.1);
    }
  }

  private adjust(delta: number) {
    if (this.selectedIndex === 0) {
      const v = Math.round((this.settings.musicVolume + delta) * 10) / 10;
      this.settings.musicVolume = Math.max(0, Math.min(1, v));
      bgm.volume = this.settings.musicVolume;
      this.musicLabel.setText(`Música   ${Math.round(this.settings.musicVolume * 100)}%`);
      this.drawBar(this.musicBar, 320, 260, this.settings.musicVolume, 0x44aaff);
    } else {
      const v = Math.round((this.settings.sfxVolume + delta) * 10) / 10;
      this.settings.sfxVolume = Math.max(0, Math.min(1, v));
      sound.sfxVolume = this.settings.sfxVolume;
      this.sfxLabel.setText(`Efeitos  ${Math.round(this.settings.sfxVolume * 100)}%`);
      this.drawBar(this.sfxBar, 320, 320, this.settings.sfxVolume, 0x44ff88);
      sound.select();
    }
    saveAudioSettings(this.settings);
  }

  private drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, pct: number, color: number) {
    g.clear();
    const w = 200;
    const h = 8;
    const segments = 10;
    const segW = (w - (segments - 1)) / segments;
    const filled = Math.round(pct * segments);

    for (let i = 0; i < segments; i++) {
      const sx = x + i * (segW + 1);
      if (i < filled) {
        g.fillStyle(color, 1);
      } else {
        g.fillStyle(0x334455, 0.6);
      }
      g.fillRect(sx, y, segW, h);
    }
  }

  private highlight(idx: number) {
    const musicColor = idx === 0 ? COLORS.accent : COLORS.lightText;
    const sfxColor = idx === 1 ? COLORS.accent : COLORS.lightText;
    this.musicLabel.setColor(musicColor);
    this.sfxLabel.setColor(sfxColor);
  }
}
