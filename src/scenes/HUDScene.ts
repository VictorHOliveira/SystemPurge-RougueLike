import Phaser from 'phaser';
import { version } from '../../package.json';
import { ALL_ITEMS } from '../data/items';
import { CLASSES } from '../data/classes';
import { ALL_UPGRADES } from '../data/upgrades';
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

const UPGRADE_LOOKUP: Record<string, string> = {};
for (const u of ALL_UPGRADES) {
  UPGRADE_LOOKUP[u.id] = u.name;
}

export class HUDScene extends Phaser.Scene {
  private panel1!: Phaser.GameObjects.Graphics;
  private panel2!: Phaser.GameObjects.Graphics;
  private panel3!: Phaser.GameObjects.Graphics;
  private panel4!: Phaser.GameObjects.Graphics;
  private panel5!: Phaser.GameObjects.Graphics;

  private headerText!: Phaser.GameObjects.Text;
  private classText!: Phaser.GameObjects.Text;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Graphics;
  private xpBarBg!: Phaser.GameObjects.Graphics;
  private xpText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  private abilTexts: Phaser.GameObjects.Text[] = [];
  private abilDescTexts: Phaser.GameObjects.Text[] = [];
  private abilTitle!: Phaser.GameObjects.Text;
  private invTexts: Phaser.GameObjects.Text[] = [];
  private itemTitle!: Phaser.GameObjects.Text;

  private upgradeTitle!: Phaser.GameObjects.Text;
  private upgradeText!: Phaser.GameObjects.Text;

  private logHeader!: Phaser.GameObjects.Text;
  private messageTexts: Phaser.GameObjects.Text[] = [];

  private lastHudVersion = -1;

  constructor() {
    super('HUD');
  }

  create() {
    this.abilTexts = [];
    this.abilDescTexts = [];
    this.invTexts = [];
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
    this.panel5 = this.add.graphics();

    this.buildPanel1();
    this.buildPanel2();
    this.buildPanel3();
    this.buildPanel4();
    this.buildPanel5();
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

    this.classText = this.add.text(cx, y + 26, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.subtitle,
      color: COLORS.subtitle,
    });

    this.hpBarBg = this.add.graphics();
    this.hpBarBg.fillStyle(0x1a1a2e);
    this.hpBarBg.fillRoundedRect(cx, y + 44, PANEL_W - 28, 14, 2);
    this.hpBarBg.lineStyle(1, 0x2a3a4a);
    this.hpBarBg.strokeRoundedRect(cx, y + 44, PANEL_W - 28, 14, 2);

    this.hpBarFill = this.add.graphics();

    this.hpText = this.add.text(cx + (PANEL_W - 28) / 2, y + 51, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.hpText,
      color: COLORS.white,
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.xpBarBg = this.add.graphics();
    this.xpBarBg.fillStyle(0x1a2a4e);
    this.xpBarBg.fillRoundedRect(cx, y + 60, PANEL_W - 28, 8, 2);
    this.xpBarBg.lineStyle(1, 0x2a3a4a);
    this.xpBarBg.strokeRoundedRect(cx, y + 60, PANEL_W - 28, 8, 2);

    this.xpBarFill = this.add.graphics();

    this.xpText = this.add.text(cx + (PANEL_W - 28) / 2, y + 60, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.xpText,
      color: COLORS.white,
    }).setOrigin(0.5, 0);

