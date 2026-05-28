import Phaser from 'phaser';
import { sound } from '../audio/SoundManager';
import { FONT, COLORS } from '../theme';
import { loadMeta } from '../utils/metaSave';
import { saveRun, deleteRunSave } from '../utils/runSave';
import { bgm } from '../audio/BGMPlayer';

export class PauseScene extends Phaser.Scene {
  private selectedIndex = 0;
  private buttons: { text: Phaser.GameObjects.Text; color: string; cb: () => void }[] = [];

  constructor() {
    super('Pause');
  }

  create() {
    this.selectedIndex = 0;
    this.buttons = [];

    const player = this.getPlayer();

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, 1024, 640);

    const panel = this.add.graphics();
    panel.fillStyle(0x0a1a18);
    panel.fillRoundedRect(120, 70, 784, 500, 6);
    panel.lineStyle(2, 0x2a4a3a);
    panel.strokeRoundedRect(120, 70, 784, 500, 6);

    const midDivider = this.add.graphics();
    midDivider.lineStyle(1, 0x1a3a2a);
    midDivider.lineBetween(512, 110, 512, 540);

    this.add.text(320, 100, 'MENU', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(724, 100, 'STATUS', {
      fontFamily: FONT,
      fontSize: '20px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const divTop = this.add.graphics();
    divTop.lineStyle(1, 0x2a4a3a);
    divTop.lineBetween(160, 120, 480, 120);
    divTop.lineBetween(560, 120, 888, 120);

    this.addButton(320, 170, '[ Continuar ]', COLORS.subtitle, () => this.resumeGame());
    this.addButton(320, 230, '[ Salvar e Sair ]', COLORS.gold, () => this.saveAndQuit());
    this.addButton(320, 290, '[ Compêndio ]', COLORS.subtitle, () => this.openCompendium());
    this.addButton(320, 350, '[ Reiniciar ]', COLORS.abilityCd, () => this.restartGame());
    this.addButton(320, 410, '[ Configurações ]', COLORS.menuAccent, () => this.openConfig());
    this.addButton(320, 470, '[ Menu Inicial ]', COLORS.gold, () => this.goToMainMenu());

    this.add.text(320, 530, 'Setas | ENTER | ESC', {
      fontFamily: FONT,
      fontSize: '11px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    if (player) {
      this.buildStatsPanel(player);
    }

    bgm.pause();
    this.highlight(0);

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private getPlayer(): any {
    try {
      const game = this.scene.get('Game') as any;
      return game?.state?.player ?? null;
    } catch {
      return null;
    }
  }

  private buildStatsPanel(player: any) {
    const meta = loadMeta();
    const metaHp = meta.upgrades.meta_hp ?? 0;
    const metaAtk = meta.upgrades.meta_atk ?? 0;
    const metaDef = meta.upgrades.meta_def ?? 0;
    const metaFov = meta.upgrades.meta_fov ?? 0;
    const metaInv = meta.upgrades.meta_inv ?? 0;

    const lines: { label: string; value: string; color?: string }[] = [];

    lines.push({ label: 'Classe:', value: player.classDef?.name ?? player.name, color: COLORS.gold });
    lines.push({ label: 'Andar:', value: `/system/${player.floor}`, color: COLORS.subtitle });
    lines.push({ label: 'Nível:', value: `${player.level}`, color: COLORS.accent });
    lines.push({ label: 'XP:', value: `${player.xp} / ${player.xpToNext}`, color: COLORS.muted });

    const usedSlots = player.inventory ? player.inventory.filter((s: any) => s !== null).length : 0;
    const totalSlots = player.unlockedSlots ?? player.inventory?.length ?? 2;

    const stats: { label: string; value: string; meta: string }[] = [
      { label: 'HP', value: `${player.hp}/${player.maxHp}`, meta: metaHp > 0 ? `+${metaHp * 5}` : '' },
      { label: 'ATK', value: `${player.effectiveAtk ?? player.attack}`, meta: metaAtk > 0 ? `+${metaAtk * 2}` : '' },
      { label: 'DEF', value: `${player.effectiveDef ?? player.defense}`, meta: metaDef > 0 ? `+${metaDef}` : '' },
      { label: 'FOV', value: `${player.effectiveFov}`, meta: metaFov > 0 ? `+${metaFov}` : '' },
      { label: 'INV', value: `${usedSlots}/${totalSlots}`, meta: metaInv > 0 ? `+${metaInv}` : '' },
      { label: 'VEL', value: `${player.effectiveMoveSpeed ?? player.moveSpeed}`, meta: '' },
    ];

    const lineH = 18;
    let yy = 145;

    for (const line of lines) {
      const label = this.add.text(560, yy, line.label, {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.dimText,
        fontStyle: 'bold',
      });
      const value = this.add.text(640, yy, line.value, {
        fontFamily: FONT,
        fontSize: '13px',
        color: line.color ?? COLORS.lightText,
      });
      yy += lineH;
    }

    yy += 8;
    const divStats = this.add.graphics();
    divStats.lineStyle(1, 0x1a3a2a);
    const divY = yy - 4;
    divStats.lineBetween(560, divY, 904, divY);

    for (const st of stats) {
      const label = this.add.text(560, yy, st.label, {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.dimText,
        fontStyle: 'bold',
      });
      const value = this.add.text(610, yy, st.value, {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.lightText,
      });
      if (st.meta) {
        this.add.text(700, yy, `[${st.meta}]`, {
          fontFamily: FONT,
          fontSize: '11px',
          color: COLORS.gold,
        });
      }
      yy += lineH;
    }
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

  private openCompendium() {
    this.scene.start('Compendium', { returnScene: 'Pause' });
  }

  private openConfig() {
    this.scene.pause();
    this.scene.launch('Config', { returnScene: 'Pause' });
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
    bgm.resume();
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  private getGameState(): any {
    try {
      const game = this.scene.get('Game') as any;
      return game?.state ?? null;
    } catch {
      return null;
    }
  }

  private saveAndQuit() {
    const state = this.getGameState();
    if (state) {
      saveRun(state);
    }
    this.registry.set('restartPending', false);
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.stop();
    this.scene.start('MainMenu');
  }

  private restartGame() {
    deleteRunSave();
    this.registry.set('restartPending', true);
    this.scene.resume('Game');
    this.scene.resume('HUD');
    this.scene.stop();
  }

  private goToMainMenu() {
    deleteRunSave();
    this.registry.set('restartPending', false);
    this.scene.stop('HUD');
    this.scene.stop('Game');
    this.scene.stop();
    this.scene.start('MainMenu');
  }
}
