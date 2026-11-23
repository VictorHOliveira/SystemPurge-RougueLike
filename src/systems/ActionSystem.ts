import Phaser from 'phaser';
import { GameState } from './GameState';
import type { FOVSystem } from './FOV';
import { Entity } from '../entities/Entity';
import { Enemy } from '../entities/Enemy';
import { TILE, isAdjacent, HEALTH_PATCH_HEAL_PERCENT, BOSS_HEAL_PERCENT, OVERCLOCK_ATK_BONUS, OVERCLOCK_DURATION, DEFRAG_DEF_BONUS, DEFRAG_DURATION, NETWORK_PULSE_DMG, AOE_DAMAGE, DOT_RANGE, BLEED_DAMAGE } from '../constants';
import { ALL_UPGRADES, rollRewards, type Upgrade, type RewardOption } from '../data/upgrades';
import { ALL_ITEMS, type ItemDef } from '../data/items';
import { sound } from '../audio/SoundManager';
import { trackEvent } from '../analytics';
import { Player } from '../entities/Player';
import { MessageLog } from '../ui/MessageLog';
import { showToast } from '../ui/Toast';
import { COLORS } from '../theme';
import type { ClassAbility } from '../data/classes';

function rewardUpgrades(rolled: RewardOption[]): Upgrade[] {
  return rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
}

function rewardItems(rolled: RewardOption[]): ItemDef[] {
  return rolled.filter(r => r.kind === 'item').map(r => ALL_ITEMS.find(i => i.id === r.id)!).filter(Boolean);
}

export interface ActionCallbacks {
  meleeAttack: (attacker: Entity, defender: Entity, isProjectile?: boolean, damageMultiplier?: number) => void;
  spawnParticles: (x: number, y: number, tint: number, count?: number) => void;
  spawnFx?: (x: number, y: number, key: string, size?: number, duration?: number) => void;
  onEnemyDeath: (enemy: Enemy) => void;
  getDirEnemy: (dx: number, dy: number) => { x: number; y: number; enemy: Enemy | null };
  onAnimationStart: () => void;
  onAnimationEnd: () => void;
  onMapRevealed?: () => void;
  endTurn: () => void;
  onBossRewardsComplete?: () => void;
}

export class ActionSystem {
  private scene: Phaser.Scene;
  private state: GameState;
  private callbacks: ActionCallbacks;

  private ringPool: Phaser.GameObjects.Graphics[] = [];
  private ringPoolIdx = 0;
  private beamPool: Phaser.GameObjects.Graphics[] = [];
  private beamPoolIdx = 0;
  private projPool: Phaser.GameObjects.Image[] = [];
  private projPoolIdx = 0;

  constructor(scene: Phaser.Scene, state: GameState, callbacks: ActionCallbacks) {
    this.scene = scene;
    this.state = state;
    this.callbacks = callbacks;
  }

  private get projectileTexture(): string {
    return this.state.classId === 'daemon' ? 'projectile_daemon' : 'projectile_player';
  }

  private getRing(): Phaser.GameObjects.Graphics {
    if (this.ringPoolIdx < this.ringPool.length) {
      const r = this.ringPool[this.ringPoolIdx++];
      r.setVisible(true).setAlpha(1).setScale(1).clear();
      this.scene.tweens.killTweensOf(r);
      return r;
    }
    const r = this.scene.add.graphics().setDepth(8);
    this.ringPool.push(r);
    this.ringPoolIdx++;
    return r;
  }

  private getBeam(): Phaser.GameObjects.Graphics {
    if (this.beamPoolIdx < this.beamPool.length) {
      const b = this.beamPool[this.beamPoolIdx++];
      b.setVisible(true).setAlpha(1).clear();
      this.scene.tweens.killTweensOf(b);
      return b;
    }
    const b = this.scene.add.graphics().setDepth(8);
    this.beamPool.push(b);
    this.beamPoolIdx++;
    return b;
  }

