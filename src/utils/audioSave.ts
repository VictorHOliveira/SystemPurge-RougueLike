const STORAGE_KEY = 'systempurge_audio';

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULTS: AudioSettings = { musicVolume: 0.25, sfxVolume: 0.5 };

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        musicVolume: typeof parsed.musicVolume === 'number' ? parsed.musicVolume : DEFAULTS.musicVolume,
        sfxVolume: typeof parsed.sfxVolume === 'number' ? parsed.sfxVolume : DEFAULTS.sfxVolume,
      };
    }
  } catch { }
  return { ...DEFAULTS };
}

export function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { }
}
