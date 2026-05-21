import Phaser from 'phaser';
import { sound } from '../audio/SoundManager';
import { loadBindings, displayKey } from '../data/keybindings';

export class PauseScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];
  private commandsGroup?: Phaser.GameObjects.Group;
  private inSubmenu = false;

  constructor() {
    super('Pause');
  }

  create() {
    this.selectedIndex = 0;
    this.buttons = [];
    this.inSubmenu = false;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, 960, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(280, 120, 400, 410, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(280, 120, 400, 410, 6);

    this.add.text(480, 155, 'PAUSADO', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '32px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, '#00ff88', 10, false, true);

    const divider = this.add.graphics();
    divider.lineStyle(1, 0x2a4a3a);
    divider.lineBetween(340, 185, 620, 185);

    this.addButton(480, 250, '[ Continuar ]', '#44ddbb', () => this.resumeGame());
    this.addButton(480, 300, '[ Comandos ]', '#44aaff', () => this.showCommands());
    this.addButton(480, 350, '[ Controles ]', '#ffcc44', () => this.showControls());
    this.addButton(480, 400, '[ Reiniciar ]', '#ff6644', () => this.restartGame());
    this.addButton(480, 450, '[ Menu Inicial ]', '#ffd700', () => this.goToMainMenu());

    this.add.text(480, 490, 'Setas para navegar | ENTER para selecionar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    }).setOrigin(0.5);

    this.add.text(480, 508, 'ESC para continuar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    }).setOrigin(0.5);

    this.highlight(0);

    this.input.keyboard!.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private handleKey(e: KeyboardEvent) {
    if (this.inSubmenu) {
      if (e.key === 'Escape') { this.hideCommands(); sound.select(); }
      return;
    }
    if (e.key === 'Escape') { this.resumeGame(); return; }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      this.selectedIndex = (this.selectedIndex - 1 + this.buttons.length) % this.buttons.length;
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      this.selectedIndex = (this.selectedIndex + 1) % this.buttons.length;
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
    this.scene.launch('KeyBind');
  }

  private showCommands() {
    this.inSubmenu = true;
    this.commandsGroup = this.add.group();
    const g = this.commandsGroup;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 960, 640);
    g.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(240, 100, 480, 440, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(240, 100, 480, 440, 6);
    g.add(panel);

    const title = this.add.text(480, 130, 'COMANDOS', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '20px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    g.add(title);

    const d = this.add.graphics();
    d.lineStyle(1, 0x2a4a3a);
    d.lineBetween(280, 152, 680, 152);
    g.add(d);

    const b = loadBindings();
    const moveStr = `${displayKey(b.move_left)} ${displayKey(b.move_up)} ${displayKey(b.move_down)} ${displayKey(b.move_right)}`;
    const shootStr = `${displayKey(b.shoot_left)}  ${displayKey(b.shoot_up)}  ${displayKey(b.shoot_down)}  ${displayKey(b.shoot_right)}`;
    const itemStr = `${displayKey(b.item_0)}  /  ${displayKey(b.item_1)}  /  ${displayKey(b.item_2)}`;
    const cmds = [
      { key: moveStr, desc: 'Mover' },
      { key: shootStr, desc: 'Atirar proj\u00e9til (se classe permite)' },
      { key: displayKey(b.ability_0), desc: 'Habilidade especial da classe' },
      { key: displayKey(b.ability_1), desc: '2\u00aa habilidade (Daemon)' },
      { key: itemStr, desc: 'Usar item do invent\u00e1rio' },
      { key: displayKey(b.wait), desc: 'Aguardar um turno' },
      { key: displayKey(b.pause), desc: 'Menu de pausa' },
      { key: displayKey(b.restart), desc: 'Reiniciar (quando morto)' },
    ];

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      color: '#8899aa',
    };

    cmds.forEach((cmd, i) => {
      const y = 180 + i * 30;
      const keyText = this.add.text(280, y, cmd.key, { ...style, color: '#44ddbb', fontStyle: 'bold' });
      g.add(keyText);
      const descText = this.add.text(440, y, cmd.desc, style);
      g.add(descText);
    });

    const footer = this.add.text(480, 440, 'ESC para voltar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    }).setOrigin(0.5);
    g.add(footer);
  }

  private hideCommands() {
    this.inSubmenu = false;
    this.commandsGroup?.destroy(true);
    this.commandsGroup = undefined;
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
