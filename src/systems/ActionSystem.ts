import Phaser from 'phaser';
import { GameState } from './GameState';
import type { FOVSystem } from './FOV';
import { Entity } from '../entities/Entity';
import { Enemy } from '../entities/Enemy';
import { TILE, isAdjacent } from '../constants';
import { ALL_UPGRADES, rollRewards } from '../data/upgrades';
import { ALL_ITEMS } from '../data/items';
import { sound } from '../audio/SoundManager';
import { trackEvent } from '../analytics';

export interface ActionCallbacks {
  meleeAttack: (attacker: Entity, defender: Entity, isProjectile?: boolean) => void;
  spawnParticles: (x: number, y: number, tint: number, count?: number) => void;
  onEnemyDeath: (enemy: Enemy) => void;
  getDirEnemy: (dx: number, dy: number) => { x: number; y: number; enemy: Enemy | null };
  onAnimationStart: () => void;
  onAnimationEnd: () => void;
  endTurn: () => void;
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
      case 'health_patch':
        player.heal(15);
        messageLog.add('Usou Patch de Sau\u0301de: +15 HP.');
        break;
      case 'network_pulse': {
        let totalDmg = 0;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          if (!map.visible[e.y]?.[e.x]) continue;
          const dmg = e.takeDamage(6);
          if (dmg > 0) totalDmg += dmg;
          if (!e.isAlive) this.callbacks.onEnemyDeath(e);
        }
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
        messageLog.add('Packet Sniffer: mapa revelado.');
        break;
      case 'overclock_inject':
        player.tempAtkBonus = 5;
        player.tempAtkRemaining = 5;
        messageLog.add('Overclock Inject: ATQ +5 por 5 turnos.');
        break;
      case 'defrag_shield':
        player.tempDefBonus = 5;
        player.tempDefRemaining = 5;
        messageLog.add('Defrag Shield: DEF +5 por 5 turnos.');
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
      case 'melee_aoe': {
        let hitCount = 0;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          if (!isAdjacent(player.x, player.y, e.x, e.y)) continue;
          const defVal = player.classDef.ignoreDefense ? 0 : e.defense;
          const dmg = Math.max(1, player.effectiveAtk - defVal);
          e.takeDamage(dmg);
          hitCount++;
          messageLog.add(`${e.name} atingido por ${dmg}.`);
          sound.play('enemy_hit');
          if (!e.isAlive) this.callbacks.onEnemyDeath(e);
        }
        messageLog.add(`Varredura: ${hitCount} inimigo(s) atingido(s).`);
        break;
      }
      case 'projectile_barrage': {
        const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const hits: { enemy: Enemy; tx: number; ty: number }[] = [];
        for (const [dx, dy] of dirs) {
          const target = this.callbacks.getDirEnemy(dx, dy);
          if (target.enemy) hits.push({ enemy: target.enemy, tx: target.x, ty: target.y });
        }
        if (hits.length === 0) {
          messageLog.add('Rajada de Pacotes: nenhum alvo.');
          break;
        }
        sound.play('projectile');
        this.callbacks.onAnimationStart();
        let completed = 0;
        for (const hit of hits) {
          const proj = this.getProjImage();
          proj.setTexture(this.projectileTexture);
          proj.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);
          this.scene.tweens.add({
            targets: proj,
            x: hit.tx * TILE + TILE / 2,
            y: hit.ty * TILE + TILE / 2,
            duration: 100,
            ease: 'Linear',
            onComplete: () => {
              proj.setVisible(false);
              const baseDmg = Math.max(1, player.effectiveAtk - hit.enemy.defense);
              const dmg = Math.floor(baseDmg * 1.5);
              hit.enemy.takeDamage(dmg);
              sound.play('enemy_hit');
              this.callbacks.spawnParticles(hit.enemy.x, hit.enemy.y, 0x44aaff, 4);
              messageLog.add(`Rajada: ${hit.enemy.name} tomou ${dmg}.`);
              if (!hit.enemy.isAlive) this.callbacks.onEnemyDeath(hit.enemy);
              completed++;
              if (completed === hits.length) {
                this.callbacks.onAnimationEnd();
                messageLog.add(`Rajada de Pacotes: ${hits.length} alvo(s) atingido(s).`);
                this.callbacks.endTurn();
              }
            },
          });
        }
        return;
      }
      case 'defense_buff':
        player.defenseBuffRemaining = ability.duration ?? 3;
        messageLog.add(`Criptografia Total: dano reduzido 50% por ${player.defenseBuffRemaining} turnos.`);
        break;
      case 'aoe_damage': {
        const aoeRange = player.overflowRange;
        let totalDmg = 0;
        let hitCount = 0;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          const dx = Math.abs(player.x - e.x);
          const dy = Math.abs(player.y - e.y);
          if (Math.max(dx, dy) > aoeRange) continue;
          const dmg = e.takeDamage(ability.damage ?? 8);
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
        break;
      }
      case 'dot': {
        const DOT_RANGE = 3;
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
          messageLog.add(`Vazamento: ${dmg} de dano.`);
          this.callbacks.spawnParticles(target.x, target.y, 0x66ff66, 4);
          sound.play('enemy_hit');
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
          messageLog.add('Nenhum inimigo alcancavel.');
        }
        break;
      }
    }

    this.callbacks.endTurn();
  }

  openChest(x: number, y: number) {
    const { player, messageLog, fov } = this.state;
    const ck = `${x},${y}`;
    if (!this.state.chests.has(ck) || this.state.chests.get(ck)) return;

    this.state.chests.set(ck, true);
    sound.play('chest_open');
    this.callbacks.spawnParticles(x, y, 0xffd700, 6);

    const rolled = rollRewards(player.acquiredUpgrades, player.freeSlots(), 3, this.state.classId);
    if (rolled.length === 0) {
      messageLog.add('Baú vazio.');
      return;
    }

    const upgOptions = rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
    const itemOptions = rolled.filter(r => r.kind === 'item').map(r => ALL_ITEMS.find(i => i.id === r.id)!).filter(Boolean);

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

    const upgOptions = rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
    const itemOptions = rolled.filter(r => r.kind === 'item').map(r => ALL_ITEMS.find(i => i.id === r.id)!).filter(Boolean);

    const mode = source === 'chest' ? 'reveal' : 'choice';

    this.scene.scene.pause();
    this.scene.scene.launch('Upgrade', {
      upgrades: upgOptions,
      items: itemOptions,
      acquired: player.acquiredUpgrades,
      mode,
      floor: player.floor,
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
    const upgOptions = rolled.filter(r => r.kind === 'upgrade').map(r => ALL_UPGRADES.find(u => u.id === r.id)!).filter(Boolean);
    if (upgOptions.length === 0) return;

    let remainingUpgs = [...upgOptions];
    let pickCount = 2;

    const showPick = () => {
      if (pickCount <= 0 || remainingUpgs.length === 0) return;
      this.scene.scene.pause();
      this.scene.scene.launch('Upgrade', {
        upgrades: remainingUpgs,
        items: [],
        acquired: player.acquiredUpgrades,
        mode: 'choice',
        pickCount,
        floor: player.floor,
        title: `RECOMPENSA DO BOSS (mais ${pickCount})`,
        onSelect: (kind: 'upgrade' | 'item', id: string) => {
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
          }
        },
      });
    };

    showPick();
  }

}
