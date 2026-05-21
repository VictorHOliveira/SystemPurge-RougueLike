import Phaser from 'phaser';
import { version } from '../../package.json';
import { ALL_ITEMS } from '../data/items';
import { ALL_UPGRADES, UPGRADE_DISP } from '../data/upgrades';
import { CLASSES } from '../data/classes';
import { loadBindings, displayKey, type Bindings } from '../data/keybindings';
import { RegistryKeys } from '../RegistryKeys';
import { FONT, COLORS, FONT_SIZES } from '../theme';

const HUD_X = 648;
const PANEL_W = 358;
const RIGHT = 1006;

const ITEM_NAMES: Record<string, string> = {};
for (const item of ALL_ITEMS) {
  ITEM_NAMES[item.id] = `${item.icon} ${item.name}`;
}

const CLASS_NAMES: Record<string, string> = {};
for (const c of CLASSES) {
  CLASS_NAMES[c.id] = c.name;
}

const upgradeNameFromId: Record<string, string> = {};
for (const u of ALL_UPGRADES) upgradeNameFromId[u.id] = u.name;

export class HUDScene extends Phaser.Scene {
  private panel1!: Phaser.GameObjects.Graphics;
  private panel2!: Phaser.GameObjects.Graphics;
  private panel3!: Phaser.GameObjects.Graphics;
  private panel4!: Phaser.GameObjects.Graphics;

  private headerText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private classText!: Phaser.GameObjects.Text;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Graphics;
  private xpBarBg!: Phaser.GameObjects.Graphics;
  private xpText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  private abilTexts: Phaser.GameObjects.Text[] = [];
  private invTexts: Phaser.GameObjects.Text[] = [];
  private div1!: Phaser.GameObjects.Graphics;
  private div2!: Phaser.GameObjects.Graphics;

  private upgradeTitle!: Phaser.GameObjects.Text;
  private statTexts: Phaser.GameObjects.Text[] = [];

  private logHeader!: Phaser.GameObjects.Text;
  private messageTexts: Phaser.GameObjects.Text[] = [];
  private footerText!: Phaser.GameObjects.Text;

  private lastHudVersion = -1;

  constructor() {
    super('HUD');
  }

  create() {
    this.abilTexts = [];
    this.invTexts = [];
    this.statTexts = [];
    this.messageTexts = [];
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a18);
    bg.fillRect(640, 0, 384, 640);

    const vert = this.add.graphics();
    vert.lineStyle(1, 0x1a2a3a);
    vert.lineBetween(640, 0, 640, 640);

    this.panel1 = this.add.graphics();
    this.panel2 = this.add.graphics();
    this.panel3 = this.add.graphics();
    this.panel4 = this.add.graphics();

