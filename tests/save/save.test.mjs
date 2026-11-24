import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveManager, SAVE_VERSION } from '../../src/save/index.js';

function makeHarness() {
  const profile = { name: 'Nori', colour: '#12ABEF', cheatUnlocked: false };
  const player = { x: 120, y: 240, vx: 2, vy: -4, grounded: false, facing: 'left' };
  const state = {
    progression: { totalLevels: 5, currentLevel: 2, difficulty: 'hard', unlockedLevels: [1,2], completedLevels: { '1': { easy: true, hard: true } }, records: { easy: { '1': { completions: 1, bestScore: 800, bestTime: 40 } }, hard: { '1': { completions: 1, bestScore: 1200, bestTime: 35 } } }, goldLevels: [1], unlockedBosses: ['reef-king'], defeatedBosses: ['reef-king'], orcalordUnlocked: false },
    lives: { lives: 4, deathCount: 2, levelStart: { x: 80, y: 300 } }, score: { score: 12500, nextThreshold: 20000, awardedThresholds: [10000], threshold: 10000 }, powerUps: { active: 'golden-krill', protectionHits: 1 }, checkpoints: { id: 'cp-2', x: 300, y: 190, level: 2 }
  };
  const manager = key => ({ serialize: () => structuredClone(state[key]), deserialize: value => { state[key] = structuredClone(value); } });
  const progression = manager('progression');
  const lives = manager('lives');
  const score = manager('score');
  const powerUps = manager('powerUps');
  const checkpoints = manager('checkpoints');
  const save = new SaveManager({ profile, player, progression, lives, score, powerUps, checkpoints, totalLevels: 5 });
  return { save, state, profile, player };
}

test('createSave captures complete portable state and validates', () => {
  const h = makeHarness(); const data = h.save.createSave();
  assert.equal(data.version, SAVE_VERSION); assert.equal(data.player.name, 'Nori');
  assert.equal(data.difficulty, 'hard'); assert.equal(data.score, 12500);
  assert.equal(data.activePowerUp, 'golden-krill'); assert.equal(data.checkpoint.id, 'cp-2'); assert.deepEqual(data.levelStart, { x: 80, y: 300 });
  assert.equal(data.nextBonusLifeThreshold, 20000); assert.deepEqual(h.save.validateSave(data), { valid: true, errors: [] });
});

test('round-trip JSON load restores managers, profile, player and gameplay state', async () => {
  const source = makeHarness(); const data = source.save.createSave(); const json = JSON.stringify(data);
  const target = makeHarness(); target.profile.name = 'Changed'; target.player.x = 0;
  target.state.lives.lives = 1; target.state.score.score = 0;
  const result = await target.save.loadSave(json);
  assert.equal(result.loaded, true); assert.equal(target.profile.name, 'Nori');
  assert.equal(target.player.x, 120); assert.equal(target.state.lives.lives, 4);
  assert.equal(target.state.score.score, 12500); assert.equal(target.state.powerUps.active, 'golden-krill');
});

test('loadSave accepts File-like objects', async () => {
  const h = makeHarness(); const json = JSON.stringify(h.save.createSave());
  assert.equal((await h.save.loadSave({ text: async () => json })).loaded, true);
});

test('malformed JSON is rejected without mutation', async () => {
  const h = makeHarness(); const before = structuredClone(h.state);
  const result = await h.save.loadSave('{ broken');
  assert.equal(result.loaded, false); assert.match(result.errors[0], /Malformed JSON/);
  assert.deepEqual(h.state, before);
});

test('incompatible versions are rejected', async () => {
  const h = makeHarness(); const data = h.save.createSave(); data.version = 999;
  const result = await h.save.loadSave(JSON.stringify(data));
  assert.equal(result.loaded, false); assert.match(result.errors.join(' '), /Unsupported save version/);
});

test('unknown power-up IDs and invalid level IDs are rejected', () => {
  const h = makeHarness(); const a = h.save.createSave(); a.activePowerUp = 'super-orca';
  assert.equal(h.save.validateSave(a).valid, false);
  const b = h.save.createSave(); b.progression.unlockedLevels = [1, 99];
  assert.equal(h.save.validateSave(b).valid, false);
});

test('score milestone and protection state inconsistencies are rejected', () => {
  const h = makeHarness(); const a = h.save.createSave(); a.nextBonusLifeThreshold = 10000;
  assert.equal(h.save.validateSave(a).valid, false);
  const b = h.save.createSave(); b.powerUpProtectionHits = 0;
  assert.equal(h.save.validateSave(b).valid, false);
});

test('completed levels, Gold and boss progression must be consistent', () => {
  const h = makeHarness(); const a = h.save.createSave(); a.progression.goldLevels = [2];
  assert.equal(h.save.validateSave(a).valid, false);
  const b = h.save.createSave(); b.progression.defeatedBosses = ['locked-boss'];
  assert.equal(h.save.validateSave(b).valid, false);
});

test('applySave rejects before mutating live state', () => {
  const h = makeHarness(); const before = structuredClone(h.state); const data = h.save.createSave();
  data.lives = -4; const result = h.save.applySave(data);
  assert.equal(result.applied, false); assert.deepEqual(h.state, before);
});

test('invalid player position in gameplay state rolls back manager changes', () => {
  const h = makeHarness(); const before = structuredClone(h.state); const data = h.save.createSave();
  data.lives = 8; data.gameplayState.player.x = 'teleport';
  const result = h.save.applySave(data);
  assert.equal(result.applied, false); assert.deepEqual(h.state, before);
});

test('getSaveVersion returns current schema version', () => {
  assert.equal(makeHarness().save.getSaveVersion(), 1);
});
