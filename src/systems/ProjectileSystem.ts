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
  private gridOccupied: number[] = [];

  private projPool: Phaser.GameObjects.Image[] = [];
  private projPoolIdx = 0;

  constructor(scene: Phaser.Scene, state: GameState, callbacks: ProjectileCallbacks) {
    this.scene = scene;
    this.state = state;
    this.callbacks = callbacks;

    this.enemyGrid = Array.from({ length: MAP_H }, () => Array(MAP_W).fill(null));
  }

  private getProjImage(): Phaser.GameObjects.Image {
    if (this.projPoolIdx < this.projPool.length) {
      const p = this.projPool[this.projPoolIdx++];
      p.setVisible(true).setAlpha(1).setScale(1);
      this.scene.tweens.killTweensOf(p);
      return p;
    }
    const p = this.scene.add.image(0, 0, this.projectileTexture)
      .setOrigin(0.5, 0.5).setDepth(15);
    this.projPool.push(p);
    this.projPoolIdx++;
    return p;
  }

  rebuildEnemyGrid() {
    const { enemies } = this.state;
    this.isDaemon = this.state.classId === 'daemon';
    this.updateProjectileTexture();
    for (const packed of this.gridOccupied) {
      const x = packed & 0xFFFF;
      const y = packed >>> 16;
      this.enemyGrid[y][x] = null;
    }
    this.gridOccupied.length = 0;
    for (const e of enemies) {
      if (e.isAlive) {
        this.enemyGrid[e.y][e.x] = e;
        this.gridOccupied.push((e.y << 16) | e.x);
      }
    }
  }

  enemyAt(x: number, y: number): Enemy | null {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return null;
    return this.enemyGrid[y]?.[x] ?? null;
  }

  private _projTexture: string = 'projectile_player';

  private updateProjectileTexture() {
    this._projTexture = this.isDaemon ? 'projectile_daemon' : 'projectile_player';
  }

  get projectileTexture(): string {
    return this._projTexture;
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
    this.projPoolIdx = 0;
    const { map, player, messageLog } = this.state;

    const pierce = player.classDef.projectilesPierce;
    const range = Math.ceil(player.effectiveFov);

    const proj = this.getProjImage();
    proj.setTexture(this.projectileTexture);

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
      if (endX === player.x && endY === player.y) {
        proj.setVisible(false);
        return;
      }

      sound.play('projectile');
      this.callbacks.onAnimationStart();
      proj.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);

      this.scene.tweens.add({
        targets: proj,
        x: endX * TILE + TILE / 2,
        y: endY * TILE + TILE / 2,
        duration: 80,
        ease: 'Linear',
        onComplete: () => {
          proj.setVisible(false);
          for (const enemy of enemiesHit) {
            this.callbacks.meleeAttack(player, enemy, true);
          }
          this.callbacks.onAnimationEnd();
        },
      });
      return;
    }

    const target = this.getDirEnemy(dx, dy);
    if (target.x === player.x && target.y === player.y) {
      proj.setVisible(false);
      return;
    }

    sound.play('projectile');
    this.callbacks.onAnimationStart();
    proj.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);

    this.scene.tweens.add({
      targets: proj,
      x: target.x * TILE + TILE / 2,
      y: target.y * TILE + TILE / 2,
      duration: 80,
      ease: 'Linear',
      onComplete: () => {
        proj.setVisible(false);
        if (target.enemy) {
          this.callbacks.meleeAttack(player, target.enemy, true);
        }
        this.callbacks.onAnimationEnd();
      },
    });
  }
}
