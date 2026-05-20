import Phaser from 'phaser';
import { GameState } from './GameState';
import { Entity } from '../entities/Entity';
import { Enemy } from '../entities/Enemy';
import { TILE } from '../constants';
import { sound } from '../audio/SoundManager';

export interface CombatCallbacks {
  onEnemyDeath: (enemy: Enemy) => void;
  spawnParticles: (x: number, y: number, tint: number, count?: number) => void;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private state: GameState;
  private callbacks: CombatCallbacks;

  constructor(scene: Phaser.Scene, state: GameState, callbacks: CombatCallbacks) {
    this.scene = scene;
    this.state = state;
    this.callbacks = callbacks;
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

    let atkVal = isPlayerAtk ? player.effectiveAtk : attacker.attack;
    let defVal = isPlayerDef ? player.effectiveDef : defender.defense;

    if (isPlayerAtk) {
      const cd = player.classDef;
      if (cd.ignoreDefense) defVal = 0;
      if (!cd.canMelee && !isProjectile) atkVal = 0;
    }

    let dmg = Math.max(1, atkVal - defVal);

    if (isPlayerAtk && !isProjectile) {
      const cd = player.classDef;
      dmg += cd.meleeBonus;
      dmg = Math.floor(dmg * cd.meleeMultiplier);
    }

    if (isPlayerDef && player.isDefenseBuffed) {
      dmg = Math.floor(dmg * 0.5);
    }

    dmg = Math.max(0, dmg);

    if (isPlayerAtk && !isProjectile && !player.classDef.canMelee) {
      dmg = 0;
    }

    if (isPlayerDef && player.hasEncryption) {
      dmg = Math.max(0, dmg - 3);
      player.encryptionLayerUsed = true;
      messageLog.add('Camada de Criptografia reduziu dano em 3.');
    }

    if (dmg === 0) return;

    const dealt = defender.takeDamage(dmg);
    if (defender instanceof Enemy && dealt > 0) sound.play('enemy_hit');
    messageLog.add(`${attacker.name} acerta ${defender.name} com ${dealt} de dano.`);

    if (isPlayerAtk && dealt > 0 && defender instanceof Enemy) {
      const ls = player.lifeStealAmount;
      if (ls > 0 && Math.random() < 0.5) {
        player.heal(ls);
        messageLog.add(`Dreno de Vida restaurou ${ls} HP.`);
      }

      if (player.acquiredUpgrades.has('lamina_energizada')) {
        enemyBleeds.set(defender.id, { ticks: 3, damage: 1 });
        messageLog.add(`${defender.name} sangrando (1 por 3 turnos).`);
      }
    }

    const upgradeRc = player.reflectChance;
    const classRc = player.classDef.reflectPercent / 100;
    const shieldRc = player.acquiredUpgrades.has('escudo_reativo') ? 0.15 : 0;
    const totalRc = Math.max(upgradeRc, classRc, shieldRc);
    if (isPlayerDef && totalRc > 0 && dealt > 0 && Math.random() < totalRc) {
      const rdmg = attacker.takeDamage(2);
      if (rdmg > 0) messageLog.add(`Dano refletido: ${rdmg} (${Math.round(totalRc * 100)}%).`);
      if (!attacker.isAlive && attacker instanceof Enemy) {
        this.callbacks.onEnemyDeath(attacker);
      }
    }

    if (isPlayerAtk && dealt > 0 && defender instanceof Enemy && defender.isAlive) {
      if (player.acquiredUpgrades.has('golpe_duplo') && Math.random() < 0.3) {
        const dmg2 = Math.max(1, atkVal - defVal);
        const dealt2 = defender.takeDamage(dmg2);
        messageLog.add(`Golpe Duplo! +${dealt2} de dano.`);
        sound.play('enemy_hit');
        if (!defender.isAlive) this.callbacks.onEnemyDeath(defender);
      }
    }

    if (isPlayerDef && !defender.isAlive && player.hasFatalGuard) {
      defender.hp = 1;
      player.fatalGuardUsed = true;
      messageLog.add('Proteção do Setor de Boot! Sobreviveu com 1 HP.');
    }

    if (!defender.isAlive && defender instanceof Enemy) {
      this.callbacks.onEnemyDeath(defender);
    }
  }

  processAdjacentAttacks() {
    const { player, enemies } = this.state;
    if (!player.isAlive) return;

    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (!player.isAlive) break;
      if (Math.abs(player.x - enemy.x) + Math.abs(player.y - enemy.y) === 1) {
        this.meleeAttack(enemy, player);
      }
    }
  }

  processClassPressure() {
    const { player, enemies, messageLog } = this.state;
    let pd = player.classDef.pressureDamage;
    if (pd <= 0) return;
    if (player.acquiredUpgrades.has('campo_pressurizado')) pd += 1;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      if (Math.abs(player.x - e.x) + Math.abs(player.y - e.y) !== 1) continue;
      e.takeDamage(pd);
      messageLog.add(`Pressao de Pacotes: ${e.name} tomou ${pd} de dano.`);
      if (!e.isAlive) this.callbacks.onEnemyDeath(e);
    }
  }

  processEnemyBleeds() {
    const { enemies, messageLog, enemyBleeds } = this.state;
    for (const [id, bleed] of enemyBleeds) {
      const enemy = enemies.find(e => e.id === id);
      if (!enemy || !enemy.isAlive) {
        enemyBleeds.delete(id);
        continue;
      }
      enemy.takeDamage(bleed.damage);
      messageLog.add(`${enemy.name} sangra: ${bleed.damage} de dano.`);

      const bits = ['0', '1'];
      for (let i = 0; i < 3; i++) {
        const bit = this.scene.add.text(
          enemy.x * TILE + Phaser.Math.Between(4, 28),
          enemy.y * TILE + Phaser.Math.Between(0, 8),
          bits[Math.floor(Math.random() * bits.length)],
          { fontFamily: 'Consolas', fontSize: '10px', color: '#66ff66' },
        ).setDepth(12);
        this.scene.tweens.add({
          targets: bit,
          y: bit.y - Phaser.Math.Between(16, 32),
          alpha: 0,
          duration: 600,
          onComplete: () => bit.destroy(),
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