  private getProjImage(): Phaser.GameObjects.Image {
    if (this.projPoolIdx < this.projPool.length) {
      const p = this.projPool[this.projPoolIdx++];
      p.setVisible(true).setAlpha(1).setScale(1);
      this.scene.tweens.killTweensOf(p);
      return p;
    }
    const p = this.scene.add.image(0, 0, this.projectileTexture).setOrigin(0.5, 0.5).setDepth(15);
    this.projPool.push(p);
    this.projPoolIdx++;
    return p;
  }

  useItem(slot: number) {
    const { player, map, enemies, messageLog, fov } = this.state;

    const itemId = player.getItem(slot);
    if (!itemId) return;

    switch (itemId) {
      case 'health_patch': {
        const healAmount = Math.max(1, Math.floor(player.maxHp * HEALTH_PATCH_HEAL_PERCENT));
        const healed = player.heal(healAmount);
        this.callbacks.spawnFx?.(player.x, player.y, 'fx_heal', TILE, 400);
        messageLog.add(`Usou Patch de Saúde: +${healed} HP.`);
        break;
      }
      case 'network_pulse': {
        let totalDmg = 0;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          if (!map.visible[e.y]?.[e.x]) continue;
          const dmg = e.takeDamage(NETWORK_PULSE_DMG);
          player.consumeAttackCharges();
          if (dmg > 0) totalDmg += dmg;
          if (!e.isAlive) this.callbacks.onEnemyDeath(e);
        }
        this.callbacks.spawnFx?.(player.x, player.y, 'fx_explosion', TILE * 3, 450);
        messageLog.add(`Pulso de Rede: ${totalDmg} de dano total.`);
        break;
      }
      case 'packet_sniffer':
        for (let y = 0; y < map.height; y++) {
          for (let x = 0; x < map.width; x++) {
            map.explored[y][x] = true;
          }
        }
        fov.compute(map, player.x, player.y);
        this.callbacks.onMapRevealed?.();
        messageLog.add('Packet Sniffer: mapa do andar revelado.');
        showToast(this.scene, {
          title: 'MAPA DO ANDAR REVELADO',
          detail: `/system/${player.floor} — todo o mapa agora está visível`,
          color: COLORS.statVis,
        });
        break;
      case 'overclock_inject':
        player.tempAtkBonus = OVERCLOCK_ATK_BONUS;
        player.tempAtkCharges = OVERCLOCK_DURATION;
        this.callbacks.spawnFx?.(player.x, player.y, 'fx_levelup', 48, 500);
        messageLog.add(`Overclock Inject: ATQ +${OVERCLOCK_ATK_BONUS} por ${OVERCLOCK_DURATION} ataques.`);
        break;
      case 'defrag_shield':
        player.tempDefBonus = DEFRAG_DEF_BONUS;
        player.tempDefCharges = DEFRAG_DURATION;
        this.callbacks.spawnFx?.(player.x, player.y, 'fx_shield', TILE, 400);
        messageLog.add(`Defrag Shield: DEF +${DEFRAG_DEF_BONUS} por ${DEFRAG_DURATION} ataques.`);
        break;
    }

