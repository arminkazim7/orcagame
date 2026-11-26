import { EventBus } from '../../src/event-bus.js';
import { EncounterSystem, BOSS_DEFS } from '../../src/enemies/index.js';
const events = new EventBus();
const encounters = new EncounterSystem(events);
const { spawnEnemies, updateEnemies, spawnBoss, damageBoss, damageEnemy, updateBoss,
  isBossDefeated, clearEnemies, configure, renderEnemies, serializeEncounter } = encounters;

function fakePlayer(props = {}) {
  return {
    x: 500, y: 300, w: 20, h: 30, vy: 0,
    getBounds() { return this; },
    isInvulnerable() { return !!this.invulnerable; },
    ...props,
  };
}

function world(overrides = {}) {
  return {
    player: fakePlayer(),
    platforms: [{ x: 0, y: 400, w: 600, h: 20 }],
    playerProjectiles: [],
    bounds: { w: 800, h: 600 },
    gravity: 1200,
    ...overrides,
  };
}

test('hard mode spawns more enemies than easy', () => {
  clearEnemies();
  const opts = { level: 5, platforms: [{ x: 0, y: 400, w: 600, h: 20 }] };
  const easy = spawnEnemies({ ...opts, difficulty: 'easy' });
  clearEnemies();
  const hard = spawnEnemies({ ...opts, difficulty: 'hard' });
  assert.ok(hard.length > easy.length, `hard (${hard.length}) must exceed easy (${easy.length})`);
});

test('hard boss health is exactly twice easy boss health, for all five worlds', () => {
  for (const w of [1, 2, 3, 4, 5]) {
    clearEnemies();
    const easy = spawnBoss({ world: w, difficulty: 'easy', arena: { x: 0, y: 400, w: 800, h: 400 } });
    const easyHp = easy.maxHealth;
    clearEnemies();
    const hard = spawnBoss({ world: w, difficulty: 'hard', arena: { x: 0, y: 400, w: 800, h: 400 } });
    assert.equal(hard.maxHealth, easyHp * 2, `world ${w}`);
  }
});

test('bosses exist for all five worlds with unique names/shapes/patterns', async () => {
  
  const shapes = new Set(), patterns = new Set();
  for (const w of [1, 2, 3, 4, 5]) {
    assert.ok(BOSS_DEFS[w], `world ${w} boss missing`);
    shapes.add(BOSS_DEFS[w].shape);
    patterns.add(BOSS_DEFS[w].pattern);
  }
  assert.equal(shapes.size, 5);
  assert.equal(patterns.size, 5);
});

test('walker patrols and turns at boundaries', () => {
  clearEnemies();
  const plat = { x: 100, y: 400, w: 200, h: 20 };
  const [e] = spawnEnemies({
    level: 1, difficulty: 'easy',
    platforms: [plat], rng: () => 0, // deterministic: type = walker at x = plat.x + 20
  });
  assert.equal(e.type, 'walker');
  e.x = e.patrolMin; e.dir = -1;
  const w = world();
  updateEnemies(0.016, w);
  assert.equal(e.dir, 1, 'must flip direction at left boundary');
  e.x = e.patrolMax - e.w; e.dir = 1;
  updateEnemies(0.016, w);
  assert.equal(e.dir, -1, 'must flip direction at right boundary');
});

test('player projectile damages and defeats an enemy, emitting events', () => {
  clearEnemies();
  const fired = [];
  events.on('enemy.defeated', fired.push.bind(fired));
  const [e] = spawnEnemies({ level: 1, difficulty: 'easy', platforms: [{ x: 0, y: 400, w: 600, h: 20 }], rng: () => 0 });
  damageEnemy(e, 1, { source: 'test' });
  assert.equal(e.dead, false, '2 HP enemy survives one hit');
  damageEnemy(e, 1, { source: 'test' });
  assert.equal(e.dead, true);
  assert.equal(fired.length, 1);
  assert.equal(serializeEncounter().particles.length > 0, true, 'defeat spawns particle effect');
});

test('contact damage emits player:damaged to progression', () => {
  clearEnemies();
  configure({ contactGrace: 0 });
  const damaged = [];
  events.on('player.damaged', d => damaged.push(d));
  const [e] = spawnEnemies({ level: 1, difficulty: 'easy', platforms: [{ x: 0, y: 400, w: 600, h: 20 }], rng: () => 0 });
  const w = world({ player: fakePlayer({ x: e.x, y: e.y, w: 20, h: 30 }) });
  updateEnemies(0.016, w);
  assert.equal(damaged.length, 1);
  assert.equal(damaged[0].source, 'contact');
});

test('invulnerable player (power-up protection) takes no contact damage', () => {
  clearEnemies();
  configure({ contactGrace: 0 });
  const damaged = [];
  events.on('player.damaged', d => damaged.push(d));
  const [e] = spawnEnemies({ level: 1, difficulty: 'easy', platforms: [{ x: 0, y: 400, w: 600, h: 20 }], rng: () => 0 });
  const w = world({ player: fakePlayer({ x: e.x, y: e.y, w: 20, h: 30, invulnerable: true }) });
  updateEnemies(0.016, w);
  assert.equal(damaged.length, 0);
});

test('stomp defeats a grounded enemy and emits enemy:stomped', () => {
  clearEnemies();
  configure({ stompEnabled: true, contactGrace: 0 });
  const stomps = [];
  events.on('enemy:stomped', stomps.push.bind(stomps));
  const [e] = spawnEnemies({ level: 1, difficulty: 'easy', platforms: [{ x: 0, y: 400, w: 600, h: 20 }], rng: () => 0 });
  const w = world({ player: fakePlayer({ x: e.x, y: e.y - 20, w: 20, h: 30, vy: 300 }) });
  updateEnemies(0.016, w);
  assert.equal(e.dead, true);
  assert.equal(stomps.length, 1);
});

