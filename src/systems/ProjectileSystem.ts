import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H, TILE } from '../constants';
import { TileType } from '../data/tiles';
import { Enemy } from '../entities/Enemy';
import { Entity } from '../entities/Entity';
import { sound } from '../audio/SoundManager';

export interface ProjectileCallbacks {
  meleeAttack: (attacker: Entity, defender: Entity, isProjectile?: boolean) => void;
  onAnimationStart: () => void;
  onAnimationEnd: () => void;
}

export class ProjectileSystem {
  private scene: Phaser.Scene;
  private state: GameState;
  private callbacks: ProjectileCallbacks;

  private enemyGrid: (Enemy | null)[][] = [];
  private isDaemon: boolean = false;

  constructor(scene: Phaser.Scene, state: GameState, callbacks: ProjectileCallbacks) {
    this.scene = scene;
    this.state = state;
    this.callbacks = callbacks;
  }

  rebuildEnemyGrid() {
    const { enemies } = this.state;
    this.isDaemon = this.state.classId === 'daemon';
    this.enemyGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
    for (const e of enemies) {
      if (e.isAlive) this.enemyGrid[e.y][e.x] = e;
    }
  }

  private enemyAt(x: number, y: number): Enemy | null {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return null;
    return this.enemyGrid[y]?.[x] ?? null;
  }

  get projectileTexture(): string {
    return this.isDaemon ? 'projectile_daemon' : 'projectile_player';
  }

  getDirEnemy(dx: number, dy: number): { x: number; y: number; enemy: Enemy | null } {
    const { map, player } = this.state;
    const range = Math.ceil(player.effectiveFov);
    for (let i = 1; i <= range; i++) {
      const tx = player.x + dx * i;
      const ty = player.y + dy * i;
      if (!map.isInBounds(tx, ty)) return { x: tx - dx, y: ty - dy, enemy: null };
      if (map.tiles[ty][tx] === TileType.WALL) return { x: tx - dx, y: ty - dy, enemy: null };
      const enemy = this.enemyAt(tx, ty);
      if (enemy?.isAlive) return { x: tx, y: ty, enemy };
    }
    return { x: player.x + dx * range, y: player.y + dy * range, enemy: null };
  }

  fireProjectile(dx: number, dy: number) {
    const { map, player, messageLog } = this.state;

    const pierce = player.classDef.projectilesPierce;
    const range = Math.ceil(player.effectiveFov);

    if (pierce) {
      const enemiesHit: Enemy[] = [];
      let endX = player.x;
      let endY = player.y;
      for (let i = 1; i <= range; i++) {
        const tx = player.x + dx * i;
        const ty = player.y + dy * i;
        if (!map.isInBounds(tx, ty)) break;
        if (map.tiles[ty][tx] === TileType.WALL) break;
        endX = tx;
        endY = ty;
        const enemy = this.enemyAt(tx, ty);
        if (enemy?.isAlive) enemiesHit.push(enemy);
      }
      if (endX === player.x && endY === player.y) return;

      sound.play('projectile');
      this.callbacks.onAnimationStart();
      const proj = this.scene.add.image(
        player.x * TILE + TILE / 2,
        player.y * TILE + TILE / 2,
        this.projectileTexture,
      ).setOrigin(0.5, 0.5).setDepth(15);

      this.scene.tweens.add({
        targets: proj,
        x: endX * TILE + TILE / 2,
        y: endY * TILE + TILE / 2,
        duration: 80,
        ease: 'Linear',
        onComplete: () => {
          proj.destroy();
          for (const enemy of enemiesHit) {
            this.callbacks.meleeAttack(player, enemy, true);
          }
          if (enemiesHit.length === 0) messageLog.add('Projétil perfurante — nenhum alvo.');
          this.callbacks.onAnimationEnd();
        },
      });
      return;
    }

    const target = this.getDirEnemy(dx, dy);
    if (target.x === player.x && target.y === player.y) return;

    sound.play('projectile');
    this.callbacks.onAnimationStart();
    const proj = this.scene.add.image(
      player.x * TILE + TILE / 2,
      player.y * TILE + TILE / 2,
      this.projectileTexture,
    ).setOrigin(0.5, 0.5).setDepth(15);

    this.scene.tweens.add({
      targets: proj,
      x: target.x * TILE + TILE / 2,
      y: target.y * TILE + TILE / 2,
      duration: 80,
      ease: 'Linear',
      onComplete: () => {
        proj.destroy();
        if (target.enemy) {
          this.callbacks.meleeAttack(player, target.enemy, true);
        } else {
          messageLog.add('Projétil acertou a parede.');
        }
        this.callbacks.onAnimationEnd();
      },
    });
  }
}
