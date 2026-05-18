import Phaser from 'phaser';
import { version } from '../../package.json';

export class MainMenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];
  private submenuGroup?: Phaser.GameObjects.Group;
  private inSubmenu = false;

  constructor() {
    super('MainMenu');
  }

  create() {
    this.selectedIndex = 0;
    this.buttons = [];
    this.inSubmenu = false;
    this.submenuGroup = undefined;

    this.cameras.main.setBackgroundColor('#000810');
    this.playBootSequence();
  }

  private playBootSequence() {
    const lines = [
      { text: 'SISTEMA DE INICIALIZACAO v0.1', color: '#44ddbb' },
      { text: 'Verificando integridade do kernel... OK', color: '#8899aa' },
      { text: 'Carregando modulos do sistema:', color: '#8899aa' },
      { text: '  modulos/crypt/crc32.sys        [OK]', color: '#667788' },
      { text: '  modulos/net/tcpip.sys          [OK]', color: '#667788' },
      { text: '  modulos/fs/vfat.sys            [OK]', color: '#667788' },
      { text: '  modulos/sec/firewall.sys       [OK]', color: '#667788' },
      { text: 'Drivers de hardware... OK', color: '#8899aa' },
      { text: 'Memoria: 1024 KB OK', color: '#8899aa' },
      { text: '', color: '#8899aa' },
      { text: 'SISTEMA PRONTO.', color: '#00ff88' },
      { text: '', color: '#8899aa' },
    ];

    const bootTexts: Phaser.GameObjects.Text[] = [];
    const startY = 220;

    lines.forEach((line, i) => {
      this.time.delayedCall(70 * (i + 1), () => {
        const t = this.add.text(120, startY + i * 18, line.text, {
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: '12px',
          color: line.color,
        });
        bootTexts.push(t);

        if (i === lines.length - 1) {
          this.time.delayedCall(500, () => {
            bootTexts.forEach(bt => {
              this.tweens.add({
                targets: bt,
                alpha: 0,
                duration: 400,
                onComplete: () => bt.destroy(),
              });
            });
            this.time.delayedCall(400, () => this.showMainMenu());
          });
        }
      });
    });
  }

  private showMainMenu() {
    this.add.text(512, 90, 'SYSTEM PURGE', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '52px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, '#00ff88', 20, false, true);

    this.add.text(512, 140, `v${version}  —  Roguelike de Limpeza de Sistema`, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#44ddbb',
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(256, 165, 768, 165);

    this.addButton(512, 240, '[ INICIAR ]', '#00ff88', () => this.startGame());
    this.addButton(512, 300, '[ COMANDOS ]', '#44aaff', () => this.showCommands());
    this.addButton(512, 360, '[ SOBRE ]', '#ffd700', () => this.showAbout());

    this.add.text(512, 460, 'SETAS para navegar | ENTER para selecionar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    }).setOrigin(0.5);

    this.highlight(0);
    this.input.keyboard!.on('keydown', this.handleInput, this);
  }

  private handleInput(e: KeyboardEvent) {
    if (this.inSubmenu) {
      if (e.key === 'Escape') { this.hideSubmenu(); }
      return;
    }
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
  }

  private showCommands() {
    this.inSubmenu = true;
    this.submenuGroup = this.add.group();

    const g = this.submenuGroup;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x00, 0.75);
    overlay.fillRect(0, 0, 1024, 640);
    g.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(270, 110, 484, 420, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(270, 110, 484, 420, 6);
    g.add(panel);

    const title = this.add.text(512, 140, 'COMANDOS', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '22px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    g.add(title);

    const d = this.add.graphics();
    d.lineStyle(1, 0x2a4a3a);
    d.lineBetween(310, 165, 714, 165);
    g.add(d);

    const cmds = [
      { key: '\u2190 \u2191 \u2193 \u2192', desc: 'Mover personagem' },
      { key: 'W  A  S  D', desc: 'Atirar projetil' },
      { key: 'Espaco  /  .', desc: 'Aguardar um turno' },
      { key: 'ESC', desc: 'Abrir menu de pausa' },
      { key: 'R', desc: 'Reiniciar (quando morto)' },
    ];

    const style = {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      color: '#8899aa',
    };

    cmds.forEach((cmd, i) => {
      const y = 200 + i * 40;
      const k = this.add.text(310, y, cmd.key, { ...style, color: '#44ddbb', fontStyle: 'bold' });
      g.add(k);
      const v = this.add.text(440, y, cmd.desc, style);
      g.add(v);
    });

    this.add.text(512, 440, 'ESC para voltar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#445566',
    }).setOrigin(0.5);
  }

  private showAbout() {
    this.inSubmenu = true;
    this.submenuGroup = this.add.group();
    const g = this.submenuGroup;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x00, 0.75);
    overlay.fillRect(0, 0, 1024, 640);
    g.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(270, 130, 484, 380, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(270, 130, 484, 380, 6);
    g.add(panel);

    const title = this.add.text(512, 170, 'SOBRE', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '22px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    g.add(title);

    const d = this.add.graphics();
    d.lineStyle(1, 0x2a4a3a);
    d.lineBetween(310, 195, 714, 195);
    g.add(d);

    const info = [
      `System Purge v${version}`,
      '',
      'Um roguelike de terminal onde voce',
      'elimina ameacas do sistema operacional',
      'e purga o kernel de rootkits.',
      '',
      'Tecnologias: Phaser 3 + rot-js + TypeScript',
      '',
      'Victor Oliveira',
      'Participacao especial de Helena Oliveira',
    ];
    info.forEach((line, i) => {
      const t = this.add.text(512, 220 + i * 20, line, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '13px',
        color: i === 0 ? '#00ff88' : '#8899aa',
        fontStyle: i === 0 ? 'bold' : 'normal',
      }).setOrigin(0.5);
      g.add(t);
    });

    this.add.text(512, 440, 'ESC para voltar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#445566',
    }).setOrigin(0.5);
  }

  private hideSubmenu() {
    this.inSubmenu = false;
    this.submenuGroup?.destroy(true);
    this.submenuGroup = undefined;
  }

  private addButton(x: number, y: number, label: string, color: string, cb: () => void) {
    const idx = this.buttons.length;
    const text = this.add.text(x, y, label, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '22px',
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

  private startGame() {
    this.scene.start('Game');
  }
}
