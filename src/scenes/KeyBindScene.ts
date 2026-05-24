import Phaser from 'phaser';
import { sound } from '../audio/SoundManager';
import {
  GAME_ACTIONS, GameAction, MOVEMENT_ACTIONS,
  loadBindings, saveBindings, resetDefaults,
  displayKey, keyNameFromEvent, actionLabel,
  Bindings,
} from '../data/keybindings';
import { FONT, COLORS, FONT_SIZES } from '../theme';

export class KeyBindScene extends Phaser.Scene {
  private bindings!: Bindings;
  private selectedIndex = 0;
  private rebindIndex = -1;
  private actionTexts: Phaser.GameObjects.Text[] = [];
  private readyText?: Phaser.GameObjects.Text;
  private resetText!: Phaser.GameObjects.Text;
  private returnScene = 'Pause';
  private mid = 0;

  constructor() {
    super('KeyBind');
  }

  init(data: { returnScene?: string }) {
    this.returnScene = data.returnScene ?? 'Pause';
  }

  create() {
    this.selectedIndex = 0;
    this.rebindIndex = -1;
    this.actionTexts = [];
    this.bindings = loadBindings();

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(120, 30, 784, 420, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(120, 30, 784, 420, 6);

    this.add.text(512, 55, 'CONTROLES', {
      fontFamily: FONT,
      fontSize: '24px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const d = this.add.graphics();
    d.lineStyle(1, 0x2a4a3a);
    d.lineBetween(120, 80, 904, 80);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: '13px',
    };

    const mid = Math.ceil(GAME_ACTIONS.length / 2);
    this.mid = mid;

    GAME_ACTIONS.forEach((action, i) => {
      const col = i < mid ? 0 : 1;
      const rowInCol = col === 0 ? i : i - mid;
      const labelX = col === 0 ? 160 : 480;
      const keyX = col === 0 ? 360 : 680;
      const rowY = 96 + rowInCol * 26;

      const label = this.add.text(labelX, rowY, actionLabel(action), {
        ...style, color: COLORS.logText,
      });
      const keyStr = this.bindings[action];
      const keyT = this.add.text(keyX, rowY, displayKey(keyStr), {
        ...style, color: COLORS.subtitle, fontStyle: 'bold',
      });
      const spacer = this.add.text(keyX + 30, rowY, '', style);

      const isMove = MOVEMENT_ACTIONS.includes(action);
      if (isMove) {
        spacer.setText('  (segurar)');
      }

      const row = this.add.text(0, rowY, '', {
        ...style, fontSize: '13px', color: COLORS.dimBorder,
      }).setInteractive({ useHandCursor: true }).setOrigin(0, 0);

      const idx = i;
      row.on('pointerover', () => {
        if (this.rebindIndex < 0) this.selectedIndex = idx;
      });
      row.on('pointerdown', () => {
        if (this.rebindIndex < 0) this.startRebind(idx);
      });

      this.actionTexts.push(label, keyT, spacer, row);
    });

    this.resetText = this.add.text(512, 410, '[ Restaurar Padr\u00f5es ]', {
      fontFamily: FONT,
      fontSize: '14px',
      color: COLORS.abilityCd,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.resetText.on('pointerdown', () => {
      this.bindings = resetDefaults();
      saveBindings(this.bindings);
      this.refreshDisplay();
      sound.confirm();
    });

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });

    this.highlight(0);
  }

  private handleKey = (e: KeyboardEvent) => {
    if (this.rebindIndex >= 0) {
      const keyName = keyNameFromEvent(e);
      if (!keyName || keyName === 'ESC') {
        this.cancelRebind();
        return;
      }

      const action = GAME_ACTIONS[this.rebindIndex];
      const conflict = this.findConflict(action, keyName);
      if (conflict) {
        this.showReady(`"${displayKey(keyName)}" j\u00e1 usada em: ${actionLabel(conflict)}`);
        return;
      }

      this.bindings[action] = keyName;
      saveBindings(this.bindings);
      this.rebindIndex = -1;
      this.refreshDisplay();
      sound.confirm();
      return;
    }

    if (e.key === 'Escape') {
      sound.select();
      this.scene.stop();
      if (this.returnScene) this.scene.resume(this.returnScene);
      return;
    }

    if (e.key === 'Enter') {
      sound.confirm();
      this.startRebind(this.selectedIndex);
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (this.selectedIndex >= this.mid) {
        this.selectedIndex -= this.mid;
        this.highlightSelectedRow();
        sound.select();
      }
      return;
    }
    if (e.key === 'ArrowRight') {
      if (this.selectedIndex < this.mid) {
        const target = this.selectedIndex + this.mid;
        if (target < GAME_ACTIONS.length) {
          this.selectedIndex = target;
          this.highlightSelectedRow();
          sound.select();
        }
      }
      return;
    }
    if (e.key === 'ArrowUp') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowDown') {
      this.selectedIndex = Math.min(GAME_ACTIONS.length - 1, this.selectedIndex + 1);
      this.highlight(this.selectedIndex);
      sound.select();
    }
  };

  private startRebind(idx: number) {
    this.rebindIndex = idx;
    this.highlightSelectedRow();
    this.showReady('Pressione a tecla desejada...');
  }

  private cancelRebind() {
    this.rebindIndex = -1;
    this.hideReady();
    this.highlight(this.selectedIndex);
  }

  private findConflict(currentAction: GameAction, keyName: string): GameAction | null {
    for (const action of GAME_ACTIONS) {
      if (action === currentAction) continue;
      if (this.bindings[action] === keyName) return action;
    }
    return null;
  }

  private showReady(msg: string) {
    this.hideReady();
    this.readyText = this.add.text(512, 385, msg, {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.warning,
      fontStyle: 'bold',
    }).setOrigin(0.5);
  }

  private hideReady() {
    this.readyText?.destroy();
    this.readyText = undefined;
  }

  private highlight(idx: number) {
    this.selectedIndex = idx;
    this.highlightSelectedRow();
  }

  private highlightSelectedRow() {
    for (let i = 0; i < GAME_ACTIONS.length; i++) {
      const label = this.actionTexts[i * 4];
      const keyT = this.actionTexts[i * 4 + 1];
      if (this.rebindIndex === i) {
        label.setColor(COLORS.warning);
        keyT.setColor(COLORS.warning);
      } else if (i === this.selectedIndex && this.rebindIndex < 0) {
        label.setColor(COLORS.accent);
        keyT.setColor(COLORS.accent);
      } else {
        label.setColor(COLORS.logText);
        keyT.setColor(COLORS.subtitle);
      }
    }
  }

  private refreshDisplay() {
    this.hideReady();
    for (let i = 0; i < GAME_ACTIONS.length; i++) {
      const action = GAME_ACTIONS[i];
      const keyT = this.actionTexts[i * 4 + 1];
      keyT.setText(displayKey(this.bindings[action]));
    }
    this.highlight(this.selectedIndex);
  }
}