    this.statsText = this.add.text(cx, y + 76, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.stats,
      color: COLORS.subtitleText,
    });
  }

  private buildPanel2() {
    const p2y = 112;
    const p2h = 160;
    this.panelRect(this.panel2, p2y, p2h);
    this.panel2.lineStyle(1, 0x1a3a2a);
    this.panel2.lineBetween(817, p2y + 4, 817, p2y + p2h - 4);

    const cx = HUD_X + 14;

    this.abilTitle = this.add.text(cx, p2y + 4, '\u203a HABILIDADES', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.panelTitle,
      color: COLORS.lightText,
    });

    const maxAbilityWidth = 817 - cx - 4;
    for (let i = 0; i < 3; i++) {
      this.abilTexts.push(this.add.text(cx, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.ability,
        color: COLORS.subtitle,
        wordWrap: { width: maxAbilityWidth, useAdvancedWrap: true },
      }));
      this.abilDescTexts.push(this.add.text(cx + 8, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.subtitle,
        color: COLORS.muted,
        wordWrap: { width: maxAbilityWidth, useAdvancedWrap: true },
      }));
    }

    this.itemTitle = this.add.text(825, p2y + 4, 'ITENS', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.panelTitle,
      color: COLORS.lightText,
    });

    const maxItemWidth = RIGHT - 825 - 4;
    for (let i = 0; i < 6; i++) {
      this.invTexts.push(this.add.text(825, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.ability,
        color: COLORS.gold,
        wordWrap: { width: maxItemWidth, useAdvancedWrap: true },
      }));
    }
  }

  private buildPanel3() {
    const p3y = 278;
    const p3h = 190;
    this.panelRect(this.panel3, p3y, p3h);

    this.upgradeTitle = this.add.text(HUD_X + 14, p3y + 4, '\u203a MELHORIAS', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.panelTitle,
      color: COLORS.lightText,
    });

    this.upgradeText = this.add.text(HUD_X + 18, p3y + 22, '', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.upgrade,
      color: COLORS.muted,
      lineSpacing: 2,
    });
  }

  private buildPanel4() {
    const p4y = 474;
    const p4h = 130;
    this.panelRect(this.panel4, p4y, p4h);

    this.logHeader = this.add.text(HUD_X + 14, p4y + 4, '\u203a LOG DO SISTEMA', {
      fontFamily: FONT,
      fontSize: FONT_SIZES.panelTitle,
      color: COLORS.lightText,
    });

    for (let i = 0; i < 8; i++) {
      this.messageTexts.push(this.add.text(HUD_X + 14, 0, '', {
        fontFamily: FONT,
        fontSize: FONT_SIZES.log,
        color: COLORS.muted,
      }));
    }
  }

  private buildPanel5() {
    // unused - kept for structure parity
  }

  private buildFooter() {
    this.add.text(HUD_X + 14, 616, '', {
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
    const tempAtk = (this.registry.get(R.tempAtkBonus) as number) ?? 0;
    const effectiveAtk = atk + tempAtk;
    const xp = (this.registry.get(R.xp) as number) ?? 0;
    const xpN = (this.registry.get(R.xpNext) as number) ?? 1;
    const kills = (this.registry.get(R.kills) as number) ?? 0;
    const name = (this.registry.get(R.name) as string) ?? 'process.exe';
    const msgs = (this.registry.get(R.messages) as string[]) ?? [];
    const inventory = (this.registry.get(R.inventory) as (string | null)[]) ?? [null, null, null, null, null, null];
    const unlockedSlots = (this.registry.get(R.unlockedSlots) as number) ?? 2;
    const classId = (this.registry.get(R.classId) as string) ?? 'limpador';
    const cooldowns = (this.registry.get(R.cooldowns) as number[]) ?? [];
    const abilities = (this.registry.get(R.abilities) as {
      id: string; name: string; cooldown: number; type: string;
      description?: string; damage?: number; duration?: number;
    }[]) ?? [];
    const bleedTicks = (this.registry.get(R.bleedTicks) as number) ?? 0;
    const defenseBuff = (this.registry.get(R.defenseBuff) as number) ?? 0;
    const upgradesMap = (this.registry.get(R.upgrades) as Map<string, number>) ?? new Map();

    const className = CLASS_NAMES[classId] ?? classId;
    const b = loadBindings();

    this.updatePanel1({ name, level, floor, className, bleedTicks, defenseBuff, hp, maxHp, xp, xpN, kills });

    const abilKey0 = displayKey(b.ability_0);
    const abilKey1 = displayKey(b.ability_1);
    const abilKey2 = displayKey(b.ability_2);
    this.updatePanel2_3(abilities, cooldowns, inventory, unlockedSlots, effectiveAtk, hp, maxHp, [abilKey0, abilKey1, abilKey2], b);
    this.updatePanel4(upgradesMap);
    this.updatePanel5(msgs);
    this.updateFooter(b);
  }

  private updatePanel1(data: { name: string; level: number; floor: number; className: string; bleedTicks: number; defenseBuff: number; hp: number; maxHp: number; xp: number; xpN: number; kills: number }) {
    this.headerText.setText(data.name);
    let classLine = `Nv ${data.level}  \u2502  /system/${data.floor}  \u2502  ${data.className}`;
    if (data.bleedTicks > 0) classLine += '   \u25b8 SANGRA';
    if (data.defenseBuff > 0) classLine += '   \u25b8 CRIPTO';
    this.classText.setText(classLine);

    const y = 6;
    const barW = PANEL_W - 28;
    const hpPct = Math.max(0, Math.min(1, data.hp / data.maxHp));
    this.hpBarFill.clear();
    if (hpPct > 0) {
      this.hpBarFill.fillStyle(0x00ff88);
      this.hpBarFill.fillRect(HUD_X + 15, y + 45, Math.floor((barW - 2) * hpPct), 12);
    }
    this.hpText.setText(`${data.hp}/${data.maxHp}`);
    this.hpText.setColor('#ff4444');

    const xpPct = Math.max(0, Math.min(1, data.xp / data.xpN));
    this.xpBarFill.clear();
    if (xpPct > 0) {
      this.xpBarFill.fillStyle(0x4488ff);
      this.xpBarFill.fillRect(HUD_X + 15, y + 61, Math.floor((barW - 2) * xpPct), 6);
    }
    this.xpText.setText(`${data.xp}/${data.xpN}`);
    this.statsText.setText(`ABATES  ${data.kills}`);
  }

  private updatePanel2_3(
    abilities: { id: string; name: string; cooldown: number; type: string; description?: string; damage?: number; duration?: number }[],
    cooldowns: number[],
    inventory: (string | null)[],
    unlockedSlots: number,
    effectiveAtk: number,
    hp: number,
    maxHp: number,
    abilKeys: string[],
    b: Bindings,
  ) {
    const p2y = 112;
    const p2h = 160;
    this.panel2.clear();
    this.panelRect(this.panel2, p2y, p2h);
    this.panel2.lineStyle(1, 0x1a3a2a);
    this.panel2.lineBetween(817, p2y + 4, 817, p2y + p2h - 4);

    this.abilTitle.setY(p2y + 4);
    this.itemTitle.setY(p2y + 4);

    const abilX = HUD_X + 14;
    let curY = p2y + 22;

    for (let i = 0; i < 3; i++) {
      if (i < abilities.length) {
        const a = abilities[i];
        const cd = cooldowns[i] ?? 0;
        const ready = cd === 0;
        const key = abilKeys[i];
        const displayKey_ = ready ? key : `${cd}`;
        this.abilTexts[i].setText(`[${displayKey_}] ${a.name}`);
        this.abilTexts[i].setColor(ready ? COLORS.abilityReady : COLORS.abilityCd);
        this.abilTexts[i].setPosition(abilX, curY);
        this.abilTexts[i].setVisible(true);
        curY += this.abilTexts[i].height + 1;

        const statsStr = this.abilityStats(a, effectiveAtk, hp, maxHp);
        this.abilDescTexts[i].setText(`\u2192 ${statsStr}`);
        this.abilDescTexts[i].setPosition(abilX + 6, curY);
        this.abilDescTexts[i].setVisible(true);
        curY += 16;
      } else {
        this.abilTexts[i].setVisible(false);
        this.abilDescTexts[i].setVisible(false);
      }
    }

    const itemX = 825;
    curY = p2y + 22;
    for (let i = 0; i < 6; i++) {
      const key = displayKey(i === 0 ? b.item_0 : i === 1 ? b.item_1 : i === 2 ? b.item_2 : i === 3 ? b.item_3 : i === 4 ? b.item_4 : b.item_5);
      const locked = i >= unlockedSlots;
      if (locked) {
        this.invTexts[i].setText(`[${key}]  \u{1F512}`);
        this.invTexts[i].setColor(COLORS.error);
      } else {
        const id = inventory[i];
        const txt = id && ITEM_NAMES[id] ? `[${key}]  ${ITEM_NAMES[id]}` : `[${key}]  ---`;
        this.invTexts[i].setText(txt);
        this.invTexts[i].setColor(COLORS.gold);
      }
      this.invTexts[i].setPosition(itemX, curY);
      this.invTexts[i].setVisible(true);
      curY += this.invTexts[i].height + 2;
    }
  }

  private updatePanel4(upgradesMap: Map<string, number>) {
    const p3y = 278;
    this.panel3.clear();
    this.panelRect(this.panel3, p3y, 190);
    this.upgradeTitle.setY(p3y + 4);

    const entries: string[] = [];
    for (const [id, lvl] of upgradesMap) {
      const displayName = UPGRADE_LOOKUP[id];
      if (!displayName) continue;
      const suffix = lvl > 1 ? ` (nv${lvl})` : '';
      entries.push(`\u2022 ${displayName}${suffix}`);
    }
    const mid = Math.ceil(entries.length / 2);
    const col1 = entries.slice(0, mid);
    const col2 = entries.slice(mid);
    const padLen = col1.reduce((m, s) => Math.max(m, s.length), 0);
    const lines: string[] = [];
    for (let i = 0; i < Math.max(col1.length, col2.length); i++) {
      const left = col1[i] ?? '';
      const right = col2[i] ?? '';
      lines.push(left.padEnd(padLen + 3) + right);
    }
    this.upgradeText.setText(lines.join('\n'));
  }

  private updatePanel5(msgs: string[]) {
    const p4y = 474;
    const p4h = 130;
    this.panel4.clear();
    this.panelRect(this.panel4, p4y, p4h);
    this.logHeader.setY(p4y + 4);

    const logStartY = p4y + 20;
    const lineH = 13;
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
        this.messageTexts[i].setPosition(HUD_X + 14, logStartY + i * lineH);
        this.messageTexts[i].setVisible(true);
      } else {
        this.messageTexts[i].setVisible(false);
      }
    }
  }

  private updateFooter(b: Bindings) {
    const abil0 = displayKey(b.ability_0);
    const abil1 = displayKey(b.ability_1);
    const abil2 = displayKey(b.ability_2);
    const inv0 = displayKey(b.item_0);
    const inv1 = displayKey(b.item_1);
    const inv2 = displayKey(b.item_2);
    const inv3 = displayKey(b.item_3);
    const inv4 = displayKey(b.item_4);
    const inv5 = displayKey(b.item_5);
    this.children.list[this.children.list.length - 1]?.destroy();
    this.add.text(HUD_X + 14, 616, `System Purge v${version}    [${abil0}/${abil1}/${abil2}] Hab  [${inv0}-${inv1}-${inv2}-${inv3}-${inv4}-${inv5}] Usar`, {
      fontFamily: FONT,
      fontSize: FONT_SIZES.footer,
      color: COLORS.lightText,
    });
  }

  private abilityStats(a: { type: string; damage?: number; duration?: number }, effectiveAtk: number, hp: number, maxHp: number): string {
    switch (a.type) {
      case 'melee_aoe': return '[ATQ - DEF]';
      case 'projectile_barrage': return '[ATQ \u00d71,5]';
      case 'defense_buff': return `[-50% ${a.duration ?? 3}t]`;
      case 'aoe_damage': return a.duration ? `[${a.damage ?? 8} + sangra]` : `[${a.damage ?? 8}]`;
      case 'dot': return a.duration ? `[${a.damage ?? 10} + sangra ${a.duration}t]` : `[${a.damage ?? 10}]`;
      case 'heal': return `[cura ~${Math.max(1, Math.floor((maxHp - hp) * 0.5))}]`;
      case 'self_buff': return `[+${a.damage ?? 5} ATQ ${a.duration ?? 4}t]`;
      case 'shield': return '[absorve]';
      case 'knockback': return '[empurra]';
      case 'reflect_buff': return `[reflete ${a.duration ?? 2}t]`;
      default: return '';
    }
  }
}
