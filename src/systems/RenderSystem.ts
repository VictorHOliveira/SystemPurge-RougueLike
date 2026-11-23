import Phaser from 'phaser';
import { GameState } from './GameState';
import { MAP_W, MAP_H, TILE, parseChestKey } from '../constants';
import { TileType } from '../data/tiles';
import { FONT } from '../theme';

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
  private lastHpById = new Map<string, { hp: number; maxHp: number; x: number; y: number }>();
  private lastEnemyState = new Map<string, { x: number; y: number; visible: boolean }>();

  tileRT!: Phaser.GameObjects.RenderTexture;
  private miniMapImg!: Phaser.GameObjects.Image;
  entitySprites = new Map<string, Phaser.GameObjects.Image>();
  enemyHpBars = new Map<string, Phaser.GameObjects.Graphics>();
  private bossAuras = new Map<string, Phaser.GameObjects.Image>();
  private bossLabels = new Map<string, Phaser.GameObjects.Text>();
  private floorTint!: Phaser.GameObjects.Rectangle;
  private damageVignette!: Phaser.GameObjects.Rectangle;
  private rangedTelegraph!: Phaser.GameObjects.Graphics;
  private enemyProjPool: Phaser.GameObjects.Image[] = [];
  private enemyProjIdx = 0;
  private bossFloorTheme = false;
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
    const mmCanvas = this.scene.textures.get('minimap') as Phaser.Textures.CanvasTexture;
    const mmCtx = mmCanvas.context;
    const w = MAP_W * 2;
    const h = MAP_H * 2;
    mmCtx.fillStyle = 'rgba(0,0,0,0.6)';
    mmCtx.fillRect(0, 0, w + 2, h + 2);
    mmCtx.strokeStyle = '#334455';
    mmCtx.lineWidth = 1;
    mmCtx.strokeRect(0.5, 0.5, w + 1, h + 1);
    mmCanvas.refresh();
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

    this.floorTint = this.scene.add.rectangle(320, 320, 640, 640, 0x5a1010, 0.16)
      .setScrollFactor(0)
      .setDepth(6)
      .setVisible(false);

    this.damageVignette = this.scene.add.rectangle(320, 320, 640, 640, 0xff0000, 0)
      .setScrollFactor(0)
      .setDepth(900);

    this.rangedTelegraph = this.scene.add.graphics().setDepth(7);
  }

  setBossFloorTheme(active: boolean) {
    this.bossFloorTheme = active;
    if (this.floorTint) this.floorTint.setVisible(active);
    this.markAllDirty();
  }

  createEnemySprites() {
    this.bossAuras.forEach(a => a.destroy());
    this.bossAuras.clear();
    this.bossLabels.forEach(l => l.destroy());
    this.bossLabels.clear();
    for (const e of this.state.enemies) {
      const spr = this.scene.add.image(0, 0, e.textureKey);
      spr.setOrigin(0.5, 0.5).setDepth(9);
      this.entitySprites.set(e.id, spr);
      if (e.textureKey === 'enemy_boss' && this.scene.textures.exists('fx_boss_aura')) {
        const aura = this.scene.add.image(0, 0, 'fx_boss_aura')
          .setDepth(8)
          .setAlpha(0.45)
          .setDisplaySize(TILE * 2.5, TILE * 2.5);
        this.bossAuras.set(e.id, aura);
      }
      if (e.textureKey === 'enemy_boss') {
        const label = this.scene.add.text(0, 0, 'BOSS', {
          fontFamily: FONT,
          fontSize: '10px',
          color: '#ff4444',
          fontStyle: 'bold',
        }).setOrigin(0.5, 1).setDepth(11).setShadow(0, 0, '#ff4444', 6, false, true);
        this.bossLabels.set(e.id, label);
      }
    }
  }

  destroyAll() {
    this.entitySprites.forEach(s => s.destroy());
    this.entitySprites.clear();
    this.bossAuras.forEach(s => s.destroy());
    this.bossAuras.clear();
    this.bossLabels.forEach(s => s.destroy());
    this.bossLabels.clear();
    if (this.floorTint) this.floorTint.destroy();
    if (this.damageVignette) this.damageVignette.destroy();
    if (this.rangedTelegraph) this.rangedTelegraph.destroy();
    this.enemyProjPool.forEach(s => s.destroy());
    this.enemyProjPool.length = 0;
    this.enemyProjIdx = 0;
    this.hpBarFreelist.forEach(s => s.destroy());
    this.hpBarFreelist.length = 0;
    this.enemyHpBars.forEach(s => s.destroy());
    this.enemyHpBars.clear();
    this.lastEnemyState.clear();
    this.lastHpById.clear();
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
    const { map, chests } = this.state;
    const mmTilesChanged = this.hasDirtyBounds;

    if (this.hasDirtyBounds) {
      for (let y = this.dirtyMinY; y <= this.dirtyMaxY; y++) {
        const row = this.dirtyTiles[y];
        if (!row) continue;
        for (let x = this.dirtyMinX; x <= this.dirtyMaxX; x++) {
          if (!row[x]) continue;
          row[x] = false;
          if (!map.explored[y]?.[x]) continue;
          const tile = map.tiles[y][x];
          const visible = map.visible[y][x];
          this.tileRT.draw(this.tileKey(tile, visible), x * TILE, y * TILE);
          if (visible && (tile === TileType.STAIRS_DOWN || tile === TileType.STAIRS_UP)
            && this.scene.textures.exists('fx_stairs_glow')) {
            this.tileRT.draw('fx_stairs_glow', x * TILE, y * TILE);
          }
        }
      }
      this.hasDirtyBounds = false;
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

    this.redrawMiniMap(mmTilesChanged);
  }

  private redrawMiniMap(mmTilesChanged: boolean) {
    const { map, chests, player, enemies } = this.state;

    const canvas = this.scene.textures.get('minimap') as Phaser.Textures.CanvasTexture;
    const ctx = canvas.context;
    const s = 2;

    if (mmTilesChanged) {
      for (let y = this.dirtyMinY; y <= this.dirtyMaxY; y++) {
        if (!map.explored[y]) continue;
        for (let x = this.dirtyMinX; x <= this.dirtyMaxX; x++) {
          if (!map.explored[y]?.[x]) continue;
          this.drawMiniMapTileAt(ctx, map, x, y, 1 + x * s, 1 + y * s);
        }
      }
    }

    const next: number[] = [];
    for (const [key, opened] of chests) {
      if (opened) continue;
      const [cx, cy] = parseChestKey(key);
      if (map.explored[cy]?.[cx]) next.push((cy << 16) | cx);
    }
    for (const e of enemies) {
      if (e.isAlive && map.visible[e.y]?.[e.x]) next.push((e.y << 16) | e.x);
    }
    next.push((player.y << 16) | player.x);

    if (!mmTilesChanged && this.stampSetsEqual(this.mmPrevEntityPositions, next)) return;

    const playerKey = next[next.length - 1];
    for (const packed of this.mmPrevEntityPositions) {
      const ex = packed & 0xFFFF;
      const ey = packed >>> 16;
      if (map.explored[ey]?.[ex]) this.drawMiniMapTileAt(ctx, map, ex, ey, 1 + ex * s, 1 + ey * s);
    }

    for (const packed of next) {
      const px = 1 + (packed & 0xFFFF) * s;
      const py = 1 + (packed >>> 16) * s;
      let color: string;
      if (packed === playerKey) {
        color = '#00ff88';
      } else if (enemies.some(e => e.isAlive && map.visible[e.y]?.[e.x] && (e.y << 16 | e.x) === packed)) {
        color = '#ff4444';
      } else {
        color = '#ffd700';
      }
      ctx.fillRect(px, py, s, s);
    }

    this.mmPrevEntityPositions = next;
    canvas.refresh();
  }

  private stampSetsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private drawMiniMapTileAt(ctx: CanvasRenderingContext2D, map: any, x: number, y: number, px: number, py: number) {
    const vis = map.visible[y][x];
    const t = map.tiles[y][x];
    ctx.clearRect(px, py, 2, 2);
    if (t === TileType.WALL) {
      ctx.fillStyle = this.bossFloorTheme
        ? (vis ? '#775566' : '#3a2a38')
        : (vis ? '#556677' : '#2a3a4a');
    } else {
      ctx.fillStyle = this.bossFloorTheme
        ? (vis ? '#4a2838' : '#2a1a26')
        : (vis ? '#224466' : '#141e2e');
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
    this.lastHpById.delete(enemyId);
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
      const px = player.x * TILE + TILE / 2;
      const py = player.y * TILE + TILE / 2;
      if (pSpr.x !== px || pSpr.y !== py) pSpr.setPosition(px, py);
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
        this.lastEnemyState.delete(enemy.id);
        if (spr) { spr.destroy(); this.entitySprites.delete(enemy.id); }
        const aura = this.bossAuras.get(enemy.id);
        if (aura) { aura.destroy(); this.bossAuras.delete(enemy.id); }
        const label = this.bossLabels.get(enemy.id);
        if (label) { label.destroy(); this.bossLabels.delete(enemy.id); }
        continue;
      }

      const visible = !!map.visible[enemy.y]?.[enemy.x];
      const last = this.lastEnemyState.get(enemy.id);
      const px = enemy.x * TILE + TILE / 2;
      const py = enemy.y * TILE + TILE / 2;
      if (!last || last.x !== px || last.y !== py || last.visible !== visible) {
        spr.setPosition(px, py);
        spr.setVisible(visible);
        const aura = this.bossAuras.get(enemy.id);
        if (aura) {
          aura.setPosition(px, py);
          aura.setVisible(visible);
        }
        const label = this.bossLabels.get(enemy.id);
        if (label) {
          label.setPosition(px, py - TILE / 2 - 2);
          label.setVisible(visible);
        }
        this.lastEnemyState.set(enemy.id, { x: px, y: py, visible });
      }

      if (!visible) {
        this.recycleHpBar(enemy.id);
        continue;
      }

      let hpBar = this.enemyHpBars.get(enemy.id);
      const cached = this.lastHpById.get(enemy.id);
      if (!cached || cached.hp !== enemy.hp || cached.maxHp !== enemy.maxHp || cached.x !== enemy.x || cached.y !== enemy.y) {
        if (!hpBar) {
          hpBar = this.allocateHpBar();
          this.enemyHpBars.set(enemy.id, hpBar);
        }
        hpBar.clear();
        this.drawHpBar(enemy, hpBar);
        this.lastHpById.set(enemy.id, { hp: enemy.hp, maxHp: enemy.maxHp, x: enemy.x, y: enemy.y });
      }
    }

    this.drawRangedTelegraphs();
  }

  private drawRangedTelegraphs(): void {
    if (!this.rangedTelegraph) return;
    const { map, enemies } = this.state;
    const g = this.rangedTelegraph;
    g.clear();
    for (const e of enemies) {
      if (!e.isAlive || e.behavior !== 'ranged') continue;
      if (!map.visible[e.y]?.[e.x]) continue;
      const cx = e.x * TILE + TILE / 2;
      const cy = e.y * TILE + TILE / 2;
      g.lineStyle(1, 0xff8800, 0.3);
      g.strokeCircle(cx, cy, e.rangedRange * TILE);
      g.lineStyle(1, 0xffaa44, 0.12);
      g.fillStyle(0xff8800, 0.05);
      g.fillCircle(cx, cy, e.rangedRange * TILE);
    }
  }

  removeEnemySprite(enemyId: string) {
    const spr = this.entitySprites.get(enemyId);
    if (spr) { spr.destroy(); this.entitySprites.delete(enemyId); }
    const aura = this.bossAuras.get(enemyId);
    if (aura) { aura.destroy(); this.bossAuras.delete(enemyId); }
    const label = this.bossLabels.get(enemyId);
    if (label) { label.destroy(); this.bossLabels.delete(enemyId); }
    this.lastEnemyState.delete(enemyId);
    this.recycleHpBar(enemyId);
  }

  centerOnPlayer() {
    const { player } = this.state;
    this.scene.cameras.main.centerOn(
      player.x * TILE + TILE / 2,
      player.y * TILE + TILE / 2,
    );
  }

  flashDamage(): void {
    if (!this.damageVignette) return;
    this.scene.tweens.killTweensOf(this.damageVignette);
    this.damageVignette.setAlpha(0.32);
    this.scene.tweens.add({
      targets: this.damageVignette,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
    });
    this.scene.cameras.main.shake(90, 0.004);
  }

  spawnEnemyProjectile(fromX: number, fromY: number, toX: number, toY: number): void {
    if (!this.scene.textures.exists('projectile_player')) return;
    let proj = this.enemyProjPool[this.enemyProjIdx];
    if (!proj) {
      proj = this.scene.add.image(0, 0, 'projectile_player').setOrigin(0.5, 0.5).setDepth(16);
      this.enemyProjPool.push(proj);
    }
    this.enemyProjIdx++;
    this.scene.tweens.killTweensOf(proj);
    proj.setTexture('projectile_player')
      .setTint(0xff5533)
      .setVisible(true)
      .setAlpha(1)
      .setPosition(fromX * TILE + TILE / 2, fromY * TILE + TILE / 2);
    this.scene.tweens.add({
      targets: proj,
      x: toX * TILE + TILE / 2,
      y: toY * TILE + TILE / 2,
      duration: 140,
      ease: 'Linear',
      onComplete: () => {
        proj.setVisible(false);
        this.spawnFx(toX, toY, 'fx_impact', TILE, 250);
      },
    });
  }

  spawnParticles(x: number, y: number, tint: number, count: number = 6) {
    if (!this.particleEmitter) return;
    const px = x * TILE + TILE / 2;
    const py = y * TILE + TILE / 2;
    this.particleEmitter.setPosition(px, py);
    this.particleEmitter.setParticleTint(tint);
    this.particleEmitter.explode(count);
  }

  spawnFx(x: number, y: number, key: string, size: number = TILE, duration: number = 300) {
    if (!this.scene.textures.exists(key)) return;
    const img = this.scene.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, key)
      .setDepth(12)
      .setDisplaySize(size, size);
    const sx = img.scaleX;
    const sy = img.scaleY;
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      scaleX: sx * 1.4,
      scaleY: sy * 1.4,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => img.destroy(),
    });
  }

}
