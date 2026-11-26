/**
 * Orca Adventure — original Web Audio synthesizer.
 * No external assets or dependencies. All music and effects are generated at runtime.
 */

const NOTE = Object.freeze({
  B2: 123.47, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25,
  F5: 698.46, G5: 783.99, A5: 880.00, C6: 1046.50, REST: 0
});

const TRACKS = Object.freeze({
  gameplay: {
    bpm: 112,
    melody: [NOTE.C5, NOTE.G4, NOTE.A4, NOTE.E4, NOTE.G4, NOTE.E4, NOTE.D4, NOTE.REST,
      NOTE.C5, NOTE.G4, NOTE.A4, NOTE.E4, NOTE.D5, NOTE.C5, NOTE.G4, NOTE.REST],
    bass: [NOTE.C3, NOTE.C3, NOTE.G3, NOTE.G3, NOTE.A3, NOTE.A3, NOTE.G3, NOTE.G3,
      NOTE.F3, NOTE.F3, NOTE.E3, NOTE.E3, NOTE.D3, NOTE.D3, NOTE.G3, NOTE.G3]
  },
  'boss-1': { bpm: 142, melody: [NOTE.C5, NOTE.C5, NOTE.G4, NOTE.C5, NOTE.D5, NOTE.C5, NOTE.A4, NOTE.G4, NOTE.C5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.G4, NOTE.A4, NOTE.G4, NOTE.REST], bass: [NOTE.C3, NOTE.C3, NOTE.G3, NOTE.C3, NOTE.F4, NOTE.F4, NOTE.G3, NOTE.G3, NOTE.A3, NOTE.A3, NOTE.E3, NOTE.E3, NOTE.G3, NOTE.G3, NOTE.C3, NOTE.C3] },
  'boss-2': { bpm: 154, melody: [NOTE.A4, NOTE.E5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.REST], bass: [NOTE.A3, NOTE.A3, NOTE.E3, NOTE.E3, NOTE.G3, NOTE.G3, NOTE.D3, NOTE.D3, NOTE.F3, NOTE.F3, NOTE.C3, NOTE.C3, NOTE.E3, NOTE.E3, NOTE.A3, NOTE.A3] },
  'boss-3': { bpm: 132, melody: [NOTE.E5, NOTE.D5, NOTE.C5, NOTE.G4, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.D5, NOTE.E5, NOTE.C5, NOTE.A4, NOTE.G4, NOTE.E4, NOTE.REST], bass: [NOTE.E3, NOTE.E3, NOTE.B2, NOTE.B2, NOTE.C3, NOTE.C3, NOTE.G3, NOTE.G3, NOTE.A3, NOTE.A3, NOTE.E3, NOTE.E3, NOTE.D3, NOTE.D3, NOTE.E3, NOTE.E3] },
  'boss-4': { bpm: 166, melody: [NOTE.G5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.E5, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.A4, NOTE.REST], bass: [NOTE.G3, NOTE.G3, NOTE.D3, NOTE.D3, NOTE.E3, NOTE.E3, NOTE.B4, NOTE.B4, NOTE.C3, NOTE.C3, NOTE.G3, NOTE.G3, NOTE.A3, NOTE.A3, NOTE.D3, NOTE.D3] },
  'boss-5': { bpm: 124, melody: [NOTE.C6, NOTE.G5, NOTE.A5, NOTE.E5, NOTE.F5, NOTE.C5, NOTE.D5, NOTE.G5, NOTE.A5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.B4, NOTE.G5, NOTE.C6, NOTE.REST], bass: [NOTE.C3, NOTE.G3, NOTE.A3, NOTE.E3, NOTE.F4, NOTE.C3, NOTE.D3, NOTE.G3, NOTE.A3, NOTE.E3, NOTE.G3, NOTE.C3, NOTE.G3, NOTE.G3, NOTE.C3, NOTE.C3] }
});

const BOSS_TRACK_BY_ID = Object.freeze({
  'coral-warden': 'boss-1',
  'ruin-colossus': 'boss-2',
  'abyss-emperor': 'boss-3',
  'kelp-guardian': 'boss-4',
  'ice-leviathan': 'boss-5'
});