    player.removeItem(slot);
    this.callbacks.endTurn();
  }

  useAbility(index: number) {
    this.ringPoolIdx = 0;
    this.beamPoolIdx = 0;
    this.projPoolIdx = 0;
    const { player, map, enemies, messageLog, fov, enemyBleeds } = this.state;

    if (index >= player.classDef.abilities.length) return;
    if (!player.canUseAbility(index)) return;

    const ability = player.classDef.abilities[index];
    player.useAbility(index);

    switch (ability.type) {
      case 'melee_aoe':
        this.doMeleeAoe(ability, player, enemies, messageLog);
        break;
      case 'projectile_barrage':
        this.doProjectileBarrage(player, enemies, messageLog);
        return;
      case 'defense_buff':
        this.doDefenseBuff(ability, player, messageLog);
        break;
      case 'aoe_damage':
        this.doAoeDamage(ability, player, enemies, messageLog, enemyBleeds);
        break;
      case 'dot':
        this.doDot(ability, player, enemies, messageLog, enemyBleeds);
        break;
      case 'heal':
        this.doHeal(ability, player, messageLog);
        break;
      case 'self_buff':
        this.doSelfBuff(ability, player, messageLog);
        break;
      case 'shield':
        this.doShield(ability, player, messageLog);
        break;
      case 'knockback':
        this.doKnockback(ability, player, enemies, messageLog);
        break;
      case 'reflect_buff':
        this.doReflectBuff(ability, player, messageLog);
        break;
    }

    this.callbacks.endTurn();
  }

  private doMeleeAoe(ability: ClassAbility, player: Player, enemies: Enemy[], messageLog: MessageLog) {
    let hitCount = 0;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      if (!isAdjacent(player.x, player.y, e.x, e.y)) continue;
      const defVal = player.classDef.ignoreDefense ? 0 : e.defense;
      const dmg = Math.max(1, player.effectiveAtk - defVal);
      e.takeDamage(dmg);
      player.consumeAttackCharges();
      hitCount++;
      this.callbacks.spawnParticles(e.x, e.y, 0x00ff88, 5);
      messageLog.add(`${e.name} atingido por ${dmg}.`);
      sound.play('enemy_hit');
      if (!e.isAlive) this.callbacks.onEnemyDeath(e);
    }
    messageLog.add(`Varredura: ${hitCount} inimigo(s) atingido(s).`);
    this.callbacks.spawnFx?.(player.x, player.y, 'fx_slash', TILE * 2.2, 300);

    const ring = this.getRing();
    ring.lineStyle(3, 0x00ff88, 0.8);
    ring.strokeCircle(0, 0, TILE * 1.5);
    ring.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);
    ring.setScale(0.2);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 250,
      ease: 'Cubic.easeOut',
      onComplete: () => { ring.clear(); ring.setVisible(false); },
    });
  }

  private doProjectileBarrage(player: Player, enemies: Enemy[], messageLog: MessageLog) {
    const dirs: [number, number][] = [
      [1, 0], [1, 1], [0, 1], [-1, 1],
      [-1, 0], [-1, -1], [0, -1], [1, -1],
    ];
    let baseIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < dirs.length; i++) {
      const [dx, dy] = dirs[i];
      const target = this.callbacks.getDirEnemy(dx, dy);
      if (!target.enemy) continue;
      const dist = Math.max(Math.abs(target.enemy.x - player.x), Math.abs(target.enemy.y - player.y));
      if (dist < bestDist) {
        bestDist = dist;
        baseIdx = i;
      }
    }
    if (bestDist === Infinity) {
      messageLog.add('Rajada de Pacotes: nenhum alvo.');
      return;
    }

    const fanIdx = [(baseIdx + dirs.length - 1) % dirs.length, baseIdx, (baseIdx + 1) % dirs.length];
    const shots = fanIdx.map(i => ({ dir: dirs[i], target: this.callbacks.getDirEnemy(...dirs[i]) }));
    const hitIds = new Set<string>();
    sound.play('projectile');
    this.callbacks.onAnimationStart();
    let completed = 0;
    for (const shot of shots) {
      const proj = this.getProjImage();
      proj.setTexture(this.projectileTexture);
      proj.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);
      this.scene.tweens.add({
        targets: proj,
        x: shot.target.x * TILE + TILE / 2,
        y: shot.target.y * TILE + TILE / 2,
        duration: 110,
        ease: 'Linear',
        onComplete: () => {
          proj.setVisible(false);
          const enemy = shot.target.enemy;
          if (enemy?.isAlive && !hitIds.has(enemy.id)) {
            hitIds.add(enemy.id);
            this.callbacks.meleeAttack(player, enemy, true, 1.5);
          }
          completed++;
          if (completed === shots.length) {
            this.callbacks.onAnimationEnd();
            messageLog.add(`Rajada de Pacotes: ${hitIds.size} alvo(s) atingido(s).`);
            this.callbacks.endTurn();
          }
        },
      });
    }
  }

  private doDefenseBuff(ability: ClassAbility, player: Player, messageLog: MessageLog) {
    player.defenseBuffCharges = ability.duration ?? 3;
    messageLog.add(`Criptografia Total: dano reduzido 50% por ${player.defenseBuffCharges} ataques.`);
  }

  private doAoeDamage(ability: ClassAbility, player: Player, enemies: Enemy[], messageLog: MessageLog, enemyBleeds: Map<string, { ticks: number; damage: number }>) {
    const aoeRange = player.overflowRange;
    let totalDmg = 0;
    let hitCount = 0;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      const dx = Math.abs(player.x - e.x);
      const dy = Math.abs(player.y - e.y);
      if (Math.max(dx, dy) > aoeRange) continue;
      const dmg = e.takeDamage(ability.damage ?? AOE_DAMAGE);
      player.consumeAttackCharges();
      totalDmg += dmg;
      hitCount++;
      messageLog.add(`${e.name} atingido por ${dmg}.`);
      this.callbacks.spawnParticles(e.x, e.y, 0xff44aa, 4);
      sound.play('enemy_hit');
      if (ability.duration && ability.duration > 0) {
        enemyBleeds.set(e.id, { ticks: ability.duration, damage: 2 + player.extraBleedDamage });
      }
      if (!e.isAlive) this.callbacks.onEnemyDeath(e);
    }
    messageLog.add(`Overflow: ${hitCount} inimigo(s) atingido(s), ${totalDmg} de dano total.`);
    this.callbacks.spawnFx?.(player.x, player.y, 'fx_explosion', TILE * (aoeRange * 2 + 1), 450);
    const cx = player.x * TILE + TILE / 2;
    const cy = player.y * TILE + TILE / 2;
    const r = aoeRange * TILE;
    const ring = this.getRing();
    ring.fillStyle(0xff44aa, 0.15);
    ring.fillCircle(0, 0, r);
    ring.lineStyle(4, 0xff44aa, 0.9);
    ring.strokeCircle(0, 0, r);
    ring.setPosition(cx, cy);
    ring.setScale(0.2);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1,
      scaleY: 1,
      alpha: 0,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => { ring.clear(); ring.setVisible(false); },
    });
  }

  private doDot(ability: ClassAbility, player: Player, enemies: Enemy[], messageLog: MessageLog, enemyBleeds: Map<string, { ticks: number; damage: number }>) {
    let target: Enemy | null = null;
    let bestDist = Infinity;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      const dx = Math.abs(player.x - e.x);
      const dy = Math.abs(player.y - e.y);
      const dist = Math.max(dx, dy);
      if (dist <= DOT_RANGE && dist < bestDist) {
        target = e;
        bestDist = dist;
      }
    }
    if (target) {
      const dmg = target.takeDamage(ability.damage ?? 10);
      player.consumeAttackCharges();
      messageLog.add(`${ability.name}: ${dmg} de dano.`);
      this.callbacks.spawnParticles(target.x, target.y, 0x66ff66, 4);
      sound.play('enemy_hit');
      if (ability.duration && ability.duration > 0) {
        enemyBleeds.set(target.id, { ticks: ability.duration, damage: BLEED_DAMAGE });
        messageLog.add(`${target.name} sangrando (${BLEED_DAMAGE} por ${ability.duration} turnos).`);
      }
      if (!target.isAlive) this.callbacks.onEnemyDeath(target);
      const beam = this.getBeam();
      beam.lineStyle(3, 0x66ff66, 0.7);
      beam.lineBetween(
        player.x * TILE + TILE / 2, player.y * TILE + TILE / 2,
        target.x * TILE + TILE / 2, target.y * TILE + TILE / 2,
      );
      this.scene.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 400,
        onComplete: () => { beam.clear(); beam.setVisible(false); },
      });
    } else {
      messageLog.add('Nenhum inimigo alcançável.');
    }
  }

  private doHeal(ability: ClassAbility, player: Player, messageLog: MessageLog) {
    const missing = player.maxHp - player.hp;
    const healAmt = Math.max(1, Math.floor(missing * 0.5));
    player.heal(healAmt);
    this.callbacks.spawnFx?.(player.x, player.y, 'fx_heal', TILE, 450);
    messageLog.add(`Restaura\u00e7\u00e3o de Sistema: +${healAmt} HP.`);
  }

  private doSelfBuff(ability: ClassAbility, player: Player, messageLog: MessageLog) {
    player.tempAtkMultiplier = ability.damage ?? 2;
    player.tempAtkBonus = 0;
    player.tempAtkCharges = ability.duration ?? 10;
    messageLog.add(`Sobrecarga de Kernel: ATQ \u00d7${player.tempAtkMultiplier} por ${player.tempAtkCharges} ataques.`);
  }

  private doShield(ability: ClassAbility, player: Player, messageLog: MessageLog) {
    player.shieldCharges = ability.duration ?? 2;
    this.callbacks.spawnFx?.(player.x, player.y, 'fx_shield', TILE, 450);
    messageLog.add(`Barreira de Protocolo: ${player.shieldCharges} ataques ser\u00e3o absorvidos.`);
  }

  private doKnockback(ability: ClassAbility, player: Player, enemies: Enemy[], messageLog: MessageLog) {
    let pushed = 0;
    for (const e of enemies) {
      if (!e.isAlive) continue;
      if (!isAdjacent(player.x, player.y, e.x, e.y)) continue;
      const dx = Math.sign(e.x - player.x);
      const dy = Math.sign(e.y - player.y);
      const nx = e.x + dx;
      const ny = e.y + dy;
      const map = this.state.map;
      if (nx >= 0 && nx < map.width && ny >= 0 && ny < map.height && map.isWalkable(nx, ny)) {
        const blocked = this.state.enemies.some(o => o !== e && o.isAlive && o.x === nx && o.y === ny);
        if (!blocked) {
          e.x = nx;
          e.y = ny;
          e.skipNextTurn = true;
          pushed++;
        }
      }
    }
    messageLog.add(`Pulso de Emerg\u00eancia: ${pushed} inimigo(s) empurrado(s).`);
  }

  private doReflectBuff(ability: ClassAbility, player: Player, messageLog: MessageLog) {
    player.reflectBuffCharges = ability.duration ?? 2;
    this.callbacks.spawnFx?.(player.x, player.y, 'fx_shield', TILE, 450);
    messageLog.add(`Espelhamento: 100% de refletir dano por ${player.reflectBuffCharges} ataques.`);
  }

  openChest(x: number, y: number) {
    const { player, messageLog, fov } = this.state;
    const ck = `${x},${y}`;
    if (!this.state.chests.has(ck) || this.state.chests.get(ck)) return;

    this.state.chests.set(ck, true);
    sound.play('chest_open');
    this.callbacks.spawnParticles(x, y, 0xffd700, 6);
    this.callbacks.spawnFx?.(x, y, 'fx_levelup', 48, 500);

    const rolled = rollRewards(player.acquiredUpgrades, player.freeSlots(), 3, this.state.classId);
    if (rolled.length === 0) {
      messageLog.add('Baú vazio.');
      return;
    }

    const upgOptions = rewardUpgrades(rolled);
    const itemOptions = rewardItems(rolled);

    trackEvent('chest_open', { floor: player.floor });

    this.scene.scene.pause();
    this.scene.scene.launch('Upgrade', {
      upgrades: upgOptions,
      items: itemOptions,
      acquired: player.acquiredUpgrades,
      mode: 'choice',
      floor: player.floor,
      onSelect: (kind: 'upgrade' | 'item', id: string) => {
        if (kind === 'upgrade') {
          player.applyUpgrade(id);
          const upg = ALL_UPGRADES.find(u => u.id === id);
          if (upg) messageLog.add(`Baú: ${upg.name} (${upg.description})`);
          this.state.fov.setRadius(player.effectiveFov);
        } else {
          player.addItem(id);
          const item = ALL_ITEMS.find(i => i.id === id);
          if (item) messageLog.add(`Baú: ${item.name} — adicionado ao inventário.`);
        }
        this.scene.scene.resume();
      },
    });
  }

  showRewardChoices(source: 'level' | 'chest') {
    const { player, messageLog, fov } = this.state;
    const rolled = rollRewards(player.acquiredUpgrades, player.freeSlots(), 3, this.state.classId);
    if (rolled.length === 0) return;

    const upgOptions = rewardUpgrades(rolled);
    const itemOptions = rewardItems(rolled);

    const mode = source === 'chest' ? 'reveal' : 'choice';

    this.scene.scene.pause();
    this.scene.scene.launch('Upgrade', {
      upgrades: upgOptions,
      items: itemOptions,
      acquired: player.acquiredUpgrades,
      mode,
      floor: player.floor,
      title: source === 'level' ? `RECOMPENSA POR NÍVEL — Nv ${player.level}` : undefined,
      onSelect: (kind: 'upgrade' | 'item', id: string) => {
        if (kind === 'upgrade') {
          player.applyUpgrade(id);
          const upg = ALL_UPGRADES.find(u => u.id === id);
          if (upg) messageLog.add(upg.name + ' ativado.');
          this.state.fov.setRadius(player.effectiveFov);
          this.state.fov.compute(this.state.map, player.x, player.y);
        } else {
          player.addItem(id);
          const item = ALL_ITEMS.find(i => i.id === id);
          if (item) messageLog.add(`${item.name} — adicionado ao inventário.`);
        }
        this.scene.scene.resume();
      },
    });
  }

  showBossRewards() {
    const { player, messageLog, fov } = this.state;
    const rolled = rollRewards(player.acquiredUpgrades, 0, 5, this.state.classId);
    const upgOptions = rewardUpgrades(rolled);

    const showHealReward = (pickLabel: string) => {
      const healAmount = Math.max(1, Math.floor(player.maxHp * BOSS_HEAL_PERCENT));
      this.scene.scene.pause();
      this.scene.scene.launch('Upgrade', {
        upgrades: [],
        items: [],
        heals: [{ id: 'heal_boss', name: 'Recuperação', description: `Recupera ${healAmount} HP`, amount: healAmount }],
        acquired: player.acquiredUpgrades,
        mode: 'reveal',
        pickCount: 1,
        floor: player.floor,
        title: `RECOMPENSA DO BOSS${pickLabel}`,
        onSelect: (_kind: 'upgrade' | 'item' | 'heal', _id: string) => {
          const healed = player.heal(healAmount);
          messageLog.add(`Recuperação: +${healed} HP.`);
          this.state.fov.setRadius(player.effectiveFov);
          this.state.fov.compute(this.state.map, player.x, player.y);
          this.scene.scene.resume();
          this.callbacks.onBossRewardsComplete?.();
        },
      });
    };

    if (upgOptions.length === 0) {
      showHealReward('');
      return;
    }

    let remainingUpgs = [...upgOptions];
    let pickCount = 2;

    const showPick = () => {
      if (pickCount <= 0) return;
      if (remainingUpgs.length === 0) {
        showHealReward(` (mais ${pickCount})`);
        return;
      }
      this.scene.scene.pause();
      this.scene.scene.launch('Upgrade', {
        upgrades: remainingUpgs,
        items: [],
        acquired: player.acquiredUpgrades,
        mode: 'choice',
        pickCount,
        floor: player.floor,
        title: `RECOMPENSA DO BOSS (mais ${pickCount})`,
        onSelect: (kind: 'upgrade' | 'item' | 'heal', id: string) => {
          if (kind !== 'upgrade') return;
          player.applyUpgrade(id);
          const upg = ALL_UPGRADES.find(u => u.id === id);
          if (upg) messageLog.add(`${upg.name} ativado.`);
          remainingUpgs = remainingUpgs.filter(u => u.id !== id);
          pickCount--;
          this.scene.scene.resume();
          if (pickCount > 0) {
            this.scene.time.delayedCall(100, showPick);
          } else {
            this.state.fov.setRadius(player.effectiveFov);
            this.state.fov.compute(this.state.map, player.x, player.y);
            this.callbacks.onBossRewardsComplete?.();
          }
        },
      });
    };

    showPick();
  }

}
