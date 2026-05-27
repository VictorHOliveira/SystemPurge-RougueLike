import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H, TILE, parseChestKey } from '../constants';
import { TileType } from '../data/tiles';

export class RenderSystem {
  private scene: Phaser.Scene;
  private state: GameState;
  private dirtyTiles: boolean[][] = [];
  private dirtyMinX = 0;
  private dirtyMaxX = 0;
  private dirtyMinY = 0;
  private dirtyMaxY = 0;
  private hasDirtyBounds = false;
  private mmPrevEntityPositions: number[] = [];

  tileRT!: Phaser.GameObjects.RenderTexture;
  private miniMapImg!: Phaser.GameObjects.Image;
  entitySprites = new Map<string, Phaser.GameObjects.Image>();
  enemyHpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private hpBarFreelist: Phaser.GameObjects.Graphics[] = [];

  private particleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, state: GameState) {
    this.scene = scene;
    this.state = state;
  }

  private initDirtyGrid() {
    this.dirtyTiles = [];
    this.hasDirtyBounds = false;
    for (let y = 0; y < MAP_H; y++) {
      this.dirtyTiles[y] = [];
      for (let x = 0; x < MAP_W; x++) {
        this.dirtyTiles[y][x] = true;
      }
    }
  }

  markAllDirty() {
    this.dirtyMinX = 0;
    this.dirtyMaxX = MAP_W - 1;
    this.dirtyMinY = 0;
    this.dirtyMaxY = MAP_H - 1;
    this.hasDirtyBounds = true;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++)
        this.dirtyTiles[y][x] = true;
  }

  markDirty(x: number, y: number) {
    if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
      this.dirtyTiles[y][x] = true;
      if (this.hasDirtyBounds) {
        if (x < this.dirtyMinX) this.dirtyMinX = x;
        if (x > this.dirtyMaxX) this.dirtyMaxX = x;
        if (y < this.dirtyMinY) this.dirtyMinY = y;
        if (y > this.dirtyMaxY) this.dirtyMaxY = y;
      } else {
        this.dirtyMinX = this.dirtyMaxX = x;
        this.dirtyMinY = this.dirtyMaxY = y;
        this.hasDirtyBounds = true;
      }
    }
  }

  onTileVisibilityChange(x: number, y: number) {
    this.markDirty(x, y);
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
    this.hpBarFreelist.forEach(s => s.destroy());
    this.hpBarFreelist.length = 0;
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
      case TileType.TRAP: return isVisible ? 'tile_floor' : 'tile_floor_dim';
      case TileType.BURNED: return isVisible ? 'tile_trap' : 'tile_trap_dim';
      case TileType.ALTAR: return isVisible ? 'tile_altar' : 'tile_altar_dim';
      default: return isVisible ? 'tile_floor' : 'tile_floor_dim';
    }
  }

  redrawMap() {
    const { map, chests, player, enemies } = this.state;

    const mmBounds = this.hasDirtyBounds;
    const mmMinX = this.dirtyMinX, mmMaxX = this.dirtyMaxX;
    const mmMinY = this.dirtyMinY, mmMaxY = this.dirtyMaxY;

    if (this.hasDirtyBounds) {
      for (let y = this.dirtyMinY; y <= this.dirtyMaxY; y++) {
        const row = this.dirtyTiles[y];
        if (!row) continue;
        for (let x = this.dirtyMinX; x <= this.dirtyMaxX; x++) {
          if (!row[x]) continue;
          row[x] = false;
          if (!map.explored[y]?.[x]) continue;
          this.tileRT.draw(this.tileKey(map.tiles[y][x], map.visible[y][x]), x * TILE, y * TILE);
        }
      }
      this.hasDirtyBounds = false;
    } else {
      for (let y = 0; y < map.height; y++) {
        const row = this.dirtyTiles[y];
        for (let x = 0; x < map.width; x++) {
          if (!row[x]) continue;
          row[x] = false;
          if (!map.explored[y]?.[x]) continue;
          this.tileRT.draw(this.tileKey(map.tiles[y][x], map.visible[y][x]), x * TILE, y * TILE);
        }
      }
    }

    for (const [key, opened] of chests) {
      const [cx, cy] = parseChestKey(key);
      if (!map.explored[cy]?.[cx]) continue;
      const vis = map.visible[cy]?.[cx] ?? false;
      const tex = opened
        ? (vis ? 'tile_chest_opened' : 'tile_chest_opened_dim')
        : (vis ? 'tile_chest' : 'tile_chest_dim');
      this.tileRT.draw(tex, cx * TILE, cy * TILE);
    }

    const canvas = this.scene.textures.get('minimap') as Phaser.Textures.CanvasTexture;
    const ctx = canvas.context;
    const s = 2;

    if (mmBounds) {
      for (let y = mmMinY; y <= mmMaxY; y++) {
        for (let x = mmMinX; x <= mmMaxX; x++) {
          if (!map.explored[y]?.[x]) continue;
          this.drawMiniMapTileAt(ctx, map, x, y, 1 + x * s, 1 + y * s);
        }
      }
    } else {
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
          this.drawMiniMapTileAt(ctx, map, x, y, 1 + x * s, 1 + y * s);
        }
      }
    }

    for (let i = 0; i < this.mmPrevEntityPositions.length; i++) {
      const packed = this.mmPrevEntityPositions[i];
      const ex = packed & 0xFFFF;
      const ey = packed >>> 16;
      if (map.explored[ey]?.[ex]) {
        this.drawMiniMapTileAt(ctx, map, ex, ey, 1 + ex * s, 1 + ey * s);
      }
    }
    this.mmPrevEntityPositions.length = 0;

    for (const [key, opened] of chests) {
      const [cx, cy] = parseChestKey(key);
      if (!opened && map.explored[cy]?.[cx]) {
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(1 + cx * s, 1 + cy * s, s, s);
        this.mmPrevEntityPositions.push((cy << 16) | cx);
      }
    }

    for (const e of enemies) {
      if (!e.isAlive || !map.visible[e.y]?.[e.x]) continue;
      ctx.fillStyle = '#ff4444';
      ctx.fillRect(1 + e.x * s, 1 + e.y * s, s, s);
      this.mmPrevEntityPositions.push((e.y << 16) | e.x);
    }

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(1 + player.x * s, 1 + player.y * s, s, s);
    this.mmPrevEntityPositions.push((player.y << 16) | player.x);

    canvas.refresh();
  }

  private drawMiniMapTileAt(ctx: CanvasRenderingContext2D, map: any, x: number, y: number, px: number, py: number) {
    const vis = map.visible[y][x];
    const t = map.tiles[y][x];
    ctx.clearRect(px, py, 2, 2);
    if (t === TileType.WALL) {
      ctx.fillStyle = vis ? '#556677' : '#2a3a4a';
    } else {
      ctx.fillStyle = vis ? '#224466' : '#141e2e';
    }
    ctx.fillRect(px, py, 2, 2);
    if (t === TileType.STAIRS_DOWN || t === TileType.STAIRS_UP) {
      ctx.fillStyle = t === TileType.STAIRS_DOWN ? '#44ddbb' : '#88ddff';
      ctx.fillRect(px, py, 2, 2);
    } else if (t === TileType.BURNED) {
      ctx.fillStyle = '#ff6644';
      ctx.fillRect(px, py, 2, 2);
    } else if (t === TileType.ALTAR) {
      ctx.fillStyle = '#cc66ff';
      ctx.fillRect(px, py, 2, 2);
    }
  }

  private allocateHpBar(): Phaser.GameObjects.Graphics {
    if (this.hpBarFreelist.length > 0) {
      const bar = this.hpBarFreelist.pop()!;
      bar.clear();
      bar.setVisible(true);
      return bar;
    }
    const bar = this.scene.add.graphics();
    bar.setDepth(20);
    return bar;
  }

  private recycleHpBar(enemyId: string): void {
    const bar = this.enemyHpBars.get(enemyId);
    if (bar) {
      bar.clear();
      bar.setVisible(false);
      this.hpBarFreelist.push(bar);
    }
    this.enemyHpBars.delete(enemyId);
  }

  private drawHpBar(enemy: { hp: number; maxHp: number; x: number; y: number }, hpBar: Phaser.GameObjects.Graphics) {
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
  }

  syncEntitySprites() {
    const { map, player, enemies } = this.state;

    const pSpr = this.entitySprites.get('player');
    if (pSpr) {
      pSpr.setPosition(player.x * TILE + TILE / 2, player.y * TILE + TILE / 2);
      pSpr.setVisible(player.isAlive);
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      let spr = this.entitySprites.get(enemy.id);
      if (!spr) {
        spr = this.scene.add.image(0, 0, enemy.textureKey);
        spr.setOrigin(0.5, 0.5).setDepth(9);
        this.entitySprites.set(enemy.id, spr);
      }

      if (!enemy.isAlive) {
        this.recycleHpBar(enemy.id);
        if (spr) { spr.destroy(); this.entitySprites.delete(enemy.id); }
        continue;
      }

      if (!map.visible[enemy.y]?.[enemy.x]) {
        spr.setVisible(false);
        this.recycleHpBar(enemy.id);
        continue;
      }

      spr.setPosition(enemy.x * TILE + TILE / 2, enemy.y * TILE + TILE / 2);
      spr.setVisible(true);

      let hpBar = this.enemyHpBars.get(enemy.id);
      if (!hpBar) {
        hpBar = this.allocateHpBar();
        this.enemyHpBars.set(enemy.id, hpBar);
      }
      hpBar.clear();
      this.drawHpBar(enemy, hpBar);
    }
  }

  removeEnemySprite(enemyId: string) {
    const spr = this.entitySprites.get(enemyId);
    if (spr) { spr.destroy(); this.entitySprites.delete(enemyId); }
    this.recycleHpBar(enemyId);
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


}
