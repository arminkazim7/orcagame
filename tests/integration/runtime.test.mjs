import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameRuntime } from '../../src/main.js';
import { GAME_CONFIG } from '../../src/game-config.js';

test('composition root creates one shared event bus and 15-level progression', () => {
  const game = createGameRuntime({ audioEnabled: false });
  assert.equal(game.config.progression.totalLevels, 15);
  assert.equal(game.progression.totalLevels, 15);
  assert.equal(game.player.events, game.events);
  assert.equal(game.state.player.lives, 3);
  game.dispose();
});

test('player protection consumption synchronizes the progression-owned power-up slot', () => {
  const game = createGameRuntime({ audioEnabled: false });
  game.powerUps.collectPowerUp('golden-krill');
  game.player.takeDamage();
  assert.equal(game.powerUps.getActivePowerUp(), null);
  assert.equal(game.player.sizeScale, 1);
  game.dispose();
});

test('save round trip restores score, player profile, and active power-up', async () => {
  const game = createGameRuntime({ audioEnabled: false });
  game.player.customize({ name: 'Bluefin', color: 'teal' });
  game.score.addScore(500);
  game.powerUps.collectPowerUp('sea-berry');
  const save = game.saves.createSave();
  game.player.customize({ name: 'Changed', color: 'rose' });
  game.score.addScore(250);
  const result = await game.saves.loadSave(JSON.stringify(save));
  assert.equal(result.loaded, true);
  assert.equal(game.player.name, 'Bluefin');
  assert.equal(game.player.color, 'teal');
  assert.equal(game.score.getScore(), 500);
  assert.equal(game.powerUps.getActivePowerUp().id, 'sea-berry');
  game.dispose();
});

test('canonical configuration contains five worlds with three levels each and five bosses', () => {
  assert.equal(GAME_CONFIG.worlds.length, 5);
  assert.deepEqual(GAME_CONFIG.worlds.map(w => w.levels.length), [3,3,3,3,3]);
  assert.equal(GAME_CONFIG.worlds.flatMap(w => w.levels).length, 15);
  assert.equal(GAME_CONFIG.bosses.length, 5);
});