    this.buildPanel1();
    this.buildPanel2();
    this.buildPanel3();
    this.buildPanel4();
    this.buildFooter();
  }

  private panelRect(g: Phaser.GameObjects.Graphics, y: number, h: number) {
    g.fillStyle(0x0a1a18);
    g.fillRoundedRect(HUD_X + 4, y, PANEL_W - 8, h, 4);
    g.lineStyle(1, 0x2a4a3a);
    g.strokeRoundedRect(HUD_X + 4, y, PANEL_W - 8, h, 4);
  }

  private buildPanel1() {
    const y = 6;
    const h = 100;
    this.panelRect(this.panel1, y, h);

    const cx = HUD_X + 14;

    this.headerText = this.add.text(cx, y + 8, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.header,
      color: COLORS.accent,
      fontStyle: 'bold',
    });

    this.subtitleText = this.add.text(cx, y + 26, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.subtitle,
    });

    this.classText = this.add.text(cx, y + 40, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.class,
      color: COLORS.muted,
    });

    this.hpBarBg = this.add.graphics();
    this.hpBarBg.fillStyle(0x1a1a2e);
    this.hpBarBg.fillRoundedRect(cx, y + 54, PANEL_W - 28, 14, 2);
    this.hpBarBg.lineStyle(1, 0x2a3a4a);
    this.hpBarBg.strokeRoundedRect(cx, y + 54, PANEL_W - 28, 14, 2);

    this.hpBarFill = this.add.graphics();

    this.hpText = this.add.text(cx + (PANEL_W - 28) / 2, y + 61, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.hpText,
      color: COLORS.white,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.xpBarBg = this.add.graphics();
    this.xpBarBg.fillStyle(0x1a2a4e);
    this.xpBarBg.fillRoundedRect(cx, y + 70, PANEL_W - 28, 8, 2);
    this.xpBarBg.lineStyle(1, 0x2a3a4a);
    this.xpBarBg.strokeRoundedRect(cx, y + 70, PANEL_W - 28, 8, 2);

    this.xpBarFill = this.add.graphics();

    this.xpText = this.add.text(cx + (PANEL_W - 28) / 2, y + 70, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.xpText,
      color: COLORS.white,
    }).setOrigin(0.5, 0);

    this.statsText = this.add.text(cx, y + 84, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.stats,
      color: COLORS.subtitleText,
    });
  }

  private buildPanel2() {
    const cx = HUD_X + 14;

    this.div1 = this.add.graphics();
    this.div2 = this.add.graphics();

    for (let i = 0; i < 2; i++) {
      this.abilTexts.push(this.add.text(cx, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.ability,
        color: COLORS.subtitle,
      }));
    }

    for (let i = 0; i < 3; i++) {
      this.invTexts.push(this.add.text(cx, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.ability,
        color: COLORS.gold,
      }));
    }
  }

  private buildPanel3() {
    const cx = HUD_X + 14;

    this.upgradeTitle = this.add.text(cx, 0, 'MELHORIAS', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.panelTitle,
      color: COLORS.dimText,
    });

    for (let i = 0; i < 30; i++) {
      this.statTexts.push(this.add.text(cx, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.upgrade,
        color: COLORS.logText,
      }));
    }
  }

  private buildPanel4() {
    this.logHeader = this.add.text(HUD_X + 14, 0, '\u203a LOG DO SISTEMA', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.panelTitle,
      color: COLORS.dimText,
    });

    for (let i = 0; i < 8; i++) {
      this.messageTexts.push(this.add.text(HUD_X + 14, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.log,
        color: COLORS.muted,
      }));
    }
  }

  private buildFooter() {
    this.footerText = this.add.text(HUD_X + 14, 628, `System Purge v${version}    [Q/E] Hab  [1-3] Usar`, {
      fontFamily: FONT,
      fontSize: FONT_SIZES.footer,
      color: COLORS.dimBorder,
    });
  }

  private messageColor(msg: string): string {
    if (msg.includes('***') || msg.includes('ATUALIZADO')) return COLORS.warning;
    if (msg.includes('FALHOU')) return COLORS.error;
    if (msg.includes('acerta') && msg.includes('dano')) return COLORS.logDano;
    if (msg.includes('neutralizado')) return COLORS.logMorte;
    if (msg.includes('---') || msg.includes('Acessando') || msg.includes('SYSTEM PURGE') || msg.includes('Kernel')) return COLORS.logSistema;
    return COLORS.muted;
  }

  update() {
    const R = RegistryKeys;
    const hudVer = (this.registry.get(R.hud) as number) ?? 0;
    if (hudVer === this.lastHudVersion) return;
    this.lastHudVersion = hudVer;

    const hp = (this.registry.get(R.hp) as number) ?? 0;
    const maxHp = (this.registry.get(R.maxHp) as number) ?? 1;
    const level = (this.registry.get(R.level) as number) ?? 1;
    const floor = (this.registry.get(R.floor) as number) ?? 1;
    const atk = (this.registry.get(R.attack) as number) ?? 0;
    const def = (this.registry.get(R.defense) as number) ?? 0;
    const xp = (this.registry.get(R.xp) as number) ?? 0;
    const xpN = (this.registry.get(R.xpNext) as number) ?? 1;
    const kills = (this.registry.get(R.kills) as number) ?? 0;
    const name = (this.registry.get(R.name) as string) ?? 'process.exe';
    const msgs = (this.registry.get(R.messages) as string[]) ?? [];
    const upgrades = (this.registry.get(R.upgrades) as Map<string, number>) ?? new Map();
    const inventory = (this.registry.get(R.inventory) as (string | null)[]) ?? [null, null, null];
    const classId = (this.registry.get(R.classId) as string) ?? 'limpador';
    const cooldowns = (this.registry.get(R.cooldowns) as number[]) ?? [];
    const abilities = (this.registry.get(R.abilities) as { id: string; name: string; cooldown: number; type: string }[]) ?? [];
    const bleedTicks = (this.registry.get(R.bleedTicks) as number) ?? 0;
    const defenseBuff = (this.registry.get(R.defenseBuff) as number) ?? 0;

    const className = CLASS_NAMES[classId] ?? classId;
    const b = loadBindings();

    this.updatePanel1({ name, level, floor, className, bleedTicks, defenseBuff, hp, maxHp, xp, xpN, kills });
    this.updatePanel2(abilities, cooldowns, inventory, b);
    this.updatePanel3(upgrades, level);
    this.updatePanel4(msgs);
    this.updateFooter(b);
  }

  private updatePanel1(data: { name: string; level: number; floor: number; className: string; bleedTicks: number; defenseBuff: number; hp: number; maxHp: number; xp: number; xpN: number; kills: number }) {
    this.headerText.setText(data.name);
    this.subtitleText.setText(`NV ${data.level}  \u2502  /system/${data.floor}`);
    let classLine = `Classe: ${data.className}`;
    if (data.bleedTicks > 0) classLine += '   \u25b8 SANGRA';
    if (data.defenseBuff > 0) classLine += '   \u25b8 CRIPTO';
    this.classText.setText(classLine);

    const barW = PANEL_W - 28;
    const hpPct = Math.max(0, Math.min(1, data.hp / data.maxHp));
    this.hpBarFill.clear();
    if (hpPct > 0) {
      this.hpBarFill.fillStyle(0x00ff88);
      this.hpBarFill.fillRect(HUD_X + 15, 61, Math.floor((barW - 2) * hpPct), 12);
    }
    this.hpText.setText(`${data.hp}/${data.maxHp}`);
    this.hpText.setColor('#ff4444');

    const xpPct = Math.max(0, Math.min(1, data.xp / data.xpN));
    this.xpBarFill.clear();
    if (xpPct > 0) {
      this.xpBarFill.fillStyle(0x4488ff);
      this.xpBarFill.fillRect(HUD_X + 15, 77, Math.floor((barW - 2) * xpPct), 6);
    }
    this.xpText.setText(`${data.xp}/${data.xpN}`);
    this.statsText.setText(`ABATES  ${data.kills}`);
  }

  private updatePanel2(abilities: { id: string; name: string; cooldown: number; type: string }[], cooldowns: number[], inventory: (string | null)[], b: Bindings) {
    const p2y = 112;
    const p2h = 110;
    this.panel2.clear();
    this.panelRect(this.panel2, p2y, p2h);

    const cx = HUD_X + 14;
    let curY = p2y + 8;
    const abilityCount = abilities.length;

    for (let i = 0; i < 2; i++) {
      if (i < abilityCount) {
        const a = abilities[i];
        const cd = cooldowns[i] ?? 0;
        const ready = cd === 0;
        const key = displayKey(i === 0 ? b.ability_0 : b.ability_1);
        const status = ready ? 'PRONTO' : `CD: ${cd}`;
        const pad = Math.max(1, 36 - a.name.length - status.length);
        this.abilTexts[i].setText(`[${key}] ${a.name}${' '.repeat(pad)}${status}`);
        this.abilTexts[i].setColor(ready ? COLORS.abilityReady : COLORS.abilityCd);
        this.abilTexts[i].setY(curY);
        this.abilTexts[i].setVisible(true);
        curY += 18;
      } else {
        this.abilTexts[i].setVisible(false);
      }
    }

    curY += 4;
    this.div1.clear();
    this.div1.lineStyle(1, 0x1a3a2a, 0.5);
    this.div1.lineBetween(HUD_X + 14, curY, RIGHT - 14, curY);
    curY += 6;

    const itemKeys = [b.item_0, b.item_1, b.item_2];
    for (let i = 0; i < 3; i++) {
      const id = inventory[i];
      const key = displayKey(itemKeys[i]);
      const txt = id && ITEM_NAMES[id] ? `[${key}] ${ITEM_NAMES[id]}` : `[${key}] ---`;
      this.invTexts[i].setText(txt);
      this.invTexts[i].setY(curY);
      this.invTexts[i].setVisible(true);
      curY += 16;
    }
  }

  private updatePanel3(upgrades: Map<string, number>, level: number) {
    const p3y = 230;
    const p3h = 258;
    this.panel3.clear();
    this.panelRect(this.panel3, p3y, p3h);

    let curY = p3y + 8;
    this.upgradeTitle.setY(curY);
    curY += 14;
    const cx = HUD_X + 14;

    const upgradeLines: { text: string; color: string }[] = [];
    for (const [id, lvl] of upgrades) {
      const info = UPGRADE_DISP[id];
      const bonus = info ? info.fmt(lvl, level) : '';
      const color = info ? info.color : COLORS.logText;
      const name = upgradeNameFromId[id] ?? id;
      upgradeLines.push({ text: `${name.padEnd(22)} ${bonus.padEnd(12)} nv${lvl}`, color });
    }

    const n = upgradeLines.length;
    for (let i = 0; i < n; i++) {
      this.statTexts[i].setText(upgradeLines[i].text);
      this.statTexts[i].setPosition(cx, curY);
      this.statTexts[i].setColor(upgradeLines[i].color);
      this.statTexts[i].setVisible(true);
      curY += 14;
    }
    for (let i = n; i < this.statTexts.length; i++) {
      this.statTexts[i].setVisible(false);
    }
  }

  private updatePanel4(msgs: string[]) {
    const p4y = 494;
    const p4h = 130;
    this.panel4.clear();
    this.panelRect(this.panel4, p4y, p4h);
    this.logHeader.setY(p4y + 6);

    const logStartY = p4y + 20;
    const lineH = 14;
    const maxLines = 8;
    const total = msgs.length;
    const offset = Math.max(0, total - maxLines);

    for (let i = 0; i < maxLines; i++) {
      const msgIdx = i + offset;
      if (msgIdx < total) {
        const msg = msgs[msgIdx];
        this.messageTexts[i].setText(msg);
        this.messageTexts[i].setColor(this.messageColor(msg));
        const alpha = maxLines > 1 ? 0.55 + 0.45 * (i / (maxLines - 1)) : 1;
        this.messageTexts[i].setAlpha(alpha);
        this.messageTexts[i].setY(logStartY + i * lineH);
        this.messageTexts[i].setVisible(true);
      } else {
        this.messageTexts[i].setVisible(false);
      }
    }
  }

  private updateFooter(b: Bindings) {
    const abil0 = displayKey(b.ability_0);
    const abil1 = displayKey(b.ability_1);
    const inv0 = displayKey(b.item_0);
    const inv1 = displayKey(b.item_1);
    const inv2 = displayKey(b.item_2);
    this.footerText.setText(`System Purge v${version}    [${abil0}/${abil1}] Hab  [${inv0}-${inv1}-${inv2}] Usar`);
  }
}
