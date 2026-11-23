import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { sound } from '../audio/SoundManager';
import { loadBindings, displayKey } from '../data/keybindings';
import { FONT, COLORS, FONT_SIZES } from '../theme';
import { loadMeta, saveMeta } from '../utils/metaSave';
import { CLASS_FLOOR_UNLOCK } from '../data/metaUpgrades';

const CARD_W = 224;
const CARD_H = 460;
const CARD_GAP = 16;
const CARD_START_X = 40;
const CARD_Y = 110;

export class ClassSelectScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cardGraphics: Phaser.GameObjects.Graphics[] = [];
  private selecting = false;

  constructor() {
    super('ClassSelect');
  }

  create() {
    this.selectedIndex = 0;
    this.cardGraphics = [];
    this.selecting = false;

    const bg = this.add.graphics();
    bg.fillStyle(0x000810);
    bg.fillRect(0, 0, 1024, 640);

    this.add.text(512, 40, 'SELECIONE SUA CLASSE', {
      fontFamily: FONT,
      fontSize: '26px',
      color: COLORS.accent,
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, COLORS.accent, 10, false, true);

    const div = this.add.graphics();
    div.lineStyle(1, 0x1a3a2a);
    div.lineBetween(212, 70, 812, 70);

    CLASSES.forEach((c, i) => this.drawCard(i, c));
    this.updateCardHighlights();

    this.add.text(512, 600, '\u2190 \u2192 Navegar | ENTER para selecionar | ESC voltar', {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.dimText,
    }).setOrigin(0.5);

    this.input.keyboard?.on('keydown', this.handleKey, this);
    this.events.on('shutdown', () => {
      this.input.keyboard?.off('keydown', this.handleKey, this);
    });
  }

  private handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      this.selectedIndex = (this.selectedIndex - 1 + CLASSES.length) % CLASSES.length;
      this.updateCardHighlights();
      sound.select();
    }
    if (e.key === 'ArrowRight') {
      this.selectedIndex = (this.selectedIndex + 1) % CLASSES.length;
      this.updateCardHighlights();
      sound.select();
    }
    if (e.key === 'Enter') {
      sound.confirm();
      this.selectClass();
    }
    if (e.key === 'Escape') {
      sound.select();
      this.scene.start('MainMenu');
    }
  }

  private drawCard(index: number, c: typeof CLASSES[0]) {
    const cx = CARD_START_X + index * (CARD_W + CARD_GAP);
    const y = CARD_Y;
    const w = CARD_W;
    const h = CARD_H;

    if (this.textures.exists('ui_class_card_frame')) {
      this.add.image(cx + w / 2, y + h / 2, 'ui_class_card_frame').setDisplaySize(w, h);
    }

    const card = this.add.graphics();
    this.cardGraphics.push(card);

    const hdKey = `${c.textureKey}_hd`;
    const sprite = this.add.image(cx + w / 2, y + 76, this.textures.exists(hdKey) ? hdKey : c.textureKey);
    sprite.setDisplaySize(72, 72);

    this.add.text(cx + w / 2, y + 122, c.name, {
      fontFamily: FONT,
      fontSize: '13px',
      color: COLORS.lightText,
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: w - 56 },
    }).setOrigin(0.5);

    this.add.text(cx + w / 2, y + 152, c.description, {
      fontFamily: FONT,
      fontSize: '9px',
      color: COLORS.subtitleText,
      align: 'center',
      wordWrap: { width: w - 64 },
    }).setOrigin(0.5);

    const statsY = y + 190;
    const stats = [
      `HP: ${c.hp}`,
      `ATQ: ${c.attack}`,
      `DEF: ${c.defense}`,
      `VEL: ${c.moveSpeed.toFixed(1)}x`,
    ];
    stats.forEach((s, i) => {
      this.add.text(cx + w / 2, statsY + i * 18, s, {
        fontFamily: FONT,
        fontSize: '12px',
        color: COLORS.logText,
      }).setOrigin(0.5);
    });

    const passY = statsY + stats.length * 18 + 9;
    const passives: string[] = [];
    if (!c.canMelee) passives.push('Sem corpo a corpo');
    if (c.meleeBonus > 0) passives.push(`Corpo a corpo +${c.meleeBonus}`);
    if (c.meleeMultiplier < 1) passives.push(`Dano melee ${c.meleeMultiplier * 100}%`);
    if (c.ignoreDefense) passives.push('Ignora defesa no melee');
    if (c.projectilesPierce) passives.push('Projéteis perfurantes');
    if (c.reflectPercent > 0) passives.push(`Reflete ${c.reflectPercent}% dano`);
    if (c.pressureDamage > 0) passives.push(`Pressão ${c.pressureDamage}/turno`);
    if (!c.canShoot && c.id === 'limpador') passives.push('Apenas corpo a corpo');
    passives.forEach((p, i) => {
      this.add.text(cx + w / 2, passY + i * 12, `\u25b8 ${p}`, {
        fontFamily: FONT,
        fontSize: '10px',
        color: COLORS.tagAccent,
        align: 'center',
      }).setOrigin(0.5);
    });

    const meta = loadMeta();
    const unlocked = meta.unlocks[c.id] ?? false;
    const reqFloor = CLASS_FLOOR_UNLOCK[c.id];

    if (!unlocked) {
      this.add.text(cx + w - 36, y + 46, reqFloor ? `\u{1F512} Andar ${reqFloor}` : '\u{1F512}', {
        fontFamily: FONT,
        fontSize: '10px',
        color: COLORS.gold,
        fontStyle: 'bold',
      }).setOrigin(1, 0);
    }

    const b = loadBindings();
    c.abilities.forEach((a, i) => {
      const ay = y + 312 + i * 52;
      const keyLabel = displayKey(i === 0 ? b.ability_0 : b.ability_1);
      this.add.text(cx + w / 2, ay, `[${keyLabel}] ${a.name} (CD ${a.cooldown})`, {
        fontFamily: FONT,
        fontSize: '9px',
        color: COLORS.subtitle,
        align: 'center',
        wordWrap: { width: w - 64 },
      }).setOrigin(0.5);
      this.add.text(cx + w / 2, ay + 13, a.description, {
        fontFamily: FONT,
        fontSize: '10px',
        color: COLORS.logText,
        align: 'center',
        wordWrap: { width: w - 64 },
      }).setOrigin(0.5);
    });
  }

  private updateCardHighlights() {
    for (let i = 0; i < CLASSES.length; i++) {
      const cx = CARD_START_X + i * (CARD_W + CARD_GAP);
      const y = CARD_Y;
      const g = this.cardGraphics[i];
      if (!g) continue;
      g.clear();
      g.fillStyle(i === this.selectedIndex ? 0x0f2a22 : 0x0a1a18, 0.55);
      g.fillRoundedRect(cx, y, CARD_W, CARD_H, 6);
      g.lineStyle(i === this.selectedIndex ? 2 : 1, i === this.selectedIndex ? 0x44ddbb : 0x2a4a3a);
      g.strokeRoundedRect(cx, y, CARD_W, CARD_H, 6);
    }
  }

  private selectClass() {
    if (this.selecting) return;
    const classDef = CLASSES[this.selectedIndex];
    const meta = loadMeta();

    if (!meta.unlocks[classDef.id]) {
      sound.select();
      return;
    }

    this.selecting = true;
    this.scene.start('Game', { classId: classDef.id });
  }
}
