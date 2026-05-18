import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    this.load.image('tile_wall', 'sprites/tiles/tile_wall.png');
    this.load.image('tile_wall_dim', 'sprites/tiles/tile_wall_dim.png');
    this.load.image('tile_floor', 'sprites/tiles/tile_floor.png');
    this.load.image('tile_floor_dim', 'sprites/tiles/tile_floor_dim.png');
    this.load.image('tile_stairs', 'sprites/tiles/tile_stairs.png');
    this.load.image('tile_stairs_dim', 'sprites/tiles/tile_stairs_dim.png');
    this.load.image('tile_stairs_up', 'sprites/tiles/tile_stairs_up.png');
    this.load.image('tile_stairs_up_dim', 'sprites/tiles/tile_stairs_up_dim.png');
    this.load.image('entity_player', 'sprites/entities/entity_player.png');
    this.load.image('enemy_trojan', 'sprites/entities/enemy_trojan.png');
    this.load.image('enemy_worm', 'sprites/entities/enemy_worm.png');
    this.load.image('enemy_spyware', 'sprites/entities/enemy_spyware.png');
    this.load.image('enemy_boss', 'sprites/entities/enemy_boss.png');
    this.load.image('projectile_player', 'sprites/entities/projectile_player.png');
  }

  create() {
    this.generateTiles();
    this.scene.start('Game');
  }

  private generateTiles() {
    this.chestTile('tile_chest', 0x5c3a1e, 0x8b5e3c, 0xffd700);
    this.chestTile('tile_chest_dim', 0x2e1d0f, 0x3a2513, 0x665500);
    this.chestOpenedTile('tile_chest_opened', 0x5c3a1e, 0x2a1505, 0x8b5e3c);
    this.chestOpenedTile('tile_chest_opened_dim', 0x2e1d0f, 0x150a02, 0x3a2513);
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
}
