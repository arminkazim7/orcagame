import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevel, LEVELS } from '../../src/worlds/levels.js';
import { GAME_CONFIG } from '../../src/game-config.js';
import { createGameRuntime } from '../../src/main.js';
import { BOSS_DEFS } from '../../src/enemies/bosses.js';

test('level two opening platform is within a comfortable jump from the starting floor', () => {
  const level = createLevel(2);
  const startFloor = level.platforms.find(platform => platform.id === 'lagoon-start');
  const firstPlatform = level.platforms.find(platform => platform.id === 'bubble-step');
  const maxJumpHeight = (570 * 570) / (2 * GAME_CONFIG.physics.gravity);
  assert.ok(firstPlatform.y < startFloor.y, 'opening platform should be elevated');
  assert.ok(startFloor.y - firstPlatform.y <= maxJumpHeight - 25,
    'opening platform should leave a safety margin below the orca jump apex');
  assert.ok(firstPlatform.x < startFloor.x + startFloor.w,
    'opening platform should be horizontally reachable from the starting floor');
});


test('all authored platforms in all fifteen levels are reachable by a safe jump chain', () => {
  const jumpVelocity = 570;
  const moveSpeed = 250;
  const acceleration = 1800;
  const accelerationTime = moveSpeed / acceleration;
  const gravity = GAME_CONFIG.physics.gravity;
  const playerWidth = 66;
  const maxRise = jumpVelocity ** 2 / (2 * gravity) - 15;
  for (const level of LEVELS) {
    const platforms = level.platforms;
    const start = platforms.findIndex(platform => !platform.oneWay && platform.x === 0);
    assert.notEqual(start, -1, `level ${level.number} needs a starting floor`);
    const reachable = new Set([start]);
    const queue = [start];
    const canJump = (from, to) => {
      const rise = from.y - to.y;
      if (rise > maxRise) return false;
      const flightTime = (jumpVelocity + Math.sqrt(jumpVelocity ** 2 - 2 * gravity * rise)) / gravity;
      const horizontalTravel = flightTime <= accelerationTime
        ? 0.5 * acceleration * flightTime ** 2
        : 0.5 * acceleration * accelerationTime ** 2 + moveSpeed * (flightTime - accelerationTime);
      const horizontalGap = Math.max(0, to.x - (from.x + from.w), from.x - (to.x + to.w));
      return horizontalGap <= horizontalTravel + playerWidth - 20;
    };
    for (let index = 0; index < queue.length; index++) {
      const from = platforms[queue[index]];
      for (let next = 0; next < platforms.length; next++) {
        if (!reachable.has(next) && canJump(from, platforms[next])) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    const floors = platforms.filter(platform => !platform.oneWay).sort((a, b) => a.x - b.x);
    assert.ok(floors.every((floor, index) => index === 0 || floor.x - (floors[index - 1].x + floors[index - 1].w) <= 160),
      `level ${level.number} has an excessive floor gap`);
    assert.equal(floors.at(-1).x + floors.at(-1).w, level.width,
      `level ${level.number} must have floor support through its exit`);
    assert.equal(reachable.size, platforms.length,
      `level ${level.number} has unreachable platforms: ${platforms.filter((_, i) => !reachable.has(i)).map(p => p.id).join(', ')}`);
  }
});

test('level catalogue is deeply immutable and runtime levels have independent data and pickup state', () => {
  assert.ok(Object.isFrozen(LEVELS));
  assert.ok(Object.isFrozen(LEVELS[0]));
  assert.ok(Object.isFrozen(LEVELS[0].platforms));
  assert.ok(Object.isFrozen(LEVELS[0].platforms[0]));
  assert.ok(Object.isFrozen(LEVELS[0].collectibles));
  const first = createLevel(1);
  const second = createLevel(1);
  assert.notEqual(first.platforms, second.platforms);
  assert.notEqual(first.collectibles, second.collectibles);
  assert.equal(Object.hasOwn(first.collectibles[0], 'collected'), false);
  first.collectibles[0].x += 100;
  assert.notEqual(first.collectibles[0].x, second.collectibles[0].x);
  assert.notEqual(first.collectibles[0].x, LEVELS[0].collectibles[0].x);
});


test('camera bounds use logical viewport size rather than canvas backing-store dimensions', () => {
  const game = createGameRuntime({ canvas: { width: 4096, height: 2160 }, audioEnabled: false });
  try {
    const level = game.startLevel(1);
    game.player.x = level.width - game.player.width;
    game.player.y = level.start.y;
    game.world.update(1 / 60, game.state, game.events, game.input);
    assert.equal(game.world.cameraX, level.width - GAME_CONFIG.canvas.width);
    assert.equal(game.world.cameraY, 0, 'side-scrolling levels should keep the ground near the viewport bottom');
  } finally {
    game.dispose();
    game.world.encounters.clearEnemies();
  }
});

test('level world height and camera viewport are independent of canvas backing-store size', () => {
  const level = createLevel(1);
  assert.equal(level.height, GAME_CONFIG.physics.worldHeight);
  assert.notEqual(level.height, GAME_CONFIG.canvas.height);
  assert.equal(GAME_CONFIG.physics.worldHeight, 840);
});

test('campaign contains fifteen valid layouts across five worlds', () => {
  assert.equal(LEVELS.length, 15);
  assert.deepEqual(LEVELS.map(level => level.worldIndex), [
    1,1,1,2,2,2,3,3,3,4,4,4,5,5,5
  ]);
  for (const level of LEVELS) {
    assert.ok(level.platforms.length >= 12);
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


test('boss identity, display name and world association share one canonical ID', () => {
  const expected = [
    ['coral-warden', 'Coral Warden', 'coral-coast'],
    ['ruin-colossus', 'Ruin Colossus', 'sunken-ruins'],
    ['abyss-emperor', 'Abyss Emperor', 'deep-sea-trench'],
    ['kelp-guardian', 'Kelp Guardian', 'kelp-forest'],
    ['ice-leviathan', 'Ice Leviathan', 'arctic-ice-shelf']
  ];
  for (const [id, name, worldId] of expected) {
    const definition = BOSS_DEFS[id];
    const world = LEVELS.find(level => level.world.id === worldId).world;
    assert.equal(definition.id, id);
    assert.equal(definition.name, name);
    assert.equal(world.bossId, id);
    assert.equal(definition.world, world.levels[0] === 1 ? 1 : Math.ceil(world.levels[0] / 3));
  }
  assert.equal(Object.keys(BOSS_DEFS).length, 5);
});

test('invalid campaign level numbers are rejected', () => {
  assert.throws(() => createLevel(0), RangeError);
  assert.throws(() => createLevel(16), RangeError);
});

test('runtime starts a level, spawns enemies and creates the configured boss', () => {
  const game = createGameRuntime({ audioEnabled: false });
  const started = [];
  const offStarted = game.events.on('boss.started', event => started.push(event));
  try {
    game.progression.unlockAllLevels();
    const level = game.startLevel(3);
    assert.equal(level.number, 3);
    assert.equal(game.state.status, 'playing');
    assert.equal(game.player.x, level.start.x);
    assert.ok(game.world.level);
    game.player.x = level.boss.arena.x;
    game.player.y = level.boss.arena.y - game.player.height;
    game.world.update(1 / 60, game.state, game.events, game.input);
    assert.ok(game.world.encounters.getBoss('coral-warden'));
    assert.equal(started.length, 1);
    assert.equal(started[0].bossId, 'coral-warden');
    assert.equal(game.world.encounters.getBoss(1), null, 'world numbers are not boss identifiers');
    assert.equal(game.world.encounters.damageBoss(1, 10000), false, 'damage requires the canonical boss ID');
    assert.ok(game.input.setControl('left', true));
    assert.equal(game.input.isDown('ArrowLeft'), true);
    assert.equal(game.input.isDown('KeyA'), true);
    game.input.setControl('dropThrough', true);
    assert.equal(game.input.isDown('ArrowDown'), true);
    assert.equal(game.input.isDown('Space'), true);
  } finally {
    offStarted();
    game.dispose();
    game.world.encounters.clearEnemies();
  }
});

test('boss defeat bridges the configured campaign boss ID into progression', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    game.progression.unlockAllLevels();
    const level = game.startLevel(3);
    game.player.x = level.boss.arena.x;
    game.player.y = level.boss.arena.y - game.player.height;
    game.world.update(1 / 60, game.state, game.events, game.input);
    assert.ok(game.world.encounters.damageBoss('coral-warden', 10000));
    game.world.update(1.5, game.state, game.events, game.input);
    assert.ok(game.progression.defeatedBosses.includes('coral-warden'));
    assert.equal(game.state.status, 'victory');
  } finally {
    game.dispose();
    game.world.encounters.clearEnemies();
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
  } finally { game.dispose(); game.world.encounters.clearEnemies(); }
});


test('enemy contact damage deducts a life through the runtime event bridge',()=>{const game=createGameRuntime({audioEnabled:false});try{game.startLevel(1);const enemy=game.world.encounters.getEnemiesForCollision()[0];enemy.speed=0;enemy.vy=0;enemy.touchCooldown=0;game.player.setInvulnerable(0);enemy.x=game.player.x;enemy.y=game.player.y;enemy.patrolMin=enemy.x;enemy.patrolMax=enemy.x+enemy.w;const before=game.lives.getLives();game.world.update(1/60,game.state,game.events,game.input);assert.equal(game.lives.getLives(),before-1);assert.ok(game.player.invulnerabilityMs>0);}finally{game.dispose();game.world.encounters.clearEnemies();}});

test('each campaign level contains one unique badge collectible',()=>{for(let n=1;n<=15;n++){const level=createLevel(n);const badges=level.collectibles.filter(i=>i.type==='badge');assert.equal(badges.length,1);assert.equal(badges[0].badgeId,n);assert.equal(badges[0].id,'badge-'+n);assert.ok(level.platforms.some(p=>badges[0].x>=p.x&&badges[0].x+30<=p.x+p.w));}});

test('badge pickup is stored in runtime profile even without a UI',()=>{const game=createGameRuntime({audioEnabled:false});try{game.startLevel(1);const badge=game.world.level.collectibles.find(i=>i.type==='badge');game.player.setInvulnerable(0);game.player.x=badge.x;game.player.y=badge.y;game.player.vx=0;game.player.vy=0;game.world.update(1/60,game.state,game.events,game.input);assert.ok(game.profile.badges.includes(1));assert.equal(game.world.collectibleState.has(badge.id),true);
assert.equal(Object.hasOwn(badge,'collected'),false);}finally{game.dispose();game.world.encounters.clearEnemies();}});

test('combat events are normalized on shared bus and progression reacts once',()=>{
 const game=createGameRuntime({audioEnabled:false});const seen={damage:[],enemy:[],boss:[]};
 const offs=[game.events.on('player.damaged',p=>seen.damage.push(p)),game.events.on('enemy.defeated',p=>seen.enemy.push(p)),game.events.on('boss.defeated',p=>seen.boss.push(p))];
 try{
  game.startLevel(1);const enemy=game.world.encounters.getEnemiesForCollision()[0];enemy.speed=0;enemy.vy=0;enemy.touchCooldown=0;enemy.x=game.player.x;enemy.y=game.player.y;enemy.patrolMin=enemy.x;enemy.patrolMax=enemy.x+enemy.w;game.player.setInvulnerable(0);const lives=game.lives.getLives();game.world.update(1/60,game.state,game.events,game.input);
  assert.equal(seen.damage.length,1);assert.equal(game.lives.getLives(),lives-1);assert.equal(seen.damage[0].source,'contact');assert.equal(seen.damage[0].applied,true);
  game.progression.unlockAllLevels();const level=game.startLevel(3);game.player.x=level.boss.arena.x;game.player.y=level.boss.arena.y-game.player.height;game.world.update(1/60,game.state,game.events,game.input);const boss=game.world.encounters.getBoss('coral-warden');assert.ok(boss);game.world.encounters.damageBoss('coral-warden',boss.maxHealth);game.world.update(1.5,game.state,game.events,game.input);assert.equal(seen.boss.length,1);assert.equal(seen.boss[0].bossId,'coral-warden');assert.ok(game.progression.defeatedBosses.includes('coral-warden'));
 }finally{offs.forEach(off=>off());game.dispose();game.world.encounters.clearEnemies();}
});


test('runtime uses authored enemy spawn positions rather than cycling across platforms', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    const level = game.startLevel(1);
    const enemies = game.world.encounters.getEnemiesForCollision();
    assert.equal(enemies.length, 4);
    for (let i = 0; i < level.enemySpawnPoints.length; i++) {
      assert.equal(enemies[i].x, level.enemySpawnPoints[i].x);
      assert.equal(enemies[i].y, level.enemySpawnPoints[i].y);
    }
  } finally { game.dispose(); game.world.encounters.clearEnemies(); }
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
  } finally { game.dispose(); game.world.encounters.clearEnemies(); }
});
 
