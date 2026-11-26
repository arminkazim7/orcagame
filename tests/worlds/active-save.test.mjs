import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameRuntime } from '../../src/main.js';

test('portable save restores active level, player position, collectibles and boss encounter', async () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    const level = game.startLevel(3);
    level.collectibles[0].collected = true;
    game.player.x = 1777;
    game.player.y = 245;
    game.player.vx = 31;
    game.world.encounters.damageBoss(1, 7);
    const savedBossHealth = game.world.encounters.getBoss(1).health;
    const save = game.saves.createSave();
    const replayed = [];
    const offLevel = game.events.on('level.started', event => replayed.push(['level.started', event]));
    const offBoss = game.events.on('boss.started', event => replayed.push(['boss.started', event]));

    game.startLevel(1);
    game.player.x = 100;
    const result = await game.saves.loadSave(JSON.stringify(save));

    assert.equal(result.loaded, true, result.errors?.join('; '));
    assert.equal(game.world.level.number, 3);
    assert.equal(game.player.x, 1777);
    assert.equal(game.player.y, 245);
    assert.equal(game.player.vx, 31);
    assert.equal(game.world.level.collectibles[0].collected, true);
    assert.equal(game.world.encounters.getBoss(1).health, savedBossHealth);
    assert.deepEqual(replayed, [], 'restoration must not replay level or boss start events');
    offLevel(); offBoss();
  } finally {
    game.dispose();
   
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
    assert.equal(game.state.gameplay.paused, false, 'restored games always resume unpaused');
    assert.ok(game.world.cameraX >= 0);
    assert.ok(game.world.cameraX <= Math.max(0, game.world.level.width - 960));
  } finally {
    game.dispose();
   
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
  } finally { game.dispose(); }
});


test('Hard-mode damage amount removes the matching number of lives', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.difficulty = 'hard';
    game.startLevel(1);
    game.lives.lives = 4;
    game.events.emit('player.damaged', { amount: 2, source: 'contact' });
    assert.equal(game.lives.getLives(), 2);
  } finally { game.dispose(); }
});

test('damage equal to remaining lives triggers one recovery', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.difficulty = 'hard';
    game.startLevel(1);
    game.lives.lives = 2;
    const beforeDeaths = game.lives.deathCount;
    game.events.emit('player.damaged', { amount: 2, source: 'enemy-projectile' });
    assert.equal(game.lives.getLives(), game.lives.startingLives);
    assert.equal(game.lives.deathCount, beforeDeaths + 1);
  } finally { game.dispose(); }
});


test('boss spawns and starts its theme only when the player enters the arena', () => {
  const game = createGameRuntime({ audioEnabled: false });
  const started = [];
  const off = game.events.on('boss.started', event => started.push(event));
  try {
    game.progression.unlockAllLevels();
    const level = game.startLevel(3);
    assert.equal(game.world.encounters.getBoss(1), null);
    assert.equal(started.length, 0);
    game.player.x = level.boss.arena.x - game.player.width - 1;
    game.world.update(1 / 60, game.state, game.events, {});
    assert.equal(game.world.encounters.getBoss(1), null);
    assert.equal(started.length, 0);
    game.player.x = level.boss.arena.x;
    game.world.update(1 / 60, game.state, game.events, {});
    assert.ok(game.world.encounters.getBoss(1));
    assert.equal(started.length, 1);
  } finally { off?.(); game.dispose(); }
});

test('boss-level save before arena entry restores without starting the encounter', async () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    game.startLevel(3);
    const save = game.saves.createSave();
    const result = await game.saves.loadSave(JSON.stringify(save));
    assert.equal(result.loaded, true, result.errors?.join('; '));
    assert.equal(game.world.encounters.getBoss(1), null);
  } finally { game.dispose(); }
});


test('loading an active level does not require it to be unlocked in the destination runtime', async () => {
  const source = createGameRuntime({ audioEnabled: false });
  const target = createGameRuntime({ audioEnabled: false });
  try {
    source.progression.unlockAllLevels();
    source.startLevel(3);
    const save = source.saves.createSave();
    assert.deepEqual(target.progression.unlockedLevels, [1]);
    const result = await target.saves.loadSave(JSON.stringify(save));
    assert.equal(result.loaded, true, result.errors?.join('; '));
    assert.equal(target.world.level.number, 3);
  } finally { source.dispose(); target.dispose(); }
});
