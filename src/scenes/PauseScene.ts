import Phaser from 'phaser';

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
    panel.fillRoundedRect(280, 160, 400, 320, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(280, 160, 400, 320, 6);

    this.add.text(480, 200, 'PAUSED', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '32px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, '#00ff88', 10, false, true);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x2a4a3a);
    divider.lineBetween(340, 232, 620, 232);

    this.addButton(480, 295, '[ Resume ]', '#44ddbb', () => this.resumeGame());
    this.addButton(480, 355, '[ Restart ]', '#ff6644', () => this.restartGame());

    this.add.text(480, 430, 'Arrows to navigate | ENTER to select', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    }).setOrigin(0.5);

    this.add.text(480, 450, 'ESC to resume', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    }).setOrigin(0.5);

    this.highlight(0);

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') { this.resumeGame(); return; }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
        this.highlight(this.selectedIndex);
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
        this.highlight(this.selectedIndex);
      }
      if (e.key === 'Enter') {
        this.buttons[this.selectedIndex].cb();
      }
    });
  }

  private addButton(x: number, y: number, label: string, color: string, cb: () => void) {
    const idx = this.buttons.length;
    const text = this.add.text(x, y, label, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '20px',
      color: '#8899aa',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    text.on('pointerover', () => { this.selectedIndex = idx; text.setColor(color); });
    text.on('pointerout', () => { this.highlight(this.selectedIndex); });
    text.on('pointerdown', cb);

    this.buttons.push({ text, color, cb });
  }

  private highlight(idx: number) {
    this.buttons.forEach((b, i) => {
      b.text.setColor(i === idx ? b.color : '#8899aa');
    });
  }

  private resumeGame() {
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  private restartGame() {
    window.location.reload();
  }
}
