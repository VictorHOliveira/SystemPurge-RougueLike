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
    this.load.image('projectile_daemon', 'sprites/entities/projectile_daemon.png');
    this.load.image('class_limpador', 'sprites/classes/class_limpador.png');
    this.load.image('class_ping', 'sprites/classes/class_ping.png');
    this.load.image('class_muralha', 'sprites/classes/class_muralha.png');
    this.load.image('class_daemon', 'sprites/classes/class_daemon.png');
    this.load.image('class_limpador_hd', 'sprites/classes/class_limpador_hd.png');
    this.load.image('class_ping_hd', 'sprites/classes/class_ping_hd.png');
    this.load.image('class_muralha_hd', 'sprites/classes/class_muralha_hd.png');
    this.load.image('class_daemon_hd', 'sprites/classes/class_daemon_hd.png');
    this.load.image('tile_chest', 'sprites/tiles/tile_chest.png');
    this.load.image('tile_chest_dim', 'sprites/tiles/tile_chest_dim.png');
    this.load.image('tile_chest_opened', 'sprites/tiles/tile_chest_opened.png');
    this.load.image('tile_chest_opened_dim', 'sprites/tiles/tile_chest_opened_dim.png');
    this.load.image('tile_trap', 'sprites/tiles/tile_trap.png');
    this.load.image('tile_trap_dim', 'sprites/tiles/tile_trap_dim.png');
    this.load.image('tile_altar', 'sprites/tiles/tile_altar.png');
    this.load.image('tile_altar_dim', 'sprites/tiles/tile_altar_dim.png');
    this.load.image('item_health_patch', 'sprites/ui/item_health_patch.png');
    this.load.image('item_network_pulse', 'sprites/ui/item_network_pulse.png');
    this.load.image('item_packet_sniffer', 'sprites/ui/item_packet_sniffer.png');
    this.load.image('item_overclock_inject', 'sprites/ui/item_overclock_inject.png');
    this.load.image('item_defrag_shield', 'sprites/ui/item_defrag_shield.png');
    this.load.image('ability_varredura', 'sprites/ui/ability_varredura.png');
    this.load.image('ability_rajada', 'sprites/ui/ability_rajada.png');
    this.load.image('ability_criptografia', 'sprites/ui/ability_criptografia.png');
    this.load.image('ability_overflow', 'sprites/ui/ability_overflow.png');
    this.load.image('ability_vazamento', 'sprites/ui/ability_vazamento.png');
    this.load.image('ability_injecao_virus', 'sprites/ui/ability_injecao_virus.png');
    this.load.image('ability_pulso_emergencia', 'sprites/ui/ability_pulso_emergencia.png');
    this.load.image('ability_sobrecarga_kernel', 'sprites/ui/ability_sobrecarga_kernel.png');
    this.load.image('ability_barreira_protocolo', 'sprites/ui/ability_barreira_protocolo.png');
    this.load.image('ability_restauracao_sistema', 'sprites/ui/ability_restauracao_sistema.png');
    this.load.image('ability_espelhamento', 'sprites/ui/ability_espelhamento.png');
    this.load.image('status_bleed', 'sprites/ui/status_bleed.png');
    this.load.image('status_crypto', 'sprites/ui/status_crypto.png');
    this.load.image('status_boot', 'sprites/ui/status_boot.png');
    this.load.image('status_overclock', 'sprites/ui/status_overclock.png');
    this.load.image('status_defrag', 'sprites/ui/status_defrag.png');
    this.load.image('status_reflect', 'sprites/ui/status_reflect.png');
    this.load.image('status_dodge', 'sprites/ui/status_dodge.png');
    this.load.image('status_regen', 'sprites/ui/status_regen.png');
    this.load.image('ui_menu_bg', 'sprites/ui/menu_bg.png');
    this.load.image('ui_panel_frame', 'sprites/ui/panel_frame_trim.png');
    this.load.image('ui_class_card_frame', 'sprites/ui/class_card_frame.png');
    this.load.image('ui_selector', 'sprites/ui/selector_alpha.png');
    this.load.image('ui_icon_bits', 'sprites/ui/icon_bits.png');
    this.load.image('ui_upgrade_atk', 'sprites/ui/upgrade_atk.png');
    this.load.image('ui_upgrade_def', 'sprites/ui/upgrade_def.png');
    this.load.image('ui_upgrade_hp', 'sprites/ui/upgrade_hp.png');
    this.load.image('ui_upgrade_vis', 'sprites/ui/upgrade_vis.png');
    this.load.image('ui_upgrade_speed', 'sprites/ui/upgrade_speed.png');
    this.load.image('ui_upgrade_passive', 'sprites/ui/upgrade_passive.png');
    this.load.image('fx_impact', 'sprites/fx/impact.png');
    this.load.image('fx_slash', 'sprites/fx/slash.png');
    this.load.image('fx_explosion', 'sprites/fx/explosion.png');
    this.load.image('fx_heal', 'sprites/fx/heal.png');
    this.load.image('fx_bleed', 'sprites/fx/bleed.png');
    this.load.image('fx_levelup', 'sprites/fx/levelup.png');
    this.load.image('fx_boss_aura', 'sprites/fx/boss_aura.png');
    this.load.image('fx_stairs_glow', 'sprites/fx/stairs_glow.png');
    this.load.image('fx_shield', 'sprites/fx/shield.png');
  }

  create() {
    this.generateParticleTexture();
    sound.init();
    trackEvent('game_start', { version });
    this.scene.start('MainMenu');
  }

  private generateParticleTexture() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff);
    g.fillCircle(2, 2, 2);
    g.generateTexture('particle', 4, 4);
    g.destroy();
  }

}
