import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager, audioTrackIds, audioSoundIds } from '../../src/audio/AudioManager.js';

class FakeParam {
  constructor() { this.value = 0; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push(['set', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push(['ramp', value, time]); }
  setTargetAtTime(value, time, constant) { this.value = value; this.events.push(['target', value, time, constant]); }
}
class FakeNode {
  constructor() { this.gain = new FakeParam(); this.frequency = new FakeParam(); this.connections = []; this.type = ''; }
  connect(node) { this.connections.push(node); }
  start(time) { this.startedAt = time; }
  stop(time) { this.stoppedAt = time; }
}
class FakeAudioContext {
  constructor() { this.state = 'suspended'; this.currentTime = 1; this.destination = {}; this.nodes = []; }
  createGain() { const n = new FakeNode(); this.nodes.push(n); return n; }
  createOscillator() { const n = new FakeNode(); this.nodes.push(n); return n; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

function makeAudio(options = {}) {
  const audio = new AudioManager({ AudioContext: FakeAudioContext, ...options });
  return audio;
}

test('exports five distinct boss themes and gameplay music', () => {
  assert.deepEqual(audioTrackIds, ['gameplay', 'boss-1', 'boss-2', 'boss-3', 'boss-4', 'boss-5']);
  assert.equal(new Set(audioTrackIds).size, 6);
});

test('retains a music request until browser audio is unlocked', async () => {
  const audio = makeAudio();
  audio.playMusic();
  assert.equal(audio.pendingTrack, 'gameplay');
  await audio.unlockAudio();
  assert.equal(audio.pendingTrack, null);
  assert.equal(audio.currentTrack, 'gameplay');
  assert.ok(audio.scheduler);
  await audio.dispose();
});

test('each of the five boss tracks replaces the previous scheduler', async () => {
  const audio = makeAudio();
  await audio.unlockAudio();
  const openingNotes = [];
  for (let i = 1; i <= 5; i += 1) {
    const oldScheduler = audio.scheduler;
    const previousNodeCount = audio.context.nodes.length;
    audio.playBossMusic(`boss-${i}`);
    assert.equal(audio.currentTrack, `boss-${i}`);
    assert.ok(audio.scheduler);
    if (oldScheduler !== null) assert.notEqual(audio.scheduler, oldScheduler);
    const newOscillators = audio.context.nodes.slice(previousNodeCount)
      .filter(node => node.frequency.value > 0);
    openingNotes.push(newOscillators[0]?.frequency.value);
  }
  assert.equal(new Set(openingNotes).size, 5, 'boss themes must have distinct opening notes');
  await audio.dispose();
});

test('campaign boss IDs select their matching distinct music tracks', async () => {
  const audio = makeAudio();
  await audio.unlockAudio();
  const ids = ['coral-warden','ruin-colossus','abyss-emperor','kelp-guardian','ice-leviathan'];
  for (let i = 0; i < ids.length; i += 1) {
    audio.playBossMusic(ids[i]);
    assert.equal(audio.currentTrack, `boss-${i + 1}`, ids[i]);
  }
  assert.throws(() => audio.playBossMusic('unknown-boss'), /Unknown boss ID/);
  assert.throws(() => audio.playBossMusic(1), /Unknown boss ID/);
  await audio.dispose();
});

test('music and sound settings are independent', async () => {
  const audio = makeAudio();
  await audio.unlockAudio();
  audio.playMusic();
  audio.setMusicEnabled(false);
  assert.equal(audio.musicEnabled, false);
  assert.equal(audio.scheduler, null);
  assert.equal(audio.soundEnabled, true);
  assert.equal(audio.playSound('jump'), true);
  audio.setSoundEnabled(false);
  assert.equal(audio.soundEnabled, false);
  assert.equal(audio.playSound('jump'), false);
  audio.setMusicEnabled(true);
  assert.equal(audio.currentTrack, 'gameplay');
  await audio.dispose();
});

test('all required effect identifiers are recognized', async () => {
  const audio = makeAudio();
  await audio.unlockAudio();
  for (const id of audioSoundIds) assert.equal(audio.playSound(id), true, id);
  assert.equal(audio.playSound('not-a-real-effect'), false);
  assert.equal(audio.playVictoryFanfare(), true);
  await audio.dispose();
});

test('pause stops scheduling and resume restores the selected track', async () => {
  const audio = makeAudio();
  await audio.unlockAudio();
  audio.playBossMusic('kelp-guardian');
  await audio.pauseAudio();
  assert.equal(audio.paused, true);
  assert.equal(audio.scheduler, null);
  await audio.resumeAudio();
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTrack, 'boss-4');
  assert.ok(audio.scheduler);
  await audio.dispose();
});

test('stopping music clears active and pending playback', async () => {
  const audio = makeAudio();
  audio.playBossMusic('ruin-colossus');
  audio.stopMusic();
  assert.equal(audio.currentTrack, null);
  assert.equal(audio.pendingTrack, null);
  assert.equal(audio.scheduler, null);
  await audio.dispose();
});


test('boss-5 F5 melody note is defined and bass lines stay in the bass register', async () => {
  const audio = makeAudio();
  await audio.unlockAudio();
  audio.playBossMusic('ice-leviathan');
  const frequencies = audio.context.nodes
    .filter(node => node.frequency.value > 0)
    .map(node => node.frequency.value);
  assert.ok(frequencies.includes(698.46), 'boss-5 opening phrase schedules F5');
  const bassOscillators = audio.context.nodes.filter(node =>
    node.type === 'triangle' && node.frequency.value > 0);
  assert.ok(bassOscillators.length > 0);
  assert.ok(bassOscillators.every(node => node.frequency.value <= 220),
    'bass notes should not occupy the mid-range');
  await audio.dispose();
});
