import test from 'node:test';
import assert from 'node:assert/strict';
import { Orca, VICTORY_ANIMATIONS, OrcaAnimation, OrcaPhysics, Projectiles } from '../../src/player/index.js';

const step = (orca, input, platforms, n = 1, dt = 1 / 60) => {
  for (let i = 0; i < n; i++) orca.update(dt, input, platforms);
};

test('orca has an anatomically specified, leg-free body size and customizable name/color', () => {
  const o = new Orca();
  assert.equal(o.width, 66); assert.equal(o.height, 43);
  assert.deepEqual(o.customize({ name: 'Nori', color: 'teal' }), { name: 'Nori', color: 'teal' });
  assert.equal(o.name, 'Nori'); assert.equal(o.color, 'teal');
});

test('left/right controls accelerate and set facing', () => {
  const o = new Orca();
  step(o, { ArrowRight: true }, [], 8);
  assert.ok(o.x > 80); assert.equal(o.facing, 1);
  step(o, { KeyA: true }, [], 8);
  assert.equal(o.facing, -1);
});

test('jump fires once, gravity returns orca to solid platform', () => {
  let jumps = 0;
  const o = new Orca({ onEvent: name => { if (name === 'player.jump') jumps++; } });
  const ground = [{ x: 0, y: 220, width: 500, height: 40 }];
  o.y = 177; o.grounded = true;
  step(o, { Space: true }, ground, 1);
  assert.ok(o.vy < 0); assert.equal(jumps, 1);
  step(o, {}, ground, 100);
  assert.equal(o.grounded, true); assert.equal(o.y, 220 - o.height);
});

test('one-way platform allows upward passage and landing from above', () => {
  const o = new Orca(); const platform = [{ x: 0, y: 180, width: 300, height: 12, oneWay: true }];
  o.x = 30; o.y = 220; o.vy = -600;
  step(o, {}, platform, 20);
  assert.ok(o.y + o.height < 180, 'orca should pass upward through platform');
  o.vy = 400;
  step(o, {}, platform, 60);
  assert.equal(o.grounded, true); assert.equal(o.y, 180 - o.height);
});

test('Down+Jump drops through one-way platform without emitting jump', () => {
  let jumps = 0, drops = 0;
  const o = new Orca({ onEvent: name => { if (name === 'player.jump') jumps++; if (name === 'player.dropThrough') drops++; } });
  const platform = [{ x: 0, y: 200, width: 300, height: 10, oneWay: true }];
  o.y = 200 - o.height; o.grounded = true;
  step(o, { ArrowDown: true, Space: true }, platform, 1);
  assert.equal(drops, 1); assert.equal(jumps, 0); assert.ok(o.vy > 0);
});

test('solid platform blocks horizontal traversal and head collision', () => {
  const physics = new OrcaPhysics(); const o = new Orca();
  o.x = 0; o.y = 100; o.vx = 300;
  physics.update(o, 1 / 30, {}, [{ x: 70, y: 80, width: 20, height: 150 }]);
  assert.ok(o.x + o.width <= 70.001);
  o.x = 80; o.y = 105; o.vy = -300;
  physics.update(o, 1 / 30, {}, [{ x: 70, y: 80, width: 100, height: 20 }]);
  assert.equal(o.vy, 0); assert.equal(o.y, 100);
});

test('shooting emits projectiles in facing direction and repeated fire is rate limited', () => {
  const o = new Orca();
  assert.ok(o.shoot()); assert.equal(o.projectiles.items.length, 1);
  assert.equal(o.shoot(), null);
  for (let i = 0; i < 8; i++) o.projectiles.update(1 / 30);
  o.facing = -1;
  const p = o.shoot(); assert.ok(p); assert.ok(p.vx < 0);
});

test('Sea Berry, Golden Krill and Bubble Shell hooks set size, jump and one-hit protection', () => {
  const o = new Orca();
  o.applyPowerUp('sea-berry'); assert.equal(o.sizeScale, 1.4); assert.equal(o.jumpScale, 1); assert.equal(o.protectionHits, 1);
  assert.equal(o.takeDamage(), false); assert.equal(o.protectionHits, 0); assert.equal(o.sizeScale, 1);
  o.invulnerabilityMs = 0; o.applyPowerUp('golden-krill'); assert.equal(o.sizeScale, 1.8); assert.equal(o.jumpScale, 1.35);
  o.clearPowerUp(); o.applyPowerUp('bubble-shell'); assert.equal(o.sizeScale, 1); assert.equal(o.jumpScale, 1); assert.equal(o.protectionHits, 1);
});

test('unprotected damage grants temporary invulnerability and knockback', () => {
  const o = new Orca(); assert.equal(o.takeDamage(), true); assert.ok(o.invulnerabilityMs > 0);
  assert.equal(o.takeDamage(), false);
});

test('size and jump properties are independently adjustable and clamped', () => {
  const o = new Orca(); o.setSize(9); o.setJumpStrength(.1);
  assert.equal(o.sizeScale, 2.25); assert.equal(o.jumpScale, .5);
});

test('all 15 named victory moves have distinct live poses and complete', () => {
  assert.equal(VICTORY_ANIMATIONS.length, 15);
  const signatures = new Set();
  for (const name of VICTORY_ANIMATIONS) {
    const a = new OrcaAnimation(); a.trigger(name, 1); a.update(.35);
    const p = a.getVictoryPose();
    assert.equal(p.name, name); assert.ok(p);
    signatures.add([p.rotation.toFixed(2), p.dx.toFixed(2), p.dy.toFixed(2), p.tail.toFixed(2), p.scale.toFixed(2), p.splash, p.rings, p.bubbles].join('|'));
    let completed = null; for (let i = 0; i < 7; i++) completed = a.update(.1) ?? completed; assert.equal(completed, name);
  }
  assert.equal(signatures.size, 15);
});

test('orca exposes named victory animation trigger and completion event', () => {
  const events = []; const o = new Orca({ onEvent: (name, data) => events.push([name, data]) });
  assert.equal(o.triggerVictoryAnimation('grand victory leap', .6), 'grand victory leap');
  step(o, {}, [], 24, .1);
  assert.ok(events.some(([name]) => name === 'player.victoryAnimationStarted'));
  assert.ok(events.some(([name]) => name === 'player.victoryAnimationComplete'));
});

test('projectiles move in world space and are removed outside bounds', () => {
  const p = new Projectiles(); p.items.push({ x: 5, y: 5, vx: -100, radius: 4, alive: true });
  for (let i = 0; i < 4; i++) p.update(1 / 30, { left: 0, right: 100 }); assert.equal(p.items.length, 0);
});
