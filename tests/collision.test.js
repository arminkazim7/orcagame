import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CollisionSystem,
  rectsOverlap,
  getPenetration,
  pointInRect,
  circlesOverlap,
  circleRectOverlap,
} from '../Collision.js';

const rect = (x, y, width, height) => ({ x, y, width, height });

test('rectsOverlap: touching edges do not overlap', () => {
  assert.ok(rectsOverlap(rect(0, 0, 10, 10), rect(5, 5, 10, 10)));
  assert.ok(!rectsOverlap(rect(0, 0, 10, 10), rect(10, 0, 10, 10)));
  assert.ok(!rectsOverlap(rect(0, 0, 10, 10), rect(0, 10, 10, 10)));
});

test('getPenetration returns the smallest push-out vector', () => {
  assert.equal(getPenetration(rect(0, 0, 10, 10), rect(20, 0, 5, 5)), null);
  assert.deepEqual(getPenetration(rect(0, 0, 10, 10), rect(8, 0, 10, 10)), { x: -2, y: 0 });
  assert.deepEqual(getPenetration(rect(0, 0, 10, 10), rect(0, 9, 10, 10)), { x: 0, y: -1 });
});

test('point, circle helpers', () => {
  assert.ok(pointInRect(5, 5, rect(0, 0, 10, 10)));
  assert.ok(!pointInRect(11, 5, rect(0, 0, 10, 10)));
  assert.ok(circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 8, y: 0, radius: 5 }));
  assert.ok(!circlesOverlap({ x: 0, y: 0, radius: 5 }, { x: 10, y: 0, radius: 5 }));
  assert.ok(circleRectOverlap({ x: 12, y: 5, radius: 3 }, rect(0, 0, 10, 10)));
  assert.ok(!circleRectOverlap({ x: 20, y: 5, radius: 3 }, rect(0, 0, 10, 10)));
});

test('registry: add picks kind from oneWay flag; remove and clear work', () => {
  const sys = new CollisionSystem();
  const solid = sys.add(rect(0, 0, 1, 1));
  const ow = sys.add({ ...rect(0, 0, 1, 1), oneWay: true });
  assert.deepEqual([sys.solids.length, sys.oneWayPlatforms.length], [1, 1]);
  assert.ok(sys.remove(solid));
  assert.ok(!sys.remove(solid));
  assert.ok(sys.remove(ow));
  sys.addSolid(rect(0, 0, 1, 1));
  sys.clear();
  assert.deepEqual([sys.solids.length, sys.oneWayPlatforms.length], [0, 0]);
});

test('solid floor: falling body lands exactly on top', () => {
  const sys = new CollisionSystem();
  sys.addSolid(rect(0, 100, 500, 50));
  const body = rect(10, 40, 20, 40); // bottom at 80
  const r = sys.moveBody(body, 0, 50);
  assert.equal(body.y + body.height, 100);
  assert.ok(r.hitBottom);
  assert.equal(r.ground.y, 100);
});

test('solid wall blocks horizontal movement from both sides', () => {
  const sys = new CollisionSystem();
  sys.addSolid(rect(100, 0, 20, 200));
  const a = rect(50, 50, 20, 20);
  const r1 = sys.moveBody(a, 100, 0);
  assert.equal(a.x + a.width, 100);
  assert.ok(r1.hitRight);
  const b = rect(150, 50, 20, 20);
  const r2 = sys.moveBody(b, -100, 0);
  assert.equal(b.x, 120);
  assert.ok(r2.hitLeft);
});

test('solid ceiling blocks upward movement', () => {
  const sys = new CollisionSystem();
  sys.addSolid(rect(0, 0, 500, 20));
  const body = rect(10, 60, 20, 20);
  const r = sys.moveBody(body, 0, -100);
  assert.equal(body.y, 20);
  assert.ok(r.hitTop);
});

test('one-way: lands when falling onto it from above', () => {
  const sys = new CollisionSystem();
  sys.addOneWay(rect(0, 100, 200, 10));
  const body = rect(50, 40, 20, 40);
  const r = sys.moveBody(body, 0, 40);
  assert.equal(body.y + body.height, 100);
  assert.ok(r.hitBottom);
});

test('one-way: passes through when moving up, then lands on top', () => {
  const sys = new CollisionSystem();
  sys.addOneWay(rect(0, 100, 200, 10));
  const body = rect(50, 105, 20, 40); // body overlaps the platform, below its top
  const up = sys.moveBody(body, 0, -80);
  assert.ok(!up.hitTop, 'upward movement is not blocked');
  assert.equal(body.y, 25);
  const down = sys.moveBody(body, 0, 80);
  assert.ok(down.hitBottom);
  assert.equal(body.y + body.height, 100);
});

test('one-way: does not catch a body that starts below its top while moving down', () => {
  const sys = new CollisionSystem();
  sys.addOneWay(rect(0, 100, 200, 10));
  const body = rect(50, 90, 20, 40); // bottom at 130, already past the top
  const r = sys.moveBody(body, 0, 30);
  assert.ok(!r.hitBottom);
  assert.equal(body.y, 120);
});

