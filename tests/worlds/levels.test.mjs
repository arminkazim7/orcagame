import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, LEVELS } from '../../src/worlds/levels.js';
import { createGameRuntime } from '../../src/main.js';

test('campaign contains fifteen valid layouts across five worlds', () => {
  assert.equal(LEVELS.length, 15);
  assert.deepEqual(LEVELS.map(level => level.worldIndex), [
    1,1,1,2,2,2,3,3,3,4,4,4,5,5,5
  ]);
  for (const level of LEVELS) {
    assert.ok(level.platforms.length >= 15);
    const floors = level.platforms.filter(platform => !platform.oneWay);
    assert.ok(floors.length >= 4, 'authored terrain should contain separated floor sections');
    assert.ok(floors.some((floor, i) => i > 0 && floor.x > floors[i - 1].x + floors[i - 1].w), 'floor gaps must be present');
    assert.ok(level.hazards.length >= 2);
    assert.ok(level.decorations.length >= 3);
    assert.ok(level.enemySpawnPoints.length >= 4);
    assert.ok(level.exit.x > level.start.x);
    assert.equal(level.width, 4800);
    assert.ok(level.theme?.style);
  }
  assert.equal(new Set(LEVELS.map(level => JSON.stringify(level.platforms))).size, 15,
    'all fifteen levels must have independently authored terrain');
  assert.equal(new Set(LEVELS.map(level => level.theme.style)).size, 5,
    'the five worlds must use five distinct rendering themes');
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
    assert.ok(game.world.encounters.getBoss(1));
    assert.ok(game.input.setControl('left', true));
    assert.equal(game.input.isDown('ArrowLeft'), true);
    assert.equal(game.input.isDown('KeyA'), true);
    game.input.setControl('dropThrough', true);
    assert.equal(game.input.isDown('ArrowDown'), true);
    assert.equal(game.input.isDown('Space'), true);
  } finally {
    game.dispose();
    game.world.encounters.clearEnemies();
  }
});

