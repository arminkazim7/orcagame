// Headless run of the engine test scene: proves scrolling, input and collision work together
// through the real engine loop (no browser needed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DemoScene, DemoBox, GROUND_Y, WORLD_WIDTH } from '../demo/DemoScene.js';
import { makeEngine, run, key } from './helpers.js';

function boot() {
  const ctx = makeEngine();
  const scene = new DemoScene();
  ctx.engine.setScene(scene);
  ctx.engine.start();
  run(ctx.engine, 1);
  ctx.scene = scene;
  ctx.box = scene.getByTag('demo-box')[0];
  return ctx;
}

test('scene builds: box, colliders and camera bounds are set up', () => {
  const { engine, box } = boot();
  assert.ok(box instanceof DemoBox);
  assert.ok(engine.getCollisionSystem().solids.length >= 6);
  assert.ok(engine.getCollisionSystem().oneWayPlatforms.length >= 5);
  assert.deepEqual(engine.getCamera().bounds, { x: 0, y: 0, width: WORLD_WIDTH, height: 900 });
});

test('gravity + solid ground: box settles on the ground and stays grounded', () => {
  const { engine, box } = boot();
  box.y -= 100;
  run(engine, 90);
  assert.ok(box.onGround);
  assert.ok(Math.abs(box.y + box.height - GROUND_Y) < 1e-3);
});

test('keyboard input moves the box and the camera scrolls to follow (world coords stay consistent)', () => {
  const { engine, box, win } = boot();
  run(engine, 30);
  const camStart = engine.getCamera().x;
  key(win, 'keydown', 'ArrowRight');
  run(engine, 150); // 2.5s at 260 px/s; the camera holds still inside its deadzone, then follows
  key(win, 'keyup', 'ArrowRight');
  assert.ok(box.x > 500, `box moved right (x=${box.x})`);
  assert.ok(engine.getCamera().x > camStart + 100, `camera scrolled (x=${engine.getCamera().x})`);
  // box is on-screen: its screen position comes only from world pos minus camera pos
  const s = engine.getCamera().worldToScreen(box.x, box.y);
  assert.ok(s.x >= 0 && s.x <= 960);
  assert.ok(box.x < WORLD_WIDTH);
});

test('solid wall stops the box', () => {
  const { engine, box, win } = boot();
  key(win, 'keydown', 'ArrowRight');
  run(engine, 300); // 5s: far more than needed to reach the wall at x=900
  assert.equal(box.x + box.width, 900);
  assert.ok(box.lastMove.hitRight || box.x + box.width === 900);
});

test('one-way platform: jump up through it from below and land on top', () => {
  const { engine, box, win } = boot();
  // Walk until under the first platform (x 300..460), then stop.
  key(win, 'keydown', 'ArrowRight');
  run(engine, 58);
  key(win, 'keyup', 'ArrowRight');
  run(engine, 20);
  assert.ok(box.x + box.width > 300 && box.x < 460, `under the platform (x=${box.x})`);
  assert.ok(box.onGround);

  key(win, 'keydown', 'Space');
  let passedThrough = false;
  for (let i = 0; i < 90; i++) {
    run(engine, 1);
    if (i === 0) key(win, 'keyup', 'Space');
    if (box.y + box.height < GROUND_Y - 110 + 16 && box.y + box.height > GROUND_Y - 110) passedThrough = true;
  }
  assert.ok(passedThrough, 'rose through the platform instead of bonking');
  assert.ok(box.onGround);
  assert.ok(Math.abs(box.y + box.height - (GROUND_Y - 110)) < 1e-3, `standing on the platform (bottom=${box.y + box.height})`);
});

test('Down+Jump drops through a one-way platform back to the ground', () => {
  const { engine, box, win } = boot();
  key(win, 'keydown', 'ArrowRight');
  run(engine, 58);
  key(win, 'keyup', 'ArrowRight');
  run(engine, 20);
  key(win, 'keydown', 'Space');
  run(engine, 1);
  key(win, 'keyup', 'Space');
  run(engine, 90);
  assert.ok(Math.abs(box.y + box.height - (GROUND_Y - 110)) < 1e-3, 'on the platform first');

  key(win, 'keydown', 'ArrowDown');
  key(win, 'keydown', 'Space');
  run(engine, 1);
  key(win, 'keyup', 'Space');
  key(win, 'keyup', 'ArrowDown');
  run(engine, 90);
  assert.ok(Math.abs(box.y + box.height - GROUND_Y) < 1e-3, `dropped to the ground (bottom=${box.y + box.height})`);
});

test('solid ceiling: jumping beneath an overhead block bonks the head', () => {
  const { engine, box, win } = boot();
  // Stand on the solid ledge at x 1500..1720 (top y=700); overhead block spans y 520..560.
  box.x = 1560;
  box.y = GROUND_Y - 120 - box.height;
  run(engine, 20);
  assert.ok(box.onGround);
  let bonked = false;
  key(win, 'keydown', 'Space');
  for (let i = 0; i < 40; i++) {
    run(engine, 1);
    if (i === 0) key(win, 'keyup', 'Space');
    if (box.lastMove.hitTop) bonked = true;
  }
  assert.ok(bonked, 'hit the ceiling block');
});

test('pausing freezes the box; resuming continues from the same place', () => {
  const { engine, box, win } = boot();
  key(win, 'keydown', 'ArrowRight');
  run(engine, 30);
  engine.pause();
  const x = box.x;
  run(engine, 60);
  assert.equal(box.x, x);
  engine.resume();
  run(engine, 30);
  assert.ok(box.x > x);
});

test('restart puts everything back at the start', () => {
  const { engine, scene, win } = boot();
  key(win, 'keydown', 'ArrowRight');
  run(engine, 120);
  key(win, 'keyup', 'ArrowRight');
  engine.restart();
  run(engine, 2);
  const box = scene.getByTag('demo-box')[0];
  assert.ok(box.x < 110, `back at spawn (x=${box.x})`);
  assert.equal(engine.getCamera().x, 0);
  assert.equal(scene.getByTag('demo-box').length, 1, 'no duplicate entities after restart');
});

test('full frame renders without throwing and draws world + HUD text', () => {
  const { engine, canvas } = boot();
  run(engine, 5);
  assert.ok(canvas.ctx.calls.some((c) => c[0] === 'fillText'), 'HUD text drawn');
  assert.ok(canvas.ctx.calls.some((c) => c[0] === 'translate'), 'world drawn under camera transform');
});