test('one-way: does not block sideways movement', () => {
  const sys = new CollisionSystem();
  sys.addOneWay(rect(100, 90, 50, 10));
  const body = rect(60, 80, 20, 20); // vertically overlapping the platform
  const r = sys.moveBody(body, 100, 0);
  assert.ok(!r.hitRight);
  assert.equal(body.x, 160);
});

test('one-way: ignoreOneWay / ignore list lets a body drop through', () => {
  const sys = new CollisionSystem();
  const plat = sys.addOneWay(rect(0, 100, 200, 10));
  let body = rect(50, 60, 20, 40); // standing on it
  assert.ok(sys.moveBody(body, 0, 10).hitBottom);
  body = rect(50, 60, 20, 40);
  assert.ok(!sys.moveBody(body, 0, 30, { ignoreOneWay: true }).hitBottom);
  body = rect(50, 60, 20, 40);
  assert.ok(!sys.moveBody(body, 0, 30, { ignore: [plat] }).hitBottom);
});

test('solid and one-way together: solid below still stops a body that dropped through', () => {
  const sys = new CollisionSystem();
  sys.addOneWay(rect(0, 100, 200, 10));
  sys.addSolid(rect(0, 200, 200, 50));
  const body = rect(50, 60, 20, 40);
  const r = sys.moveBody(body, 0, 300, { ignoreOneWay: true });
  assert.ok(r.hitBottom);
  assert.equal(body.y + body.height, 200);
});

test('fast bodies do not tunnel through thin solids', () => {
  const sys = new CollisionSystem();
  sys.addSolid(rect(0, 200, 500, 2));
  const body = rect(50, 0, 20, 20);
  const r = sys.moveBody(body, 0, 1000); // far larger than the 2px floor
  assert.ok(r.hitBottom);
  assert.equal(body.y + body.height, 200);

  sys.addSolid(rect(300, 0, 2, 500));
  const b2 = rect(100, 50, 20, 20);
  assert.ok(sys.moveBody(b2, 1000, 0).hitRight);
  assert.equal(b2.x + b2.width, 300);
});

test('move() is pure: it does not modify the input rect', () => {
  const sys = new CollisionSystem();
  sys.addSolid(rect(0, 100, 500, 50));
  const body = rect(10, 40, 20, 40);
  const r = sys.move(body, 0, 50);
  assert.equal(body.y, 40);
  assert.equal(r.y, 60);
});

test('resting on a solid then walking along it never produces phantom wall hits', () => {
  const sys = new CollisionSystem();
  // Ground built from adjacent tiles: a classic source of snagging on tile seams.
  for (let i = 0; i < 20; i++) sys.addSolid(rect(i * 32, 300, 32, 32));
  const body = rect(10, 300 - 48, 24, 48);
  let vy = 0;
  for (let i = 0; i < 150; i++) { // 150 frames * 3px stays on the 640px of ground
    vy += (2000 / 60);
    const r = sys.moveBody(body, 3, vy / 60);
    if (r.hitBottom) vy = 0;
    assert.ok(!r.hitRight && !r.hitLeft, `phantom side hit at frame ${i}`);
  }
  assert.ok(body.x > 400);
  assert.ok(Math.abs(body.y + body.height - 300) < 1e-3);
});

test('resting on a one-way platform stays grounded frame after frame', () => {
  const sys = new CollisionSystem();
  sys.addOneWay(rect(0, 300, 400, 16));
  const body = rect(100, 252, 24, 48);
  for (let i = 0; i < 120; i++) {
    const r = sys.moveBody(body, 0, 2000 / 60 / 60);
    assert.ok(r.hitBottom, `lost the platform at frame ${i}`);
  }
});

test('isGrounded finds solids and one-way platforms beneath', () => {
  const sys = new CollisionSystem();
  const floor = sys.addSolid(rect(0, 100, 200, 20));
  const plat = sys.addOneWay(rect(300, 100, 200, 10));
  assert.equal(sys.isGrounded(rect(10, 60, 20, 40)), floor);
  assert.equal(sys.isGrounded(rect(310, 60, 20, 40)), plat);
  assert.equal(sys.isGrounded(rect(310, 60, 20, 40), { ignoreOneWay: true }), null);
  assert.equal(sys.isGrounded(rect(10, 20, 20, 40)), null);
  // a body already below a one-way platform's top is not "on" it
  assert.equal(sys.isGrounded(rect(310, 90, 20, 40)), null);
});

test('queryRect filters by kind', () => {
  const sys = new CollisionSystem();
  const s = sys.addSolid(rect(0, 0, 10, 10));
  const o = sys.addOneWay(rect(5, 5, 10, 10));
  const probe = rect(6, 6, 2, 2);
  assert.deepEqual(sys.queryRect(probe), [s, o]);
  assert.deepEqual(sys.queryRect(probe, { oneWay: false }), [s]);
  assert.deepEqual(sys.queryRect(probe, { solid: false }), [o]);
});

test('colliders are live references: moving a platform changes results', () => {
  const sys = new CollisionSystem();
  const plat = sys.addSolid(rect(0, 100, 100, 10));
  const body = rect(10, 40, 20, 20);
  assert.ok(sys.move(body, 0, 100).hitBottom);
  plat.x = 1000; // slid away
  assert.ok(!sys.move(body, 0, 100).hitBottom);
});
