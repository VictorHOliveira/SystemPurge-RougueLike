import Phaser from 'phaser';
import { version } from '../../package.json';

const HUD_X = 648;
const BAR_W = 294;
const CENTER = HUD_X + BAR_W / 2;
const RIGHT = 942;

export class HUDScene extends Phaser.Scene {
  private hpBarBg!: Phaser.GameObjects.Graphics;
  private hpBarFill!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private xpBarBg!: Phaser.GameObjects.Graphics;
  private xpBarFill!: Phaser.GameObjects.Graphics;
  private xpText!: Phaser.GameObjects.Text;
  private headerText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;
  private upgradesText!: Phaser.GameObjects.Text;
  private logBg!: Phaser.GameObjects.Graphics;
  private messageTexts: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('HUD');
  }

  create() {
    const panel = this.add.graphics();
    panel.fillStyle(0x0a0a18);
    panel.fillRect(640, 0, 320, 640);

    const vert = this.add.graphics();
    vert.lineStyle(1, 0x1a2a3a);
    vert.lineBetween(640, 0, 640, 640);

    this.buildHeader();
    this.buildBars();
    this.buildStats();
    this.buildUpgrades();
    this.buildLog();
    this.buildFooter();
  }

  private divider(y: number) {
    const g = this.add.graphics();
    g.lineStyle(1, 0x1a2a3a, 0.5);
    g.lineBetween(HUD_X, y, RIGHT, y);
  }

  private buildHeader() {
    this.headerText = this.add.text(HUD_X, 14, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '16px',
      color: '#00ff88',
      fontStyle: 'bold',
    });
    this.headerText.setShadow(0, 0, '#00ff88', 8, false, true);

    this.subtitleText = this.add.text(HUD_X, 36, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#44ddbb',
    });

    this.divider(58);
  }

  private buildBars() {
    this.add.text(HUD_X, 60, 'HP', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#556677',
    });

    this.hpBarBg = this.add.graphics();
    this.hpBarBg.fillStyle(0x1a1a2e);
    this.hpBarBg.fillRoundedRect(HUD_X, 75, BAR_W, 18, 2);
    this.hpBarBg.lineStyle(1, 0x2a3a4a);
    this.hpBarBg.strokeRoundedRect(HUD_X, 75, BAR_W, 18, 2);

    this.hpBarFill = this.add.graphics();

    this.hpText = this.add.text(CENTER, 76, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.add.text(HUD_X, 93, 'XP', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#556677',
    });

    this.xpBarBg = this.add.graphics();
    this.xpBarBg.fillStyle(0x1a2a4e);
    this.xpBarBg.fillRoundedRect(HUD_X, 108, BAR_W, 10, 2);
    this.xpBarBg.lineStyle(1, 0x2a3a4a);
    this.xpBarBg.strokeRoundedRect(HUD_X, 108, BAR_W, 10, 2);

    this.xpBarFill = this.add.graphics();

    this.xpText = this.add.text(CENTER, 108, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '9px',
      color: '#ffffff',
    }).setOrigin(0.5, 0);

    this.divider(128);
  }

  private buildStats() {
    this.statsText = this.add.text(CENTER, 136, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#8899aa',
    }).setOrigin(0.5, 0);

    this.divider(158);
  }

  private buildUpgrades() {
    this.add.text(HUD_X, 166, 'UPGRADES', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    });

    this.upgradesText = this.add.text(HUD_X, 182, '', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: '#aabbcc',
      lineSpacing: 4,
    });

    this.divider(420);
  }

  private buildLog() {
    this.add.text(HUD_X, 428, '\u203a SYSTEM LOG', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '11px',
      color: '#445566',
    });

    this.logBg = this.add.graphics();
    this.logBg.fillStyle(0x040810);
    this.logBg.fillRoundedRect(644, 444, 302, 170, 3);
    this.logBg.lineStyle(1, 0x152030);
    this.logBg.strokeRoundedRect(644, 444, 302, 170, 3);

    for (let i = 0; i < 10; i++) {
      const t = this.add.text(HUD_X + 6, 452 + i * 16, '', {
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        color: '#8899aa',
      });
      this.messageTexts.push(t);
    }
  }

  private buildFooter() {
    this.add.text(HUD_X, 624, `System Purge v${version}`, {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#334455',
    });

    this.add.text(RIGHT, 624, '[ESC] Menu', {
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: '10px',
      color: '#334455',
    }).setOrigin(1, 0);
  }

  private messageColor(msg: string): string {
    if (msg.includes('***') || msg.includes('UPGRADE')) return '#ffdd44';
    if (msg.includes('CRASHED')) return '#ff4444';
    if (msg.includes('hits') && msg.includes('dmg')) return '#ff9977';
    if (msg.includes('neutralized')) return '#ff6655';
    if (msg.includes('---') || msg.includes('Accessing') || msg.includes('SYSTEM PURGE') || msg.includes('Kernel')) return '#44ddbb';
    return '#8899aa';
  }

  private formatUpgrades(upgrades: Map<string, number>): string {
    const names: Record<string, string> = {
      virus_scan: 'Virus Scan',
      patch_firewall: 'Patch Firewall',
      memory_expansion: 'Memory Expansion',
      kernel_optimization: 'Kernel Optimization',
      root_access: 'Root Access',
      disk_cleanup: 'Disk Cleanup',
      ram_overclock: 'RAM Overclock',
      cache_boost: 'Cache Boost',
      memory_page: 'Memory Page',
      hyperthreading: 'HyperThreading',
      data_bus: 'Data Bus',
      system_restore: 'System Restore',
      compression_algorithm: 'Compression Algorithm',
      life_steal: 'Life Steal',
      registry_cleaner: 'Registry Cleaner',
      network_shield: 'Network Shield',
      cache_partition: 'Cache Partition',
      boot_sector: 'Boot Sector Protection',
      encryption_layer: 'Encryption Layer',
    };
    const lines: string[] = [];
    for (const [id, lvl] of upgrades) {
      const n = names[id] ?? id;
      lines.push(`  \u25b8 ${n}  lv${lvl}`);
    }
    return lines.join('\n');
  }

  update() {
    const hp = (this.registry.get('hp') as number) ?? 0;
    const maxHp = (this.registry.get('maxHp') as number) ?? 1;
    const level = (this.registry.get('level') as number) ?? 1;
    const floor = (this.registry.get('floor') as number) ?? 1;
    const atk = (this.registry.get('attack') as number) ?? 0;
    const def = (this.registry.get('defense') as number) ?? 0;
    const xp = (this.registry.get('xp') as number) ?? 0;
    const xpN = (this.registry.get('xpNext') as number) ?? 1;
    const kills = (this.registry.get('kills') as number) ?? 0;
    const name = (this.registry.get('name') as string) ?? 'process.exe';
    const msgs = (this.registry.get('messages') as string[]) ?? [];
    const upgrades = (this.registry.get('upgrades') as Map<string, number>) ?? new Map();

    this.headerText.setText(name);
    this.subtitleText.setText(`LV ${level}  \u2502  DIR: /system/${floor}`);

    const hpPct = Math.max(0, Math.min(1, hp / maxHp));
    const barColor = hpPct > 0.6 ? 0x00ff88 : hpPct > 0.3 ? 0xffcc00 : 0xff4444;

    this.hpBarFill.clear();
    if (hpPct > 0) {
      this.hpBarFill.fillStyle(barColor);
      this.hpBarFill.fillRect(HUD_X + 1, 76, Math.floor((BAR_W - 2) * hpPct), 16);
    }
    this.hpText.setText(`${hp}/${maxHp}`);

    const xpPct = Math.max(0, Math.min(1, xp / xpN));
    this.xpBarFill.clear();
    if (xpPct > 0) {
      this.xpBarFill.fillStyle(0x4488ff);
      this.xpBarFill.fillRect(HUD_X + 1, 109, Math.floor((BAR_W - 2) * xpPct), 8);
    }
    this.xpText.setText(`${xp}/${xpN}`);

    this.statsText.setText(`ATK  ${atk}    DEF  ${def}    KILLS  ${kills}`);

    this.upgradesText.setText(this.formatUpgrades(upgrades));

    const total = Math.min(this.messageTexts.length, msgs.length);
    const offset = this.messageTexts.length - total;

    for (let i = 0; i < this.messageTexts.length; i++) {
      const msgIdx = i - offset;
      if (msgIdx >= 0) {
        const msg = msgs[msgIdx];
        this.messageTexts[i].setText(msg);
        this.messageTexts[i].setColor(this.messageColor(msg));
        const alpha = total > 1 ? 0.55 + 0.45 * ((i - offset) / (total - 1)) : 1;
        this.messageTexts[i].setAlpha(alpha);
        this.messageTexts[i].setVisible(true);
      } else {
        this.messageTexts[i].setVisible(false);
      }
    }
  }
}
