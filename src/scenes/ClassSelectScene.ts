import Phaser from 'phaser';
import { CLASSES } from '../data/classes';
import { sound } from '../audio/SoundManager';

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

    this.add.text(477, 40, 'SELECIONE SUA CLASSE', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '26px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 0, '#00ff88', 10, false, true);

    const div = this.add.graphics();
    div.lineStyle(1, 0x1a3a2a);
    div.lineBetween(165, 70, 789, 70);

    CLASSES.forEach((c, i) => this.drawCard(i, c));
    this.updateCardHighlights();

    this.add.text(477, 600, '\u2190 \u2192 Navegar | ENTER para selecionar | ESC voltar', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '13px',
      color: '#445566',
    }).setOrigin(0.5);

    this.input.keyboard!.on('keydown', this.handleKey, this);
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
    const cx = 93 + index * 220;
    const y = 110;
    const w = 200;
    const h = 440;

    const card = this.add.graphics();
    this.cardGraphics.push(card);

    const sprite = this.add.image(cx + w / 2, y + 70, c.textureKey);
    sprite.setScale(3);

    this.add.text(cx + w / 2, y + 120, c.name, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '14px',
      color: '#eef8ff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 180 },
    }).setOrigin(0.5);

    this.add.text(cx + w / 2, y + 160, c.description, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#778899',
      align: 'center',
      wordWrap: { width: 175 },
    }).setOrigin(0.5);

    const statsY = y + 210;
    const stats = [
      `HP: ${c.hp}`,
      `ATQ: ${c.attack}`,
      `DEF: ${c.defense}`,
      `VEL: ${c.moveSpeed.toFixed(1)}x`,
    ];
    stats.forEach((s, i) => {
      this.add.text(cx + w / 2, statsY + i * 20, s, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        color: '#aabbcc',
      }).setOrigin(0.5);
    });

    const passY = statsY + stats.length * 20 + 10;
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
      this.add.text(cx + 14, passY + i * 14, `\u25b8 ${p}`, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '9px',
        color: '#ff9944',
      });
    });

    c.abilities.forEach((a, i) => {
      const ay = y + h - 60 - (c.abilities.length - 1 - i) * 34;
      const keyLabel = i === 0 ? 'Q' : 'E';
      this.add.text(cx + 14, ay, `[${keyLabel}] ${a.name} (CD ${a.cooldown})`, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '9px',
        color: '#44ddbb',
      });
      this.add.text(cx + 14, ay + 16, a.description, {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '10px',
        color: '#99bbaa',
        wordWrap: { width: 170 },
      });
    });
  }

  private updateCardHighlights() {
    for (let i = 0; i < CLASSES.length; i++) {
      const cx = 93 + i * 220;
      const y = 110;
      const g = this.cardGraphics[i];
      if (!g) continue;
      g.clear();
      g.fillStyle(i === this.selectedIndex ? 0x0f2a22 : 0x0a1a18);
      g.fillRoundedRect(cx, y, 200, 440, 6);
      g.lineStyle(i === this.selectedIndex ? 2 : 1, i === this.selectedIndex ? 0x44ddbb : 0x2a4a3a);
      g.strokeRoundedRect(cx, y, 200, 440, 6);
    }
  }

  private selectClass() {
    if (this.selecting) return;
    this.selecting = true;
    const classDef = CLASSES[this.selectedIndex];
    this.scene.start('Game', { classId: classDef.id });
  }
}
