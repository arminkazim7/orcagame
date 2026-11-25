import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, LEVELS } from '../../src/worlds/levels.js';
import { createGameRuntime } from '../../src/main.js';
import { getBoss, damageBoss, clearEnemies, _getState as getEnemyState } from '../../src/enemies/index.js';

test('campaign contains fifteen valid layouts across five worlds', () => {
  assert.equal(LEVELS.length, 15);
  assert.deepEqual(LEVELS.map(level => level.worldIndex), [
    1,1,1,2,2,2,3,3,3,4,4,4,5,5,5
  ]);
  for (const level of LEVELS) {
    assert.ok(level.platforms.length >= 9);
    assert.ok(level.platforms.some(platform => platform.id === 'seafloor'));
    assert.ok(level.exit.x > level.start.x);
    assert.equal(level.width, 4800);
  }
});

test('each third level has the matching world boss arena', () => {
  for (const number of [3,6,9,12,15]) {
    const level = createLevel(number);
    assert.ok(level.boss);
    assert.equal(level.boss.world, Math.ceil(number / 3));
    assert.equal(level.boss.id, level.world.bossId);
    assert.ok(level.boss.arena.w > 0);
  }
  for (const number of [1,2,4,5,7,8,10,11,13,14]) {
    assert.equal(createLevel(number).boss, null);
  }
});

test('invalid campaign level numbers are rejected', () => {
  assert.throws(() => createLevel(0), RangeError);
  assert.throws(() => createLevel(16), RangeError);
});

test('runtime starts a level, spawns enemies and creates the configured boss', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    const level = game.startLevel(3);
    assert.equal(level.number, 3);
    assert.equal(game.state.status, 'playing');
    assert.equal(game.player.x, level.start.x);
    assert.ok(game.world.level);
    assert.ok(getBoss(1));
    assert.ok(game.input.setControl('left', true));
    assert.equal(game.input.isDown('ArrowLeft'), true);
    assert.equal(game.input.isDown('KeyA'), true);
    game.input.setControl('dropThrough', true);
    assert.equal(game.input.isDown('ArrowDown'), true);
    assert.equal(game.input.isDown('Space'), true);
  } finally {
    game.dispose();
    clearEnemies();
  }
});

test('boss defeat bridges the configured campaign boss ID into progression', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    game.startLevel(3);
    assert.ok(damageBoss(1, 10000));
    game.world.update(1.5, game.state, game.events, game.input);
    assert.ok(game.progression.defeatedBosses.includes('coral-warden'));
    assert.equal(game.state.status, 'victory');
  } finally {
    game.dispose();
    clearEnemies();
  }
});

test('player horizontal movement is blocked by live enemy colliders', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.startLevel(1);
    const enemy = getEnemyState().enemies[0];
    assert.ok(enemy, 'level should spawn at least one enemy');
    enemy.x = game.player.x + game.player.width + 4;
    enemy.y = game.player.y;
    enemy.speed = 0;
    enemy.vy = 0;
    enemy.patrolMin = enemy.x;
    enemy.patrolMax = enemy.x + enemy.w;
    game.input.setControl('right', true);
    for (let i = 0; i < 10; i++) game.world.update(1 / 60, game.state, game.events, game.input);
    assert.ok(game.player.x + game.player.width <= enemy.x + 0.01, 'player should stop at enemy left edge');
  } finally { game.dispose(); clearEnemies(); }
});


test('enemy contact damage deducts a life through the runtime event bridge',()=>{const game=createGameRuntime({audioEnabled:false});try{game.startLevel(1);const enemy=getEnemyState().enemies[0];enemy.speed=0;enemy.vy=0;enemy.touchCooldown=0;game.player.setInvulnerable(0);enemy.x=game.player.x;enemy.y=game.player.y;enemy.patrolMin=enemy.x;enemy.patrolMax=enemy.x+enemy.w;const before=game.lives.getLives();game.world.update(1/60,game.state,game.events,game.input);assert.equal(game.lives.getLives(),before-1);assert.ok(game.player.invulnerabilityMs>0);}finally{game.dispose();clearEnemies();}});
