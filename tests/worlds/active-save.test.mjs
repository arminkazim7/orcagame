import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameRuntime } from '../../src/main.js';
import { damageBoss, getBoss, clearEnemies } from '../../src/enemies/index.js';

test('portable save restores active level, player position, collectibles and boss encounter', async () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    const level = game.startLevel(3);
    level.collectibles[0].collected = true;
    game.player.x = 1777;
    game.player.y = 245;
    game.player.vx = 31;
    damageBoss(1, 7);
    const savedBossHealth = getBoss(1).health;
    const save = game.saves.createSave();

    game.startLevel(1);
    game.player.x = 100;
    const result = await game.saves.loadSave(JSON.stringify(save));

    assert.equal(result.loaded, true, result.errors?.join('; '));
    assert.equal(game.world.level.number, 3);
    assert.equal(game.player.x, 1777);
    assert.equal(game.player.y, 245);
    assert.equal(game.player.vx, 31);
    assert.equal(game.world.level.collectibles[0].collected, true);
    assert.equal(getBoss(1).health, savedBossHealth);
  } finally {
    game.dispose();
    clearEnemies();
  }
});

test('invalid active world snapshots are rejected before changing live state', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    game.startLevel(2);
    const save = game.saves.createSave();
    save.gameplayState.world.level = 999;
    const before = game.world.level.number;
    const result = game.saves.applySave(save);
    assert.equal(result.applied, false);
    assert.equal(game.world.level.number, before);
  } finally {
    game.dispose();
    clearEnemies();
  }
});

test('portable save preserves paused state and clamps restored camera', async () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    game.startLevel(1);
    game.state.gameplay.paused = true;
    const save = game.saves.createSave();
    save.gameplayState.world.cameraX = 999999;
    const result = await game.saves.loadSave(JSON.stringify(save));
    assert.equal(result.loaded, true, result.errors?.join('; '));
    assert.equal(game.state.gameplay.paused, true);
    assert.ok(game.world.cameraX >= 0);
    assert.ok(game.world.cameraX <= Math.max(0, game.world.level.width - 960));
  } finally {
    game.dispose();
    clearEnemies();
  }
});

test('portable save restores the selected character and its animation profile', async () => {
  const game=createGameRuntime({audioEnabled:false});
  try {
    game.player.customize({name:'Tentacle',characterType:'octopus'});
    const save=game.saves.createSave();
    assert.equal(save.player.characterType,'octopus');
    assert.equal(save.gameplayState.player.characterType,'octopus');
    game.player.customize({characterType:'raccoon'});
    const result=await game.saves.loadSave(JSON.stringify(save));
    assert.equal(result.loaded,true,result.errors?.join('; '));
    assert.equal(game.player.characterType,'octopus');
    assert.equal(game.player.animation.characterType,'octopus');
  } finally { game.dispose(); clearEnemies(); }
});