const SOUND_IDS = new Set([
  'jump', 'shoot', 'enemyDefeat', 'powerUp', 'bonusLife', 'playerDamage',
  'checkpoint', 'bossDamage', 'bossDefeat', 'levelComplete', 'victory'
]);

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export class AudioManager {
  constructor({ AudioContext: Context = globalThis.AudioContext || globalThis.webkitAudioContext,
    musicEnabled = true, soundEnabled = true, masterVolume = 0.7 } = {}) {
    this.Context = Context;
    this.musicEnabled = Boolean(musicEnabled);
    this.soundEnabled = Boolean(soundEnabled);
    this.masterVolume = clamp(Number(masterVolume) || 0, 0, 1);
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.currentTrack = null;
    this.currentBossId = null;
    this.scheduler = null;
    this.nextStepTime = 0;
    this.stepIndex = 0;
    this.paused = false;
    this.pendingTrack = null;
    this.disposed = false;
  }

  /** Call from a user gesture (e.g. Start button) to satisfy browser autoplay policy. */
  async unlockAudio() {
    if (this.disposed || !this.Context) return false;
    this._ensureContext();
    if (this.context.state === 'suspended') await this.context.resume();
    if (!this.paused && this.pendingTrack && this.musicEnabled) {
      const track = this.pendingTrack;
      this.pendingTrack = null;
      this._startTrack(track);
    }
    return this.context.state === 'running';
  }

  _ensureContext() {
    if (this.context) return;
    if (!this.Context) return;
    this.context = new this.Context();
    this.masterGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.sfxGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = this.masterVolume;
    this.musicGain.gain.value = this.musicEnabled ? 0.24 : 0;
    this.sfxGain.gain.value = this.soundEnabled ? 0.8 : 0;
  }

  playMusic() {
    this.currentBossId = null;
    this.currentTrack = 'gameplay';
    if (!this.musicEnabled || this.paused) return;
    this._requestTrack('gameplay');
  }

  stopMusic() {
    this.currentTrack = null;
    this.currentBossId = null;
    this.pendingTrack = null;
    this._stopScheduler();
  }

  playBossMusic(bossId) {
    const trackId = this._bossTrackId(bossId);
    this.currentBossId = bossId;
    this.currentTrack = trackId;
    if (!this.musicEnabled || this.paused) return;
    this._requestTrack(trackId);
  }

  _bossTrackId(bossId) {
    const trackId = BOSS_TRACK_BY_ID[String(bossId)];
    if (!trackId) throw new RangeError(`Unknown boss ID: ${bossId}`);
    return trackId;
  }

  _requestTrack(trackId) {
    this._ensureContext();
    if (!this.context) { this.pendingTrack = trackId; return; }
    if (this.context.state !== 'running') {
      // Do not attempt to bypass autoplay restrictions. The next user gesture can call unlockAudio().
      this.pendingTrack = trackId;
      return;
    }
    this._startTrack(trackId);
  }

  _startTrack(trackId) {
    if (!this.context || !this.musicEnabled || this.paused) return;
    this._stopScheduler();
    this.pendingTrack = null;
    this.currentTrack = trackId;
    this.stepIndex = 0;
    const track = TRACKS[trackId] || TRACKS.gameplay;
    const secondsPerBeat = 60 / track.bpm;
    this.nextStepTime = this.context.currentTime + 0.04;
    const scheduleAhead = 0.12;
    const tick = () => {
      if (!this.context || this.paused || !this.musicEnabled || this.currentTrack !== trackId) return;
      while (this.nextStepTime < this.context.currentTime + scheduleAhead) {
        const i = this.stepIndex % track.melody.length;
        this._tone(track.melody[i], this.nextStepTime, secondsPerBeat * 0.78, 'square', 0.12, this.musicGain);
        this._tone(track.bass[i], this.nextStepTime, secondsPerBeat * 0.9, 'triangle', 0.10, this.musicGain);
        this.nextStepTime += secondsPerBeat * 0.5;
        this.stepIndex += 1;
      }
    };
    tick();
    this.scheduler = setInterval(tick, 25);
  }

  _stopScheduler() {
    if (this.scheduler !== null) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  _tone(frequency, start, duration, type, volume, destination) {
    if (!frequency || !this.context || !destination) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.025, duration));
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  playSound(soundId) {
    if (!this.soundEnabled || this.paused || !SOUND_IDS.has(soundId)) return false;
    this._ensureContext();
    if (!this.context || this.context.state !== 'running') return false;
    const now = this.context.currentTime;
    const beep = (freq, offset, duration, type = 'square', volume = 0.22) =>
      this._tone(freq, now + offset, duration, type, volume, this.sfxGain);
    const sequence = {
      jump: [[NOTE.G4, 0, .09], [NOTE.C5, .07, .10]],
      shoot: [[NOTE.G5, 0, .045], [NOTE.C6, .035, .045]],
      enemyDefeat: [[NOTE.E5, 0, .07], [NOTE.C5, .07, .08], [NOTE.G4, .15, .12]],
      powerUp: [[NOTE.C5, 0, .07], [NOTE.E5, .07, .07], [NOTE.G5, .14, .07], [NOTE.C6, .21, .15]],
      bonusLife: [[NOTE.G4, 0, .08], [NOTE.C5, .08, .08], [NOTE.E5, .16, .08], [NOTE.G5, .24, .08], [NOTE.C6, .32, .22]],
      playerDamage: [[NOTE.G4, 0, .12, 'sawtooth'], [NOTE.C4, .10, .20, 'sawtooth']],
      checkpoint: [[NOTE.C5, 0, .08], [NOTE.G5, .09, .15]],
      bossDamage: [[NOTE.C5, 0, .05, 'sawtooth'], [NOTE.G4, .05, .09, 'sawtooth']],
      bossDefeat: [[NOTE.G4, 0, .09], [NOTE.C5, .10, .09], [NOTE.E5, .20, .09], [NOTE.G5, .30, .24]],
      levelComplete: [[NOTE.C5, 0, .08], [NOTE.E5, .09, .08], [NOTE.G5, .18, .08], [NOTE.C6, .27, .24]],
      victory: [[NOTE.C5, 0, .10], [NOTE.E5, .11, .10], [NOTE.G5, .22, .10], [NOTE.C6, .33, .34]]
    }[soundId];
    for (const [freq, offset, duration, type] of sequence) beep(freq, offset, duration, type);
    return true;
  }

  playVictoryFanfare() {
    if (!this.soundEnabled || this.paused) return false;
    this._ensureContext();
    if (!this.context || this.context.state !== 'running') return false;
    const now = this.context.currentTime + 0.02;
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.G5, NOTE.C6];
    notes.forEach((note, i) => this._tone(note, now + i * 0.105, i === 5 ? 0.42 : 0.085,
      'square', 0.24, this.sfxGain));
    return true;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = Boolean(enabled);
    this._ensureContext();
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.24 : 0,
      this.context.currentTime, 0.025);
    if (!this.musicEnabled) {
      this._stopScheduler();
      this.pendingTrack = null;
    } else if (!this.paused && this.currentTrack) {
      this._requestTrack(this.currentTrack);
    }
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
    this._ensureContext();
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.soundEnabled ? 0.8 : 0,
      this.context.currentTime, 0.015);
  }

  pauseAudio() {
    this.paused = true;
    this._stopScheduler();
    if (this.context && this.context.state === 'running') return this.context.suspend();
  }

  async resumeAudio() {
    this.paused = false;
    if (!this.context) {
      if (this.currentTrack && this.musicEnabled) this.pendingTrack = this.currentTrack;
      return false;
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.musicEnabled && this.currentTrack) this._startTrack(this.currentTrack);
    return this.context.state === 'running';
  }

  setMasterVolume(volume) {
    this.masterVolume = clamp(Number(volume) || 0, 0, 1);
    if (this.masterGain && this.context) this.masterGain.gain.setTargetAtTime(this.masterVolume,
      this.context.currentTime, 0.02);
  }

  dispose() {
    this.stopMusic();
    this.disposed = true;
    if (this.context && this.context.close) return this.context.close();
  }
}

export const audioTrackIds = Object.freeze(Object.keys(TRACKS));
export const audioSoundIds = Object.freeze([...SOUND_IDS]);

export function createAudioManager(options) { return new AudioManager(options); }
