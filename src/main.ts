import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { ClassSelectScene } from './scenes/ClassSelectScene';
import { GameScene } from './scenes/GameScene';
import { HUDScene } from './scenes/HUDScene';
import { UpgradeScene } from './scenes/UpgradeScene';
import { PauseScene } from './scenes/PauseScene';
import { KeyBindScene } from './scenes/KeyBindScene';
import { ConfigScene } from './scenes/ConfigScene';
import { AudioScene } from './scenes/AudioScene';
import { CompendiumScene } from './scenes/CompendiumScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ClassUnlockScene } from './scenes/ClassUnlockScene';
import { ShopScene } from './scenes/ShopScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1024,
  height: 640,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#000000',
  scene: [BootScene, MainMenuScene, ClassSelectScene, GameScene, HUDScene, UpgradeScene, PauseScene, KeyBindScene, ConfigScene, AudioScene, GameOverScene, ShopScene, ClassUnlockScene, CompendiumScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_VERTICALLY,
  },
};

new Phaser.Game(config);
