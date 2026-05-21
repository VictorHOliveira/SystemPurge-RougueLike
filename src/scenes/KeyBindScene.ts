import Phaser from 'phaser';
import { sound } from '../audio/SoundManager';
import {
  GAME_ACTIONS, GameAction, MOVEMENT_ACTIONS,
  loadBindings, saveBindings, resetDefaults,
  displayKey, keyNameFromEvent, actionLabel,
  Bindings,
} from '../data/keybindings';

export class KeyBindScene extends Phaser.Scene {
  private bindings!: Bindings;
  private selectedIndex = 0;
  private rebindIndex = -1;
  private actionTexts: Phaser.GameObjects.Text[] = [];
  private readyText?: Phaser.GameObjects.Text;
  private resetText!: Phaser.GameObjects.Text;
  private returnScene = 'Pause';

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
    panel.fillRoundedRect(180, 30, 664, 580, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(180, 30, 664, 580, 6);

    this.add.text(512, 55, 'CONTROLES', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '24px',
      color: '#44aaff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const d = this.add.graphics();
    d.lineStyle(1, 0x2a4a3a);
    d.lineBetween(220, 80, 804, 80);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '13px',
    };

    GAME_ACTIONS.forEach((action, i) => {
      const rowY = 96 + i * 26;
      const label = this.add.text(220, rowY, actionLabel(action), {
        ...style, color: '#aabbcc',
      });
      const keyStr = this.bindings[action];
      const keyT = this.add.text(560, rowY, displayKey(keyStr), {
        ...style, color: '#44ddbb', fontStyle: 'bold',
      });
      const spacer = this.add.text(580, rowY, '', style);

      const isMove = MOVEMENT_ACTIONS.includes(action);
      if (isMove) {
        spacer.setText('  (segurar)');
        spacer.setColor('#556677');
      }

      const row = this.add.text(0, rowY, '', {
        ...style, fontSize: '13px', color: '#334455',
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

    this.resetText = this.add.text(512, 570, '[ Restaurar Padr\u00f5es ]', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      color: '#ff6644',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.resetText.on('pointerdown', () => {
      this.bindings = resetDefaults();
      saveBindings(this.bindings);
      this.refreshDisplay();
      sound.confirm();
    });

    this.input.keyboard!.on('keydown', this.handleKey, this);
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
      this.registry.set('bindingsChanged', Date.now());
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

    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      this.selectedIndex = (this.selectedIndex - 1 + GAME_ACTIONS.length) % GAME_ACTIONS.length;
      this.highlight(this.selectedIndex);
      sound.select();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      this.selectedIndex = (this.selectedIndex + 1) % GAME_ACTIONS.length;
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
    this.readyText = this.add.text(512, 540, msg, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '13px',
      color: '#ffdd44',
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
        label.setColor('#ffdd44');
        keyT.setColor('#ffdd44');
      } else if (i === this.selectedIndex && this.rebindIndex < 0) {
        label.setColor('#00ff88');
        keyT.setColor('#00ff88');
      } else {
        label.setColor('#aabbcc');
        keyT.setColor('#44ddbb');
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
