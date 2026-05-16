import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    this.generateTiles();
    this.generateEntities();
    this.scene.start('Game');
  }

  private rectTile(key: string, outer: number, inner: number) {
    const g = this.add.graphics();
    g.fillStyle(outer);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(inner);
    g.fillRect(2, 2, 28, 28);
    g.lineStyle(1, 0x334466, 0.3);
    g.strokeRect(4, 4, 24, 24);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private gridTile(key: string, bg: number, dot: number) {
    const g = this.add.graphics();
    g.fillStyle(bg);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(dot);
    g.fillRect(0, 0, 1, 1);
    g.fillRect(31, 0, 1, 1);
    g.fillRect(0, 31, 1, 1);
    g.fillRect(31, 31, 1, 1);
    g.lineStyle(1, dot, 0.15);
    g.lineBetween(16, 0, 16, 32);
    g.lineBetween(0, 16, 32, 16);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private stairsTile(key: string, bg: number, accent: number) {
    const g = this.add.graphics();
    g.fillStyle(bg);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(accent);
    g.fillRect(8, 6, 16, 4);
    g.fillRect(10, 12, 12, 4);
    g.fillRect(12, 18, 8, 4);
    g.fillRect(14, 24, 4, 4);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private stairsUpTile(key: string, bg: number, accent: number) {
    const g = this.add.graphics();
    g.fillStyle(bg);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(accent);
    g.fillRect(14, 4, 4, 6);
    g.fillRect(12, 10, 8, 4);
    g.fillRect(10, 16, 12, 4);
    g.fillRect(8, 22, 16, 4);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private entityCircle(key: string, color: number, core: number) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3);
    g.fillCircle(16, 16, 15);
    g.fillStyle(color);
    g.fillCircle(16, 16, 11);
    g.fillStyle(core);
    g.fillCircle(16, 16, 5);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private bossCircle(key: string, color: number, core: number) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.5);
    g.fillCircle(16, 16, 15);
    g.fillStyle(color);
    g.fillCircle(16, 16, 12);
    g.lineStyle(2, 0xffdd00);
    g.strokeCircle(16, 16, 10);
    g.fillStyle(core);
    g.fillCircle(16, 16, 5);
    g.lineStyle(1, 0xffffff, 0.4);
    g.strokeCircle(16, 16, 14);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private chestTile(key: string, body: number, lid: number, lock: number) {
    const g = this.add.graphics();
    g.fillStyle(body);
    g.fillRect(4, 10, 24, 18);
    g.fillStyle(lid);
    g.fillRect(2, 4, 28, 8);
    g.fillStyle(lock);
    g.fillRect(13, 14, 6, 4);
    g.lineStyle(1, 0x000000, 0.3);
    g.strokeRect(4, 10, 24, 18);
    g.strokeRect(2, 4, 28, 8);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private chestOpenedTile(key: string, body: number, interior: number, lid: number) {
    const g = this.add.graphics();
    g.fillStyle(body);
    g.fillRect(4, 12, 24, 16);
    g.fillStyle(interior);
    g.fillRect(6, 14, 20, 10);
    g.fillStyle(lid);
    g.fillRect(2, 0, 28, 7);
    g.lineStyle(1, 0x000000, 0.3);
    g.strokeRect(4, 12, 24, 16);
    g.strokeRect(2, 0, 28, 7);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }

  private generateTiles() {
    this.rectTile('tile_wall', 0x1a1b2f, 0x252848);
    this.rectTile('tile_wall_dim', 0x0d0e17, 0x111322);
    this.gridTile('tile_floor', 0x0a1220, 0x12243a);
    this.gridTile('tile_floor_dim', 0x050810, 0x0a1220);
    this.stairsTile('tile_stairs', 0x0a1220, 0xffd700);
    this.stairsTile('tile_stairs_dim', 0x050810, 0x665500);
    this.stairsUpTile('tile_stairs_up', 0x0a1220, 0x00ddff);
    this.stairsUpTile('tile_stairs_up_dim', 0x050810, 0x006688);
    this.chestTile('tile_chest', 0x5c3a1e, 0x8b5e3c, 0xffd700);
    this.chestTile('tile_chest_dim', 0x2e1d0f, 0x3a2513, 0x665500);
    this.chestOpenedTile('tile_chest_opened', 0x5c3a1e, 0x2a1505, 0x8b5e3c);
    this.chestOpenedTile('tile_chest_opened_dim', 0x2e1d0f, 0x150a02, 0x3a2513);
  }

  private generateEntities() {
    this.entityCircle('entity_player', 0x00ff88, 0x33ffaa);
    this.entityCircle('enemy_trojan', 0xff3355, 0xff6688);
    this.entityCircle('enemy_worm', 0xff8800, 0xffaa33);
    this.entityCircle('enemy_spyware', 0xaa44ff, 0xcc77ff);
    this.bossCircle('enemy_boss', 0xff0044, 0xff3377);
    this.projectileSprite('projectile_player', 0x44ffaa, 0xffffff);
  }

  private projectileSprite(key: string, color: number, core: number) {
    const g = this.add.graphics();
    g.fillStyle(color);
    g.fillCircle(16, 16, 4);
    g.fillStyle(core);
    g.fillCircle(16, 16, 2);
    g.generateTexture(key, 32, 32);
    g.destroy();
  }
}
