import Phaser from 'phaser';
import { FONT, FONT_SIZES, COLORS } from '../theme';

export interface ToastData {
  title: string;
  detail?: string;
  color?: string;
  duration?: number;
}

interface QueueItem {
  scene: Phaser.Scene;
  data: ToastData;
}

const pending: QueueItem[] = [];
let showing = false;

export function showToast(scene: Phaser.Scene, data: ToastData): void {
  pending.push({ scene, data });
  if (!showing) showNext();
}

function showNext(): void {
  const item = pending.shift();
  if (!item) {
    showing = false;
    return;
  }
  showing = true;
  const { scene, data } = item;
  if (!scene.sys.isActive() && !scene.scene.isPaused()) {
    showNext();
    return;
  }

  const color = data.color ?? COLORS.accent;
  const tint = Phaser.Display.Color.HexStringToColor(color).color;
  const textW = Math.max(data.title.length, (data.detail ?? '').length);
  const w = Phaser.Math.Clamp(textW * 7 + 32, 220, 560);
  const container = scene.add.container(320, 52).setScrollFactor(0).setDepth(1000).setAlpha(0);
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1a18, 0.96);
  bg.fillRoundedRect(-w / 2, -20, w, 40, 4);
  bg.lineStyle(1, tint, 0.9);
  bg.strokeRoundedRect(-w / 2, -20, w, 40, 4);

  const title = scene.add.text(-w / 2 + 12, -16, data.title, {
    fontFamily: FONT,
    fontSize: FONT_SIZES.ability,
    color,
    fontStyle: 'bold',
  });
  container.add([bg, title]);

  if (data.detail) {
    container.add(scene.add.text(-w / 2 + 12, 2, data.detail, {
      fontFamily: FONT,
      fontSize: FONT_SIZES.stats,
      color: COLORS.muted,
    }));
  }

  scene.tweens.add({
    targets: container,
    alpha: 1,
    y: 66,
    duration: 180,
    ease: 'Quad.easeOut',
    onComplete: () => {
      scene.tweens.add({
        targets: container,
        alpha: 0,
        y: 54,
        delay: data.duration ?? 1500,
        duration: 300,
        ease: 'Quad.easeIn',
        onComplete: () => {
          container.destroy();
          showNext();
        },
      });
    },
  });
}
