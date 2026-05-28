import Phaser from 'phaser';
import { version } from '../../package.json';
import { trackEvent } from '../analytics';
import { sound } from '../audio/SoundManager';

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
    this.load.image('enemy_trojan', 'sprites/entities/enemy_trojan.png');
    this.load.image('enemy_worm', 'sprites/entities/enemy_worm.png');
    this.load.image('enemy_spyware', 'sprites/entities/enemy_spyware.png');
    this.load.image('enemy_boss', 'sprites/entities/rootkit.exe.png');
    this.load.image('enemy_miniboss', 'sprites/entities/admin.exe.png');
    this.load.image('enemy_malware', 'sprites/entities/malware.bat.png');
    this.load.image('enemy_ransomware', 'sprites/entities/ransomware.exe.png');
    this.load.image('enemy_overflow', 'sprites/entities/overflow.dll.png');
    this.load.image('enemy_fragment', 'sprites/entities/fragment.png');
    this.load.image('projectile_player', 'sprites/entities/projectile_player.png');
    this.load.image('class_limpador', 'sprites/classes/class_limpador.png');
    this.load.image('class_ping', 'sprites/classes/class_ping.png');
    this.load.image('class_muralha', 'sprites/classes/class_muralha.png');
    this.load.image('class_daemon', 'sprites/classes/class_daemon.png');
  }

  create() {
    this.generateTiles();
    this.generateParticleTexture();
    this.generateProjectileTextures();
    this.generateSpecialTileTextures();
    sound.init();
    trackEvent('game_start', { version });
    this.scene.start('MainMenu');
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

  private generateParticleTexture() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillCircle(2, 2, 2);
    g.generateTexture('particle', 4, 4);
    g.destroy();
  }

  private generateProjectileTextures() {
    const g = this.add.graphics();
    g.fillStyle(0x4488ff);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0xaaddff, 0.5);
    g.fillCircle(6, 6, 3);
    g.generateTexture('projectile_daemon', 12, 12);
    g.destroy();
  }

  private generateSpecialTileTextures() {
    const g = this.add.graphics();

    g.fillStyle(0x882222);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xcc4444);
    g.fillTriangle(16, 4, 6, 26, 26, 26);
    g.lineStyle(1, 0xaa3333);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture('tile_trap', 32, 32);
    g.clear();

    g.fillStyle(0x6622aa);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xffd700);
    g.fillCircle(16, 16, 8);
    g.fillStyle(0x6622aa);
    g.fillCircle(16, 16, 4);
    g.lineStyle(1, 0x8833cc);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture('tile_altar', 32, 32);
    g.clear();
    g.fillStyle(0x441177);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0xccaaff);
    g.fillCircle(16, 16, 6);
    g.lineStyle(1, 0x6622aa);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture('tile_altar_dim', 32, 32);
    g.clear();
    g.fillStyle(0x551111);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(0x883333);
    g.fillTriangle(16, 6, 8, 24, 24, 24);
    g.lineStyle(1, 0x661111);
    g.strokeRect(0, 0, 32, 32);
    g.generateTexture('tile_trap_dim', 32, 32);
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