test('boss defeat bridges the configured campaign boss ID into progression', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    game.startLevel(3);
    assert.ok(game.world.encounters.damageBoss(1, 10000));
    game.world.update(1.5, game.state, game.events, game.input);
    assert.ok(game.progression.defeatedBosses.includes('boss-w1'));
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
    const enemy = game.world.encounters.getEnemiesForCollision()[0];
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


test('enemy contact damage deducts a life through the runtime event bridge',()=>{const game=createGameRuntime({audioEnabled:false});try{game.startLevel(1);const enemy=game.world.encounters.getEnemiesForCollision()[0];enemy.speed=0;enemy.vy=0;enemy.touchCooldown=0;game.player.setInvulnerable(0);enemy.x=game.player.x;enemy.y=game.player.y;enemy.patrolMin=enemy.x;enemy.patrolMax=enemy.x+enemy.w;const before=game.lives.getLives();game.world.update(1/60,game.state,game.events,game.input);assert.equal(game.lives.getLives(),before-1);assert.ok(game.player.invulnerabilityMs>0);}finally{game.dispose();clearEnemies();}});

test('each campaign level contains one unique badge collectible',()=>{for(let n=1;n<=15;n++){const level=createLevel(n);const badges=level.collectibles.filter(i=>i.type==='badge');assert.equal(badges.length,1);assert.equal(badges[0].badgeId,n);assert.equal(badges[0].id,'badge-'+n);assert.ok(level.platforms.some(p=>badges[0].x>=p.x&&badges[0].x+30<=p.x+p.w));}});

test('badge pickup is stored in runtime profile even without a UI',()=>{const game=createGameRuntime({audioEnabled:false});try{game.startLevel(1);const badge=game.world.level.collectibles.find(i=>i.type==='badge');game.player.setInvulnerable(0);game.player.x=badge.x;game.player.y=badge.y;game.player.vx=0;game.player.vy=0;game.world.update(1/60,game.state,game.events,game.input);assert.ok(game.profile.badges.includes(1));assert.equal(badge.collected,true);}finally{game.dispose();clearEnemies();}});

test('combat events are normalized on shared bus and progression reacts once',()=>{
 const game=createGameRuntime({audioEnabled:false});const seen={damage:[],enemy:[],boss:[]};
 const offs=[game.events.on('player.damaged',p=>seen.damage.push(p)),game.events.on('enemy.defeated',p=>seen.enemy.push(p)),game.events.on('boss.defeated',p=>seen.boss.push(p))];
 try{
  game.startLevel(1);const enemy=getEnemyState().enemies[0];enemy.speed=0;enemy.vy=0;enemy.touchCooldown=0;enemy.x=game.player.x;enemy.y=game.player.y;enemy.patrolMin=enemy.x;enemy.patrolMax=enemy.x+enemy.w;game.player.setInvulnerable(0);const lives=game.lives.getLives();game.world.update(1/60,game.state,game.events,game.input);
  assert.equal(seen.damage.length,1);assert.equal(game.lives.getLives(),lives-1);assert.equal(seen.damage[0].source,'contact');assert.equal(seen.damage[0].applied,true);
  game.progression.unlockAllLevels();game.startLevel(3);const boss=getBoss(1);assert.ok(boss);game.world.encounters.damageBoss(1,boss.maxHealth);game.world.update(1.5,game.state,game.events,game.input);assert.equal(seen.boss.length,1);assert.equal(seen.boss[0].bossId,'boss-w1');assert.ok(game.progression.defeatedBosses.includes('boss-w1'));
 }finally{offs.forEach(off=>off());game.dispose();clearEnemies();}
});


test('runtime uses authored enemy spawn positions rather than cycling across platforms', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    const level = game.startLevel(1);
    const enemies = getEnemyState().enemies;
    assert.equal(enemies.length, 4);
    for (let i = 0; i < level.enemySpawnPoints.length; i++) {
      assert.equal(enemies[i].x, level.enemySpawnPoints[i].x);
      assert.equal(enemies[i].y, level.enemySpawnPoints[i].y);
    }
  } finally { game.dispose(); clearEnemies(); }
});

test('falling through an authored terrain gap costs a life and respawns safely', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    const level = game.startLevel(1);
    const before = game.lives.getLives();
    game.player.setInvulnerable(0);
    game.player.y = level.height + 100;
    game.player.vy = 0;
    game.world.update(1 / 60, game.state, game.events, game.input);
    assert.equal(game.lives.getLives(), before - 1);
    assert.equal(game.player.x, level.start.x);
    assert.ok(game.player.y < level.height);
    assert.ok(game.player.invulnerabilityMs > 0);
  } finally { game.dispose(); clearEnemies(); }
});

test('authored hazards apply combat damage through the shared event bus', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    const level = game.startLevel(1);
    const hazard = level.hazards[0];
    const before = game.lives.getLives();
    game.player.setInvulnerable(0);
    game.player.x = hazard.x;
    game.player.y = hazard.y;
    game.player.vx = 0;
    game.player.vy = 0;
    game.world.update(1 / 60, game.state, game.events, game.input);
    assert.equal(game.lives.getLives(), before - 1);
  } finally { game.dispose(); clearEnemies(); }
});


test('authored checkpoints are placed on reachable support surfaces', () => {
  for (const level of LEVELS) {
    const checkpoint = level.collectibles.find(item => item.type === 'checkpoint');
    assert.ok(checkpoint);
    const support = level.platforms.find(platform =>
      checkpoint.x >= platform.x && checkpoint.x + 30 <= platform.x + platform.w &&
      Math.abs((checkpoint.y + 15) - platform.y) <= 0.01
    );
    assert.ok(support, `level ${level.number} checkpoint should align with a platform top`);
  }
});
