import { ZZFXSound, zzfx, ZZFX } from 'zzfx';
import { SOUND_DEFS, SoundId } from './sounds';

class SoundManager {
  private sounds = new Map<string, ZZFXSound>();
  private ready = false;

  init() {
    for (const [id, params] of Object.entries(SOUND_DEFS)) {
      this.sounds.set(id, new ZZFXSound(params));
    }
    this.ready = true;
  }

  play(id: SoundId, volume = 1) {
    if (!this.ready) return;
    const sound = this.sounds.get(id);
    if (sound) sound.play(volume);
  }

  confirm() {
    this.play('menu_confirm');
  }

  select() {
    this.play('menu_select');
  }

  resumeContext() {
    if (ZZFX.audioContext.state === 'suspended') {
      ZZFX.audioContext.resume();
    }
  }

  unlock() {
    this.resumeContext();
    zzfx(.01, 0, 1e3, .01, 0, .01);
    this.init();
  }
}

export const sound = new SoundManager();
