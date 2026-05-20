import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H, TILE } from '../constants';
import { TileType } from '../data/tiles';

export class RenderSystem {
  private scene: Phaser.Scene;
  private state: GameState;

  tileRT!: Phaser.GameObjects.RenderTexture;
  miniMap!: Phaser.GameObjects.Graphics;
  entitySprites = new Map<string, Phaser.GameObjects.Image>();
  enemyHpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene;
    this.state = state;
  }

  createRenderObjects(playerTextureKey: string) {
    this.tileRT = this.scene.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.tileRT.setOrigin(0, 0);
    this.tileRT.setDepth(0);

    this.miniMap = this.scene.add.graphics();
    this.miniMap.setScrollFactor(0);
    this.miniMap.setDepth(50);

    const playerSpr = this.scene.add.image(0, 0, playerTextureKey);
    playerSpr.setOrigin(0.5, 0.5).setDepth(10);
    this.entitySprites.set('player', playerSpr);

    this.particleEmitter = this.scene.add.particles(0, 0, 'particle', {
      speed: { min: 40, max: 120 },
      lifespan: 350,
      scale: { start: 0.8, end: 0 },
      emitting: false,
    });
    this.particleEmitter.setDepth(20);
  }

  createEnemySprites() {
    for (const e of this.state.enemies) {
      const spr = this.scene.add.image(0, 0, e.textureKey);
      spr.setOrigin(0.5, 0.5).setDepth(9);
      this.entitySprites.set(e.id, spr);
    }
  }

  destroyAll() {
    this.entitySprites.forEach(s => s.destroy());
    this.entitySprites.clear();
    this.enemyHpBars.forEach(s => s.destroy());
    this.enemyHpBars.clear();
    if (this.tileRT) this.tileRT.destroy();
    if (this.miniMap) this.miniMap.destroy();
    if (this.particleEmitter) this.particleEmitter.destroy();
  }

  redrawMap() {
    this.tileRT.clear();
    const { map, chests } = this.state;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!map.explored[y][x]) continue;

        const type = map.tiles[y][x];
        const isVisible = map.visible[y][x];

        let key: string;
        switch (type) {
          case TileType.WALL:
            key = isVisible ? 'tile_wall' : 'tile_wall_dim';
            break;
          case TileType.STAIRS_DOWN:
            key = isVisible ? 'tile_stairs' : 'tile_stairs_dim';
            break;
          case TileType.STAIRS_UP:
            key = isVisible ? 'tile_stairs_up' : 'tile_stairs_up_dim';
            break;
          case TileType.TRAP:
            key = isVisible ? 'tile_trap' : 'tile_trap_dim';
            break;
          case TileType.ALTAR:
            key = isVisible ? 'tile_altar' : 'tile_altar_dim';
            break;
          default:
            key = isVisible ? 'tile_floor' : 'tile_floor_dim';
            break;
        }

        this.tileRT.draw(key, x * TILE, y * TILE);
      }
    }

    for (const [key, opened] of chests) {
      const [cx, cy] = key.split(',').map(Number);
      if (!map.explored[cy]?.[cx]) continue;
      const vis = map.visible[cy]?.[cx] ?? false;
      const tex = opened
        ? (vis ? 'tile_chest_opened' : 'tile_chest_opened_dim')
        : (vis ? 'tile_chest' : 'tile_chest_dim');
      this.tileRT.draw(tex, cx * TILE, cy * TILE);
    }

    this.drawMiniMap();
  }

  syncEntitySprites() {
    const { map, player, enemies } = this.state;

    const pSpr = this.entitySprites.get('player');
    if (pSpr) {
      pSpr.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);
      pSpr.setVisible(player.isAlive);
    }

    const usedBars = new Set<string>();
    for (const enemy of enemies) {
      const spr = this.entitySprites.get(enemy.id);
      if (!spr) continue;

      if (enemy.isAlive && map.visible[enemy.y]?.[enemy.x]) {
        spr.setPosition(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2);
        spr.setVisible(true);

        let hpBar = this.enemyHpBars.get(enemy.id);
        if (!hpBar) {
          hpBar = this.scene.add.graphics();
          hpBar.setDepth(20);
          this.enemyHpBars.set(enemy.id, hpBar);
        }
        usedBars.add(enemy.id);
        hpBar.clear();
        hpBar.setVisible(true);

        const bx = enemy.x * TILE;
        const by = enemy.y * TILE - 6;
        const bw = TILE;
        const bh = 3;
        const pct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
        hpBar.fillStyle(0x000000, 0.6);
        hpBar.fillRect(bx, by, bw, bh);
        const barColor = pct > 0.6 ? 0x00ff88 : pct > 0.3 ? 0xffcc00 : 0xff4444;
        hpBar.fillStyle(barColor);
        if (pct > 0) hpBar.fillRect(bx + 1, by + 1, Math.floor((bw - 2) * Math.max(0.01, pct)), bh - 2);
      } else {
        spr.setVisible(false);
      }
    }

    for (const [id, bar] of this.enemyHpBars) {
      if (!usedBars.has(id)) bar.setVisible(false);
    }
  }

  centerOnPlayer() {
    const { player } = this.state;
    this.scene.cameras.main.pan(
      player.x * TILE + TILE / 2,
      player.y * TILE + TILE / 2,
      80,
      'Sine.easeInOut',
    );
  }

  spawnParticles(x: number, y: number, tint: number, count: number = 6) {
    if (!this.particleEmitter) return;
    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2;
    this.particleEmitter.setPosition(px, py);
    this.particleEmitter.setParticleTint(tint);
    this.particleEmitter.explode(count);
  }

  private drawMiniMap() {
    this.miniMap.clear();
    const { map, player, enemies, chests } = this.state;

    const mx = 4;
    const my = 556;
    const s = 2;
    const w = MAP_W * s;
    const h = MAP_H * s;

    this.miniMap.fillStyle(0x000000, 0.6);
    this.miniMap.fillRect(mx - 1, my - 1, w + 2, h + 2);
    this.miniMap.lineStyle(1, 0x334455);
    this.miniMap.strokeRect(mx - 1, my - 1, w + 2, h + 2);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!map.explored[y][x]) continue;
        const vis = map.visible[y][x];
        const wall = map.tiles[y][x] === TileType.WALL;
        if (wall) {
          this.miniMap.fillStyle(vis ? 0x556677 : 0x2a3a4a);
        } else {
          this.miniMap.fillStyle(vis ? 0x224466 : 0x141e2e);
        }
        this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
      }
    }

    for (const [key, opened] of chests) {
      const [cx, cy] = key.split(',').map(Number);
      if (!opened && map.explored[cy]?.[cx]) {
        this.miniMap.fillStyle(0xffd700);
        this.miniMap.fillRect(mx + cx * s, my + cy * s, s, s);
      }
    }

    for (const e of enemies) {
      if (!e.isAlive || !map.visible[e.y]?.[e.x]) continue;
      this.miniMap.fillStyle(0xff4444);
      this.miniMap.fillRect(mx + e.x * s, my + e.y * s, s, s);
    }

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!map.explored[y][x]) continue;
        const t = map.tiles[y][x];
        if (t === TileType.STAIRS_DOWN || t === TileType.STAIRS_UP) {
          this.miniMap.fillStyle(t === TileType.STAIRS_DOWN ? 0x44ddbb : 0x88ddff);
          this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
        } else if (t === TileType.TRAP) {
          this.miniMap.fillStyle(0xff6644);
          this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
        } else if (t === TileType.ALTAR) {
          this.miniMap.fillStyle(0xcc66ff);
          this.miniMap.fillRect(mx + x * s, my + y * s, s, s);
        }
      }
    }

    this.miniMap.fillStyle(0x00ff88);
    this.miniMap.fillRect(mx + player.x * s, my + player.y * s, s, s);
  }
}
