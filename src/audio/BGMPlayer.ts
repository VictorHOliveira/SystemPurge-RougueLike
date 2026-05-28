import { ZZFX } from 'zzfx';

interface TrackDef {
  bpm: number;
  groove: number;
  notes: number[];
  oscType: OscillatorType;
  bassFreq: number;
  bassGain: number;
  noteGain: number;
  noteDuration: number;
}

const TRACKS: Record<string, TrackDef> = {
  menu: {
    bpm: 100,
    groove: 8,
    notes: [262, 330, 392, 523, 0, 392, 330, 262, 0, 330, 392, 523, 392, 330, 262, 0],
    oscType: 'sine',
    bassFreq: 131,
    bassGain: 0.06,
    noteGain: 0.08,
    noteDuration: 0.8,
  },
  game: {
    bpm: 130,
    groove: 8,
    notes: [262, 294, 330, 392, 440, 392, 330, 294, 262, 294, 330, 392, 440, 523, 440, 392],
    oscType: 'triangle',
    bassFreq: 131,
    bassGain: 0.07,
    noteGain: 0.07,
    noteDuration: 0.7,
  },
  boss: {
    bpm: 150,
    groove: 8,
    notes: [311, 262, 311, 349, 392, 349, 311, 262, 311, 349, 392, 466, 392, 349, 311, 262],
    oscType: 'square',
    bassFreq: 65,
    bassGain: 0.10,
    noteGain: 0.06,
    noteDuration: 0.6,
  },
};

export class BGMPlayer {
  private ctx: AudioContext;
  private masterGain: GainNode;
  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;
  private timeoutId: number | null = null;
  private stepIndex = 0;
  private active = false;
  private currentTrack: TrackDef | null = null;
  private _volume = 0.5;
  private pausedStep = 0;

  constructor() {
    this.ctx = ZZFX.audioContext;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this._volume;
    this.masterGain.connect(this.ctx.destination);
  }

  get volume(): number {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.masterGain.gain.value = this._volume;
  }

  play(which: string): void {
    this.stop();
    const track = TRACKS[which];
    if (!track) return;
    this.currentTrack = track;
    this.stepIndex = 0;
    this.active = true;
    this.startBass(track);
    this.scheduleNext(track);
  }

  stop(): void {
    this.active = false;
    this.currentTrack = null;
    this.stepIndex = 0;
    this.pausedStep = 0;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.stopBass();
  }

  pause(): void {
    if (!this.active || !this.currentTrack) return;
    this.active = false;
    this.pausedStep = this.stepIndex;
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.stopBass();
  }

  resume(): void {
    if (this.pausedStep === 0 && this.currentTrack) {
      this.play(Object.keys(TRACKS).find(k => TRACKS[k] === this.currentTrack) || 'menu');
      return;
    }
    const track = this.currentTrack;
    if (!track) return;
    this.active = true;
    this.stepIndex = this.pausedStep;
    this.pausedStep = 0;
    this.startBass(track);
    this.scheduleNext(track);
  }

  private startBass(track: TrackDef): void {
    if (track.bassFreq <= 0) return;
    this.bassOsc = this.ctx.createOscillator();
    this.bassOsc.type = 'sine';
    this.bassOsc.frequency.value = track.bassFreq;
    this.bassGain = this.ctx.createGain();
    this.bassGain.gain.value = track.bassGain;
    this.bassOsc.connect(this.bassGain);
    this.bassGain.connect(this.masterGain);
    this.bassOsc.start();
  }

  private stopBass(): void {
    if (this.bassOsc) {
      try { this.bassOsc.stop(); } catch { }
      this.bassOsc.disconnect();
      this.bassOsc = null;
    }
    if (this.bassGain) {
      this.bassGain.disconnect();
      this.bassGain = null;
    }
  }

  private scheduleNext(track: TrackDef): void {
    if (!this.active) return;

    const stepDuration = 60 / track.bpm / (track.groove / 4);
    const freq = track.notes[this.stepIndex];
    this.stepIndex = (this.stepIndex + 1) % track.notes.length;

    if (freq > 0) {
      this.playNote(freq, track.oscType, track.noteGain, stepDuration * track.noteDuration);
    }

    this.timeoutId = window.setTimeout(() => this.scheduleNext(track), stepDuration * 1000);
  }

  private playNote(freq: number, type: OscillatorType, gain: number, dur: number): void {
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(gain, now + 0.008);
    noteGain.gain.setValueAtTime(gain, now + dur - 0.008);
    noteGain.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(noteGain);
    noteGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }
}

export const bgm = new BGMPlayer();
