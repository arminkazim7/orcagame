import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from '../Camera.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('worldToScreen and screenToWorld are inverses, including zoom', () => {
  const cam = new Camera({ width: 960, height: 540, zoom: 2 });
  cam.snapTo(100, 50);
  const s = cam.worldToScreen(150, 80);
  assert.deepEqual(s, { x: 100, y: 60 });
  const w = cam.screenToWorld(s.x, s.y);
  assert.deepEqual(w, { x: 150, y: 80 });
});

test('visible size accounts for zoom', () => {
  const cam = new Camera({ width: 960, height: 540, zoom: 2 });
  assert.equal(cam.width, 480);
  assert.equal(cam.height, 270);
});

test('setZoom keeps the view centred', () => {
  const cam = new Camera({ width: 800, height: 600 });
  cam.snapTo(100, 100);
  const cx = cam.centerX;
  const cy = cam.centerY;
  cam.setZoom(2);
  near(cam.centerX, cx);
  near(cam.centerY, cy);
  assert.throws(() => cam.setZoom(0), RangeError);
});

test('bounds clamp the view on every side', () => {
  const cam = new Camera({ width: 100, height: 100 });
  cam.setBounds(0, 0, 1000, 500);
  cam.snapTo(-50, -50);
  assert.deepEqual([cam.x, cam.y], [0, 0]);
  cam.snapTo(5000, 5000);
  assert.deepEqual([cam.x, cam.y], [900, 400]);
});

test('a world smaller than the view is centred', () => {
  const cam = new Camera({ width: 200, height: 200 });
  cam.setBounds(0, 0, 100, 100);
  assert.deepEqual([cam.x, cam.y], [-50, -50]);
});

test('follow reads the target but never mutates it', () => {
  const cam = new Camera({ width: 200, height: 100 });
  const target = Object.freeze({ x: 500, y: 300, width: 20, height: 40 }); // frozen: writes would throw
  cam.follow(target);
  cam.update(1 / 60);
  assert.deepEqual([cam.centerX, cam.centerY], [510, 320]);
  assert.deepEqual({ ...target }, { x: 500, y: 300, width: 20, height: 40 });
});

test('follow offset shifts the framing', () => {
  const cam = new Camera({ width: 200, height: 100 });
  cam.follow({ x: 0, y: 0 }, { offsetX: 40, offsetY: -10 });
  assert.deepEqual([cam.centerX, cam.centerY], [40, -10]);
});

test('smoothing is frame-rate independent', () => {
  const a = new Camera({ width: 100, height: 100 });
  const b = new Camera({ width: 100, height: 100 });
  const target = { x: 1000, y: 0 };
  a.follow(target, { smoothing: 0.2, snap: false });
  b.follow(target, { smoothing: 0.2, snap: false });
  a.update(0.1);
  b.update(0.05);
  b.update(0.05);
  near(a.x, b.x, 1e-9);
  assert.ok(a.x > 0 && a.centerX < 1000, 'moved toward but has not reached the target');
});

test('deadzone: no scroll inside, scroll only the overshoot outside', () => {
  const cam = new Camera({ width: 200, height: 200 });
  const t = { x: 100, y: 100 };
  cam.follow(t, { deadzone: { width: 60, height: 60 } }); // snaps: centred on 100,100
  const x0 = cam.x;
  t.x = 120; // 20 right of centre, inside +-30 deadzone
  cam.update(1 / 60);
  assert.equal(cam.x, x0);
  t.x = 160; // 60 right of centre, 30 beyond the deadzone edge
  cam.update(1 / 60);
  near(cam.x, x0 + 30);
});

test('isVisible honours margin and view size', () => {
  const cam = new Camera({ width: 100, height: 100 });
  cam.snapTo(0, 0);
  assert.ok(cam.isVisible({ x: 50, y: 50, width: 10, height: 10 }));
  assert.ok(!cam.isVisible({ x: 150, y: 50, width: 10, height: 10 }));
  assert.ok(cam.isVisible({ x: 150, y: 50, width: 10, height: 10 }, 60));
});

test('shake only affects the render offset, never x/y', () => {
  const cam = new Camera({ width: 100, height: 100, random: () => 1 });
  cam.snapTo(10, 20);
  cam.shake(8, 1);
  cam.update(0.5);
  assert.deepEqual([cam.x, cam.y], [10, 20]);
  assert.notEqual(cam.getRenderX(), 10);
  cam.update(1);
  cam.update(0.1);
  assert.equal(cam.getRenderX(), 10);
});

test('reset clears position, target, bounds, zoom and shake', () => {
  const cam = new Camera({ width: 100, height: 100 });
  cam.setBounds(0, 0, 500, 500);
  cam.follow({ x: 300, y: 300 });
  cam.setZoom(2);
  cam.reset();
  assert.equal(cam.x, 0);
  assert.equal(cam.zoom, 1);
  assert.equal(cam.bounds, null);
  assert.equal(cam.target, null);
});
