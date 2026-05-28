import Phaser from 'phaser';
import { version } from '../../package.json';
import { sound } from '../audio/SoundManager';
import { FONT, COLORS, FONT_SIZES } from '../theme';
import { loadMeta, saveMeta, defaultMeta } from '../utils/metaSave';
import { hasRunSave, deleteRunSave } from '../utils/runSave';
import { bgm } from '../audio/BGMPlayer';

export class MainMenuScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];
  private submenuGroup?: Phaser.GameObjects.Group;
  private inSubmenu = false;
  private submenuState: 'about' | 'resetConfirm' = 'about';
  private resetChoice = 0;
  private cheatBuffer = '';
  private bitsText?: Phaser.GameObjects.Text;
  private submenuDynamic: Phaser.GameObjects.GameObject[] = [];

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
      { text: 'SISTEMA DE INICIALIZAÇÃO v0.1', color: COLORS.subtitle },
      { text: 'Verificando integridade do kernel... OK', color: COLORS.muted },
      { text: 'Carregando módulos do sistema:', color: COLORS.muted },
      { text: '  modulos/crypt/crc32.sys        [OK]', color: COLORS.bootText },
      { text: '  modulos/net/tcpip.sys          [OK]', color: COLORS.bootText },
      { text: '  modulos/fs/vfat.sys            [OK]', color: COLORS.bootText },
      { text: '  modulos/sec/firewall.sys       [OK]', color: COLORS.bootText },
      { text: 'Drivers de hardware... OK', color: COLORS.muted },
      { text: 'Memória: 1024 KB OK', color: COLORS.muted },
      { text: '', color: COLORS.muted },
      { text: 'SISTEMA PRONTO.', color: COLORS.accent },
      { text: '', color: COLORS.muted },
    ];

    const bootTexts: Phaser.GameObjects.Text[] = [];
    const startY = 220;

    lines.forEach((line, i) => {
      this.time.delayedCall(70 * (i + 1), () => {
        const t = this.add.text(120, startY + i * 18, line.text, {
          fontFamily: FONT,
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
    bgm.play('menu');
    this.add.text(512, 90, 'SYSTEM PURGE', {
      fontFamily: FONT,
      fontSize: '52px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accent, 20, false, true);

    this.add.text(512, 140, `v${version}  —  Roguelike de Limpeza de Sistema`, {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.subtitle,
    }).setOrigin(0.5);

    const div = this.add.graphics();
    div.lineStyle(1, 0x2a4a3a);
    div.lineBetween(256, 165, 768, 165);

    const hasSave = hasRunSave();
    let btnY = 220;

    if (hasSave) {
      this.addButton(512, btnY, '[ Continuar ]', COLORS.accent, () => this.continueGame());
      btnY += 45;
    }

    this.addButton(512, btnY, '[ INICIAR ]', COLORS.accent, () => this.startGame());
    btnY += 45;
    this.addButton(512, btnY, '[ LOJA ]', COLORS.gold, () => this.openShop());
    btnY += 45;
    this.addButton(512, btnY, '[ COMPÊNDIO ]', COLORS.subtitle, () => this.openCompendium());
    btnY += 45;
    this.addButton(512, btnY, '[ CONTROLES ]', COLORS.menuAccent, () => this.showControls());
    btnY += 45;
    this.addButton(512, btnY, '[ SOBRE ]', COLORS.subtitle, () => this.showAbout());
    btnY += 45;

    const meta = loadMeta();
    this.bitsText = this.add.text(512, btnY + 5, `Bits: ${meta.bits}`, {
      fontFamily: FONT,
      fontSize: '14px',
      color: COLORS.accent,
    }).setOrigin(0.5);

    this.add.text(512, btnY + 35, 'SETAS para navegar | ENTER para selecionar', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.highlight(0);
    sound.resumeContext();
    this.input.keyboard?.on('keydown', this.handleInput, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleInput, this);
    });
  }

  private handleInput(e: KeyboardEvent) {
    sound.resumeContext();
    if (this.inSubmenu) {
      if (this.submenuState === 'resetConfirm') {
        if (e.key === 'Escape') { this.hideResetConfirm(); return; }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          this.resetChoice = this.resetChoice === 0 ? 1 : 0;
          this.updateResetHighlight();
          sound.select();
          return;
        }
        if (e.key === 'Enter') {
          sound.confirm();
          if (this.resetChoice === 0) this.executeReset();
          else this.hideResetConfirm();
          return;
        }
        return;
      }
      if (e.key === 'Escape') { this.hideSubmenu(); return; }
      if (e.key === 'Enter') {
        this.executeCheat(this.cheatBuffer);
        this.cheatBuffer = '';
        this.updateCheatDisplay();
        return;
      }
      if (e.key === 'Backspace') {
        this.cheatBuffer = this.cheatBuffer.slice(0, -1);
        this.updateCheatDisplay();
        this.clearCheatFeedback();
        return;
      }
      if (e.key.length === 1) {
        this.cheatBuffer += e.key;
        this.updateCheatDisplay();
        this.clearCheatFeedback();
        return;
      }
      return;
    }
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

  private openCompendium() {
    this.scene.start('Compendium', { returnScene: 'MainMenu' });
  }

  private showControls() {
    this.scene.pause();
    this.scene.launch('KeyBind', { returnScene: 'MainMenu' });
  }

  private showAbout() {
    this.inSubmenu = true;
    this.submenuState = 'about';
    this.cheatBuffer = '';
    this.submenuDynamic.forEach(obj => obj.destroy());
    this.submenuDynamic = [];
    this.submenuGroup = this.add.group();
    const g = this.submenuGroup;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x00, 0.75);
    overlay.fillRect(0, 0, 1024, 640);
    g.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(270, 130, 484, 430, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(270, 130, 484, 430, 6);
    g.add(panel);

    const title = this.add.text(512, 170, 'SOBRE', {
      fontFamily: FONT,
      fontSize: '22px',
      color: COLORS.gold,
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
      'Um roguelike de terminal onde você',
      'elimina ameaças do sistema operacional',
      'e purga o kernel de rootkits.',
      '',
      'Tecnologias: Phaser 3 + rot-js + TypeScript',
      '',
      'Victor Oliveira',
      'Participação especial de Helena Oliveira',
    ];
    info.forEach((line, i) => {
      const t = this.add.text(512, 220 + i * 20, line, {
        fontFamily: FONT,
        fontSize: '13px',
        color: i === 0 ? COLORS.accent : COLORS.muted,
        fontStyle: i === 0 ? 'bold' : 'normal',
      }).setOrigin(0.5);
      g.add(t);
    });

    const rd = this.add.graphics();
    rd.lineStyle(1, 0x2a4a3a);
    rd.lineBetween(310, 435, 714, 435);
    g.add(rd);
    this.submenuDynamic.push(rd);

    const eh = this.add.text(512, 450, 'ESC para voltar', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.dimText,
    }).setOrigin(0.5);
    g.add(eh);
    this.submenuDynamic.push(eh);

    const rb = this.add.text(512, 475, '[ RESETAR DADOS ]', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.error,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rb.on('pointerdown', () => this.showResetConfirm());
    g.add(rb);
    this.submenuDynamic.push(rb);

    const cheatTitle = this.add.text(512, 498, '\u203a CHEAT CODES', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.lightText,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    g.add(cheatTitle);
    this.submenuDynamic.push(cheatTitle);

    const cd = this.add.text(512, 516, '> ', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.accent,
    }).setOrigin(0.5);
    g.add(cd);
    this.submenuDynamic.push(cd);

    const cf = this.add.text(512, 534, '', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.gold,
    }).setOrigin(0.5);
    g.add(cf);
    this.submenuDynamic.push(cf);

    this.data.set('cheatDisplay', cd);
    this.data.set('cheatFeedback', cf);
  }

  private updateCheatDisplay() {
    const cd = this.data.get('cheatDisplay') as Phaser.GameObjects.Text | undefined;
    if (!cd) return;
    cd.setText(this.cheatBuffer.length > 0 ? '> ' + this.cheatBuffer : '> ');
  }

  private clearCheatFeedback() {
    const cf = this.data.get('cheatFeedback') as Phaser.GameObjects.Text | undefined;
    if (cf) cf.setText('');
  }

  private executeCheat(input: string) {
    const cf = this.data.get('cheatFeedback') as Phaser.GameObjects.Text | undefined;
    if (!cf) return;
    if (input.trim().toLowerCase() === 'i love you') {
      const meta = loadMeta();
      meta.bits += 50000;
      saveMeta(meta);
      cf.setColor(COLORS.gold);
      cf.setText('50000 Bits adicionados!');
      if (this.bitsText) this.bitsText.setText(`Bits: ${meta.bits}`);
    } else {
      const match = input.trim().match(/^floor\s+(\d+)$/i);
      if (match) {
        const floor = parseInt(match[1], 10);
        if (floor >= 2 && floor <= 100) {
          const meta = loadMeta();
          meta.startFloor = floor;
          saveMeta(meta);
          cf.setColor(COLORS.gold);
          cf.setText(`Pr\u00f3ximo jogo come\u00e7ar\u00e1 no andar ${floor}!`);
        } else {
          cf.setColor(COLORS.error);
          cf.setText('Use floor 2 a 100.');
        }
      } else {
        cf.setColor(COLORS.error);
        cf.setText('\u2717 Comando inv\u00e1lido');
      }
    }
  }

  private hideSubmenu() {
    this.inSubmenu = false;
    this.submenuGroup?.destroy(true);
    this.submenuGroup = undefined;
    this.submenuDynamic = [];
  }

  private showResetConfirm() {
    this.submenuState = 'resetConfirm';
    this.resetChoice = 0;
    this.submenuDynamic.forEach(obj => obj.destroy());
    this.submenuDynamic = [];

    const g = this.submenuGroup!;

    const rd = this.add.graphics();
    rd.lineStyle(1, 0x2a4a3a);
    rd.lineBetween(310, 430, 714, 430);
    g.add(rd);
    this.submenuDynamic.push(rd);

    const w = this.add.text(512, 448, '\u26a0 Todo progresso salvo sera perdido!\nEsta acao nao pode ser desfeita.', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.warning,
      align: 'center',
    }).setOrigin(0.5);
    g.add(w);
    this.submenuDynamic.push(w);

    const cb = this.add.text(440, 478, '[ CONFIRMAR ]', {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.error,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cb.on('pointerdown', () => this.executeReset());
    g.add(cb);
    this.submenuDynamic.push(cb);

    const cc = this.add.text(584, 478, '[ CANCELAR ]', {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.muted,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    cc.on('pointerdown', () => this.hideResetConfirm());
    g.add(cc);
    this.submenuDynamic.push(cc);

    const eh = this.add.text(512, 502, 'ESC para cancelar', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dimText,
    }).setOrigin(0.5);
    g.add(eh);
    this.submenuDynamic.push(eh);

    this.updateResetHighlight();
  }

  private hideResetConfirm() {
    this.submenuState = 'about';
    this.submenuDynamic.forEach(obj => obj.destroy());
    this.submenuDynamic = [];

    const g = this.submenuGroup!;

    const rd = this.add.graphics();
    rd.lineStyle(1, 0x2a4a3a);
    rd.lineBetween(310, 430, 714, 430);
    g.add(rd);
    this.submenuDynamic.push(rd);

    const eh = this.add.text(512, 450, 'ESC para voltar', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.dimText,
    }).setOrigin(0.5);
    g.add(eh);
    this.submenuDynamic.push(eh);

    const rb = this.add.text(512, 475, '[ RESETAR DADOS ]', {
      fontFamily: FONT,
      fontSize: '12px',
      color: COLORS.error,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    rb.on('pointerdown', () => this.showResetConfirm());
    g.add(rb);
    this.submenuDynamic.push(rb);
  }

  private updateResetHighlight() {
    if (this.submenuDynamic.length < 2) return;
    const confirmText = this.submenuDynamic.find(
      o => o.type === 'Text' && (o as Phaser.GameObjects.Text).text === '[ CONFIRMAR ]'
    ) as Phaser.GameObjects.Text | undefined;
    const cancelText = this.submenuDynamic.find(
      o => o.type === 'Text' && (o as Phaser.GameObjects.Text).text === '[ CANCELAR ]'
    ) as Phaser.GameObjects.Text | undefined;
    if (confirmText) confirmText.setColor(this.resetChoice === 0 ? COLORS.error : COLORS.muted);
    if (cancelText) cancelText.setColor(this.resetChoice === 1 ? COLORS.error : COLORS.muted);
  }

  private executeReset() {
    saveMeta(defaultMeta());
    this.hideSubmenu();
    this.scene.restart();
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

  private openShop() {
    this.scene.start('Shop');
  }

  private continueGame() {
    this.scene.start('Game', { loadFromSave: true });
  }

  private startGame() {
    deleteRunSave();
    this.scene.start('ClassSelect');
  }
}