test('void falls bypass invulnerability and respawn safely in every campaign level', () => {
  const game = createGameRuntime({ audioEnabled: false });
  try {
    for (let number = 1; number <= 15; number++) {
      const level = game.startLevel(number);
      const before = game.lives.getLives();
      // Simulate a fall while the player still has spawn/respawn protection.
      game.player.setInvulnerable(5000);
      game.player.x = 150;
      game.player.y = GAME_CONFIG.physics.groundY + 130;
      game.player.vx = 0;
      game.player.vy = 0;
      game.world.update(1 / 60, game.state, game.events, game.input);
      assert.equal(game.lives.getLives(), before - 1, `level ${number}: void fall must cost a life despite invulnerability`);
      assert.equal(game.player.x, level.start.x, `level ${number}: respawn should return to level start`);
      assert.equal(game.player.y, GAME_CONFIG.physics.groundY - game.player.height, `level ${number}: respawn should be flush with the starting floor`);
      for (let frame = 0; frame < 120; frame++) game.world.update(1 / 60, game.state, game.events, game.input);
      assert.equal(game.lives.getLives(), before - 1, `level ${number}: safe respawn must not repeatedly fall`);
      assert.ok(game.player.grounded, `level ${number}: player should land on the starting floor`);
    }
  } finally {
    game.dispose();
    game.world.encounters.clearEnemies();
  }
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
  } finally { game.dispose(); game.world.encounters.clearEnemies(); }
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
