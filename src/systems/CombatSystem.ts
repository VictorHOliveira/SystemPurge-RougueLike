import Phaser from 'phaser';
import { GameState } from './GameState';
import { Entity } from '../entities/Entity';
import { Enemy } from '../entities/Enemy';
import { TILE, ENCRYPTION_REDUCTION, LAMINA_BLEED_TICKS, LAMINA_BLEED_DMG, REFLECT_DAMAGE } from '../constants';
import { FONT } from '../theme';
import { sound } from '../audio/SoundManager';
import { Player } from '../entities/Player';
import { MessageLog } from '../ui/MessageLog';

const BLEED_BITS = ['0', '1'];

export interface CombatCallbacks {
  onEnemyDeath: (enemy: Enemy) => void;
  spawnParticles: (x: number, y: number, tint: number, count?: number) => void;
  enemyAt?: (x: number, y: number) => Enemy | null;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private state: GameState;
  private callbacks: CombatCallbacks;

  private bleedTextPool: Phaser.GameObjects.Text[] = [];
  private bleedPoolIdx = 0;
  private enemyMap = new Map<string, Enemy>();

  constructor(scene: Phaser.Scene, state: GameState, callbacks: CombatCallbacks) {
    this.scene = scene;
    this.state = state;
    this.callbacks = callbacks;
  }

  rebuildEnemyMap() {
    this.enemyMap.clear();
    for (const e of this.state.enemies) {
      if (e.isAlive) this.enemyMap.set(e.id, e);
    }
  }

  private getEnemyAt(x: number, y: number): Enemy | null {
    return this.callbacks.enemyAt ? this.callbacks.enemyAt(x, y) : null;
  }

