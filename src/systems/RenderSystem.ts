import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H, TILE } from '../constants';
import { TileType } from '../data/tiles';

export class RenderSystem {
  private scene: Phaser.Scene;
  private state: GameState;
  private dirtyTiles: boolean[][] = [];
  private prevVisible: boolean[][] = [];
  private miniMapDirty = true;

  tileRT!: Phaser.GameObjects.RenderTexture;
  private miniMapImg!: Phaser.GameObjects.Image;
  entitySprites = new Map<string, Phaser.GameObjects.Image>();
  enemyHpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene;
    this.state = state;
  }

  private initDirtyGrid() {
    this.dirtyTiles = [];
    this.prevVisible = [];
    this.miniMapDirty = true;
    for (let y = 0; y < MAP_H; y++) {
      this.dirtyTiles[y] = [];
      this.prevVisible[y] = [];
      for (let x = 0; x < MAP_W; x++) {
        this.dirtyTiles[y][x] = true;
        this.prevVisible[y][x] = false;
      }
    }
  }

  markAllDirty() {
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        this.dirtyTiles[y][x] = true;
    this.miniMapDirty = true;
  }

  markDirty(x: number, y: number) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)
      this.dirtyTiles[y][x] = true;
  }

  syncVisibility() {
    const { map } = this.state;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.explored[y][x] && map.visible[y][x] !== this.prevVisible[y][x]) {
          this.dirtyTiles[y][x] = true;
          this.prevVisible[y][x] = map.visible[y][x];
          this.miniMapDirty = true;
        }
      }
    }
  }

  createRenderObjects(playerTextureKey: string) {
    this.initDirtyGrid();

    this.tileRT = this.scene.add.renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.tileRT.setOrigin(0, 0);
    this.tileRT.setDepth(0);

    const miniW = MAP_W * 2 + 2;
    const miniH = MAP_H * 2 + 2;
    if (this.scene.textures.exists('minimap')) this.scene.textures.remove('minimap');
    this.scene.textures.createCanvas('minimap', miniW, miniH);
    this.miniMapImg = this.scene.add.image(3, 555, 'minimap').setOrigin(0, 0).setScrollFactor(0).setDepth(50);

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
    if (this.miniMapImg) this.miniMapImg.destroy();
    if (this.scene.textures.exists('minimap')) this.scene.textures.remove('minimap');
    if (this.particleEmitter) this.particleEmitter.destroy();
  }

  private tileKey(type: TileType, isVisible: boolean): string {
    switch (type) {
      case TileType.WALL: return isVisible ? 'tile_wall' : 'tile_wall_dim';
      case TileType.STAIRS_DOWN: return isVisible ? 'tile_stairs' : 'tile_stairs_dim';
      case TileType.STAIRS_UP: return isVisible ? 'tile_stairs_up' : 'tile_stairs_up_dim';
      case TileType.TRAP: return isVisible ? 'tile_trap' : 'tile_trap_dim';
      case TileType.ALTAR: return isVisible ? 'tile_altar' : 'tile_altar_dim';
      default: return isVisible ? 'tile_floor' : 'tile_floor_dim';
    }
  }

  redrawMap() {
    const { map, chests } = this.state;

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (!this.dirtyTiles[y][x]) continue;
        this.dirtyTiles[y][x] = false;
        if (!map.explored[y][x]) continue;

        const type = map.tiles[y][x];
        const isVisible = map.visible[y][x];
        this.tileRT.draw(this.tileKey(type, isVisible), x * TILE, y * TILE);
      }
    }

    for (const [key, opened] of chests) {
      const [cx, cy] = key.split(',').map(Number);
      if (!this.dirtyTiles[cy]?.[cx]) continue;
      this.dirtyTiles[cy][cx] = false;
      if (!map.explored[cy]?.[cx]) continue;
      const vis = map.visible[cy]?.[cx] ?? false;
      const tex = opened
        ? (vis ? 'tile_chest_opened' : 'tile_chest_opened_dim')
        : (vis ? 'tile_chest' : 'tile_chest_dim');
      this.tileRT.draw(tex, cx * TILE, cy * TILE);
    }

    if (this.miniMapDirty) {
      this.drawMiniMap();
      this.miniMapDirty = false;
    }
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

    for (const enemy of enemies) {
      if (!enemy.isAlive) this.removeEnemySprite(enemy.id);
    }
  }

  removeEnemySprite(enemyId: string) {
    const spr = this.entitySprites.get(enemyId);
    if (spr) { spr.destroy(); this.entitySprites.delete(enemyId); }
    const bar = this.enemyHpBars.get(enemyId);
    if (bar) { bar.destroy(); this.enemyHpBars.delete(enemyId); }
  }

  centerOnPlayer() {
    const { player } = this.state;
    this.scene.cameras.main.centerOn(
      player.x * TILE + TILE / 2,
      player.y * TILE + TILE / 2,
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
    const canvas = this.scene.textures.get('minimap') as Phaser.Textures.CanvasTexture;
    const ctx = canvas.context;
    const { map, player, enemies, chests } = this.state;

    const s = 2;
    const w = MAP_W * s;
    const h = MAP_H * s;

    ctx.clearRect(0, 0, w + 2, h + 2);

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w + 2, h + 2);
    ctx.strokeStyle = '#334455';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w + 1, h + 1);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!map.explored[y][x]) continue;
        const vis = map.visible[y][x];
        const t = map.tiles[y][x];
        const px = 1 + x * s;
        const py = 1 + y * s;

        if (t === TileType.WALL) {
          ctx.fillStyle = vis ? '#556677' : '#2a3a4a';
        } else {
          ctx.fillStyle = vis ? '#224466' : '#141e2e';
        }
        ctx.fillRect(px, py, s, s);

        if (t === TileType.STAIRS_DOWN || t === TileType.STAIRS_UP) {
          ctx.fillStyle = t === TileType.STAIRS_DOWN ? '#44ddbb' : '#88ddff';
          ctx.fillRect(px, py, s, s);
        } else if (t === TileType.TRAP) {
          ctx.fillStyle = '#ff6644';
          ctx.fillRect(px, py, s, s);
        } else if (t === TileType.ALTAR) {
          ctx.fillStyle = '#cc66ff';
          ctx.fillRect(px, py, s, s);
        }
      }
    }

    for (const [key, opened] of chests) {
      const [cx, cy] = key.split(',').map(Number);
      if (!opened && map.explored[cy]?.[cx]) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(1 + cx * s, 1 + cy * s, s, s);
      }
    }

    for (const e of enemies) {
      if (!e.isAlive || !map.visible[e.y]?.[e.x]) continue;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(1 + e.x * s, 1 + e.y * s, s, s);
    }

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(1 + player.x * s, 1 + player.y * s, s, s);

    canvas.refresh();
  }
}
