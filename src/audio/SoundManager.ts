import { ZZFXSound, zzfx, ZZFX } from 'zzfx';
import { SOUND_DEFS, SoundId } from './sounds';
import { loadAudioSettings, saveAudioSettings } from '../utils/audioSave';

class SoundManager {
  private sounds = new Map<string, ZZFXSound>();
  private ready = false;
  private _sfxVolume: number;

  constructor() {
    this._sfxVolume = loadAudioSettings().sfxVolume;
  }

  init() {
    for (const [id, params] of Object.entries(SOUND_DEFS)) {
      this.sounds.set(id, new ZZFXSound(params));
    }
    this.ready = true;
  }

  get sfxVolume(): number {
    return this._sfxVolume;
  }

  set sfxVolume(v: number) {
    this._sfxVolume = Math.max(0, Math.min(1, v));
    const s = loadAudioSettings();
    s.sfxVolume = this._sfxVolume;
    saveAudioSettings(s);
  }

  play(id: SoundId, volume = 1) {
    if (!this.ready) return;
    const sound = this.sounds.get(id);
    if (sound) sound.play(volume * this._sfxVolume);
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