  private getBleedText(): Phaser.GameObjects.Text {
    if (this.bleedPoolIdx < this.bleedTextPool.length) {
      const t = this.bleedTextPool[this.bleedPoolIdx++];
      t.setVisible(true).setAlpha(1).setScale(1);
      return t;
    }
    const t = this.scene.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '10px', color: '#66ff66',
    }).setDepth(12);
    this.bleedTextPool.push(t);
    this.bleedPoolIdx++;
    return t;
  }

  resetBleedPool() {
    for (const t of this.bleedTextPool) t.setVisible(false);
    this.bleedPoolIdx = 0;
  }

  meleeAttack(attacker: Entity, defender: Entity, isProjectile: boolean = false) {
    const { player, messageLog, enemyBleeds } = this.state;
    const isPlayerDef = defender === player;
    const isPlayerAtk = attacker === player;

    if (isPlayerAtk) sound.play('player_melee');
    if (isPlayerDef) sound.play('player_hit');

    if (isPlayerDef && player.hasDodge && Math.random() < 0.15) {
      messageLog.add(`${player.classDef.name} desviou de ${attacker.name}.`);
      return;
    }

    if (isPlayerDef && player.shieldNextHit) {
      player.shieldNextHit = false;
      messageLog.add('Barreira de Protocolo absorveu o ataque!');
      this.callbacks.spawnParticles(player.x, player.y, 0x44ddff, 6);
      return;
    }

    const dmg = this.calcDamage(attacker, defender, isPlayerAtk, isPlayerDef, isProjectile);
    if (dmg <= 0) return;

    const dealt = defender.takeDamage(dmg);
    const isEnemyDef = !isPlayerDef;
    if (isEnemyDef && dealt > 0) sound.play('enemy_hit');
    messageLog.add(`${attacker.name} acerta ${defender.name} com ${dealt} de dano.`);

    if (isPlayerAtk && dealt > 0 && isEnemyDef) {
      this.callbacks.spawnParticles(defender.x, defender.y, 0x00ff88, 4);
      this.applyLifeSteal(player, messageLog);
      this.applyBleed(player, defender as Enemy, enemyBleeds, messageLog);
      if (player.tempAtkCharges > 0) {
        player.tempAtkCharges--;
        if (player.tempAtkCharges === 0) player.tempAtkBonus = 0;
      }
    }

    if (isPlayerDef) {
      this.applyReflect(attacker, player, dealt, messageLog);
      if (player.tempDefCharges > 0) {
        player.tempDefCharges--;
        if (player.tempDefCharges === 0) player.tempDefBonus = 0;
      }
    }

    if (isPlayerAtk && dealt > 0 && isEnemyDef && defender.isAlive) {
      this.applyDoubleStrike(player, attacker, defender as Enemy, messageLog);
    }

    if (isPlayerDef) this.checkFatalGuard(player, dealt);

    if (!defender.isAlive && isEnemyDef) {
      this.callbacks.onEnemyDeath(defender as Enemy);
    }
  }

  private calcDamage(attacker: Entity, defender: Entity, isPlayerAtk: boolean, isPlayerDef: boolean, isProjectile: boolean): number {
    const { player } = this.state;

    if (isPlayerAtk && !isProjectile && !player.classDef.canMelee) return 0;
    if (isPlayerDef && player.fatalGuardTriggered) return 0;

    let atkVal = isPlayerAtk ? player.effectiveAtk : attacker.attack;
    let defVal = isPlayerDef ? player.effectiveDef : defender.defense;

    if (isPlayerAtk && player.classDef.ignoreDefense) defVal = 0;

    let dmg = Math.max(1, atkVal - defVal);

    if (isPlayerAtk && !isProjectile) {
      const cd = player.classDef;
      dmg += cd.meleeBonus;
      dmg = Math.floor(dmg * cd.meleeMultiplier);
    }

    if (isPlayerDef && player.isDefenseBuffed) {
      dmg = Math.floor(dmg * 0.5);
      if (player.defenseBuffCharges > 0) {
        player.defenseBuffCharges--;
      }
    }

    dmg = Math.max(0, dmg);

    if (isPlayerDef && player.hasEncryption) {
      dmg = Math.max(0, dmg - ENCRYPTION_REDUCTION);
      player.encryptionLayerUsed = true;
      this.state.messageLog.add('Camada de Criptografia reduziu dano em 3.');
    }

    return dmg;
  }

  private applyLifeSteal(player: Player, messageLog: MessageLog) {
    const ls = player.lifeStealAmount;
    if (ls > 0 && Math.random() < 0.5) {
      player.heal(ls);
      messageLog.add(`Dreno de Vida restaurou ${ls} HP.`);
    }
  }

  private applyBleed(player: Player, defender: Enemy, enemyBleeds: Map<string, { ticks: number; damage: number }>, messageLog: MessageLog) {
    if (player.acquiredUpgrades.has('lamina_energizada')) {
      enemyBleeds.set(defender.id, { ticks: LAMINA_BLEED_TICKS, damage: LAMINA_BLEED_DMG });
      messageLog.add(`${defender.name} sangrando (1 por 3 turnos).`);
    }
  }

  private applyReflect(attacker: Entity, player: Player, dealt: number, messageLog: MessageLog) {
    const isEnemyAtk = !(attacker === player);
    if (player.reflectBuffCharges > 0 && dealt > 0) {
      const rdmg = attacker.takeDamage(dealt);
      if (rdmg > 0) messageLog.add(`Espelhamento refletiu ${rdmg} de dano!`);
      if (!attacker.isAlive && isEnemyAtk) {
        this.callbacks.onEnemyDeath(attacker as Enemy);
      }
      player.reflectBuffCharges--;
      return;
    }
    const upgradeRc = player.reflectChance;
    const classRc = player.classDef.reflectPercent / 100;
    const shieldRc = player.acquiredUpgrades.has('escudo_reativo') ? 0.15 : 0;
    const totalRc = Math.max(upgradeRc, classRc, shieldRc);
    if (totalRc > 0 && dealt > 0 && Math.random() < totalRc) {
      const rdmg = attacker.takeDamage(REFLECT_DAMAGE);
      if (rdmg > 0) messageLog.add(`Dano refletido: ${rdmg} (${Math.round(totalRc * 100)}%).`);
      if (!attacker.isAlive && isEnemyAtk) {
        this.callbacks.onEnemyDeath(attacker as Enemy);
      }
    }
  }

  private applyDoubleStrike(player: Player, attacker: Entity, defender: Enemy, messageLog: MessageLog) {
    if (player.acquiredUpgrades.has('golpe_duplo') && Math.random() < 0.3) {
      const dmg2 = this.calcDamage(attacker, defender, true, false, false);
      if (dmg2 <= 0) return;
      const dealt2 = defender.takeDamage(dmg2);
      messageLog.add(`Golpe Duplo! +${dealt2} de dano.`);
      sound.play('enemy_hit');
      if (!defender.isAlive) this.callbacks.onEnemyDeath(defender);
    }
  }

  private checkFatalGuard(player: Player, dealt: number) {
    if (!player.isAlive && player.hasFatalGuard) {
      player.hp = Math.ceil(player.maxHp * 0.25);
      player.fatalGuardUsed = true;
      player.fatalGuardTriggered = true;
      this.state.messageLog.add('Proteção do Setor de Boot! Recuperou 25% da vida.');
    }
  }

  processAdjacentAttacks() {
    const { player } = this.state;
    if (!player.isAlive) return;

    const px = player.x;
    const py = player.y;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const enemy = this.getEnemyAt(px + dx, py + dy);
        if (enemy?.isAlive) {
          this.meleeAttack(enemy, player);
          if (!player.isAlive) return;
        }
      }
    }
  }

  suicideExplosion(enemy: Enemy, player: Player) {
    if (player.fatalGuardTriggered) return;
    const dmg = Math.max(3, enemy.attack * 2);
    const dealt = player.takeDamage(dmg);
    this.state.messageLog.add(`${enemy.name} EXPLODE causando ${dealt} de dano!`);
    sound.play('player_hit');
    this.callbacks.spawnParticles(enemy.x, enemy.y, 0xff2200, 12);
    enemy.hp = 0;
    if (player.tempDefCharges > 0) {
      player.tempDefCharges--;
      if (player.tempDefCharges === 0) player.tempDefBonus = 0;
    }
    this.checkFatalGuard(player, dealt);
    if (!player.isAlive) this.state.messageLog.add(`${player.classDef.name} foi derrubado.`);
  }

  rangedAttack(enemy: Enemy, player: Player) {
    if (player.fatalGuardTriggered) return;
    const dmg = Math.max(1, enemy.attack - player.effectiveDef);
    const dealt = player.takeDamage(dmg);
    this.state.messageLog.add(`${enemy.name} dispara em ${player.classDef.name}: ${dealt} de dano.`);
    sound.play('player_hit');
    this.callbacks.spawnParticles(player.x, player.y, 0xff8800, 5);
    if (player.tempDefCharges > 0) {
      player.tempDefCharges--;
      if (player.tempDefCharges === 0) player.tempDefBonus = 0;
    }
    this.checkFatalGuard(player, dealt);
    if (!player.isAlive) this.state.messageLog.add(`${player.classDef.name} foi derrubado.`);
  }

  processClassPressure() {
    const { player, messageLog } = this.state;
    let pd = player.classDef.pressureDamage;
    if (pd <= 0) return;
    if (player.acquiredUpgrades.has('campo_pressurizado')) pd += 1;
    const px = player.x;
    const py = player.y;
    const dirs: [number, number][] = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
      const e = this.getEnemyAt(px + dx, py + dy);
      if (e?.isAlive) {
        e.takeDamage(pd);
        messageLog.add(`Pressão de Pacotes: ${e.name} tomou ${pd} de dano.`);
        if (!e.isAlive) this.callbacks.onEnemyDeath(e);
      }
    }
  }

  processEnemyBleeds() {
    const { messageLog, enemyBleeds } = this.state;
    this.resetBleedPool();
    for (const [id, bleed] of enemyBleeds) {
      const enemy = this.enemyMap.get(id);
      if (!enemy || !enemy.isAlive) {
        enemyBleeds.delete(id);
        continue;
      }
      enemy.takeDamage(bleed.damage);
      messageLog.add(`${enemy.name} sangra: ${bleed.damage} de dano.`);

      for (let i = 0; i < 3; i++) {
        const bit = this.getBleedText();
        bit.setPosition(
          enemy.x * TILE + Phaser.Math.Between(4, 28),
          enemy.y * TILE + Phaser.Math.Between(0, 8),
        );
        bit.setText(BLEED_BITS[Math.floor(Math.random() * BLEED_BITS.length)]);
        this.scene.tweens.add({
          targets: bit,
          y: bit.y - Phaser.Math.Between(16, 32),
          alpha: 0,
          duration: 600,
        });
      }

      bleed.ticks--;
      if (bleed.ticks <= 0) {
        enemyBleeds.delete(id);
        messageLog.add(`${enemy.name} parou de sangrar.`);
      }
      if (!enemy.isAlive) this.callbacks.onEnemyDeath(enemy);
    }
  }
}