test('boss takes player-projectile damage and full defeat flow works', () => {
  clearEnemies();
  const damaging = [], defeating = [], defeated = [];
  events.on('boss:damaged', damaging.push.bind(damaging));
  events.on('boss:defeating', defeating.push.bind(defeating));
  events.on('boss:defeated', defeated.push.bind(defeated));

  const boss = spawnBoss({ world: 1, difficulty: 'easy', arena: { x: 0, y: 400, w: 800, h: 400 } });
  const maxHp = boss.maxHealth;
  damageBoss(boss, maxHp);
  assert.equal(boss.health, 0);
  assert.ok(isBossDefeated(1));
  assert.equal(defeating.length, 1);
  assert.equal(defeated.length, 0, 'defeat event waits for the animation');

  updateBoss(2.0, world()); // run past the defeat animation
  assert.equal(defeated.length, 1);
});

test('player projectiles hit the boss', () => {
  clearEnemies();
  const boss = spawnBoss({ world: 2, difficulty: 'easy', arena: { x: 0, y: 400, w: 800, h: 400 } });
  const before = boss.health;
  updateBoss(0.016, world({
    playerProjectiles: [{ x: boss.x + boss.w / 2, y: boss.y + boss.h / 2, radius: 5, damage: 3, consumed: false }],
  }));
  assert.equal(boss.health, before - 3);
});

test('boss attack pattern fires enemy projectiles; phase 2 accelerates', () => {
  clearEnemies();
  const boss = spawnBoss({ world: 2, difficulty: 'easy', arena: { x: 0, y: 400, w: 800, h: 400 } });
  const w = world();
  updateBoss(5, w); // far longer than the attack interval
  assert.ok(serializeEncounter().projectiles.length > 0, 'Frost Sentinel spread shot must fire');

  damageBoss(boss, boss.maxHealth * 0.75); // drop to 25% -> phase 2
  assert.equal(boss.phase, 2);
});

test('clearEnemies resets everything', () => {
  clearEnemies();
  spawnEnemies({ level: 9, difficulty: 'hard', platforms: [{ x: 0, y: 400, w: 600, h: 20 }] });
  spawnBoss({ world: 5, difficulty: 'hard', arena: { x: 0, y: 400, w: 800, h: 400 } });
  clearEnemies();
  const s = serializeEncounter();
  assert.equal(s.enemies.length, 0);
  assert.equal(s.projectiles.length, 0);
  assert.equal(s.bosses.size, 0);
  assert.equal(s.activeBossWorld, null);
});


test('regular enemy contact damage is active for walker, flyer, and shooter types',()=>{clearEnemies();configure({contactGrace:0});for(const type of ['walker','flyer','shooter']){const [e]=spawnEnemies({level:6,difficulty:'easy',platforms:[{x:0,y:400,w:600,h:20}],rng:()=>0});e.type=type;e.x=200;e.y=300;e.speed=0;e.vy=0;e.touchCooldown=0;const hits=[];const off=events.on('player.damaged',d=>hits.push(d));updateEnemies(0.016,world({player:fakePlayer({x:e.x,y:e.y,w:e.w,h:e.h})}));off?.();assert.ok(hits.some(d=>d.enemyType===type),type+' contact damage expected');clearEnemies();}});

test('renderEnemies draws without a camera argument and with a boss health bar', () => {
  clearEnemies();
  const calls = [];
  const ctx = new Proxy({ canvas: { width: 960, height: 540 } }, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); }),
    set: (t, k, v) => { t[k] = v; return true; }
  });
  spawnEnemies({ level: 1, difficulty: 'easy', platforms: [{ x: 0, y: 400, w: 600, h: 20 }], rng: () => 0 });
  spawnBoss({ world: 1, difficulty: 'easy', arena: { x: 0, y: 400, w: 800, h: 400 } });
  assert.doesNotThrow(() => renderEnemies(ctx));
  assert.doesNotThrow(() => renderEnemies(ctx, { x: 120, y: 30 }));
  assert.ok(calls.includes('fillText'), 'boss health bar label drawn');
  clearEnemies();
});


test('two encounter instances keep entities, bosses, events and ids isolated', () => {
  const busA = new EventBus(), busB = new EventBus();
  const a = new EncounterSystem(busA, { rng: () => 0 });
  const b = new EncounterSystem(busB, { rng: () => 0 });
  const receivedA = [], receivedB = [];
  busA.on('enemy.defeated', event => receivedA.push(event));
  busB.on('enemy.defeated', event => receivedB.push(event));
  const platform = [{ x: 0, y: 400, w: 600, h: 20 }];
  const [enemyA] = a.spawnEnemies({ level: 1, difficulty: 'easy', platforms: platform, rng: () => 0 });
  const [enemyB] = b.spawnEnemies({ level: 1, difficulty: 'easy', platforms: platform, rng: () => 0 });
  assert.equal(enemyA.id, enemyB.id);
  a.damageEnemy(enemyA, 2);
  assert.equal(receivedA.length, 1);
  assert.equal(receivedB.length, 0);
  assert.equal(b.getEnemiesForCollision()[0].dead, false);
  a.clearEnemies();
  assert.equal(b.getEnemiesForCollision().length, 1);
});
