import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer } from '../Renderer.js';
import { Camera } from '../Camera.js';
import { fakeCanvas, fakeWindow } from './helpers.js';

function make(opts = {}, win = {}) {
  const canvas = fakeCanvas();
  const window = fakeWindow(win);
  const renderer = new Renderer(canvas, { width: 960, height: 540, window, ...opts });
  return { canvas, window, renderer };
}

test('fits the logical size into the window, preserving aspect ratio (width-limited)', () => {
  const { canvas, renderer } = make({}, { innerWidth: 480, innerHeight: 1000 });
  renderer.resize();
  assert.equal(renderer.scale, 0.5);
  assert.equal(canvas.style.width, '480px');
  assert.equal(canvas.style.height, '270px');
});

test('fits the logical size into the window (height-limited)', () => {
  const { canvas, renderer } = make({}, { innerWidth: 2000, innerHeight: 270 });
  renderer.resize();
  assert.equal(renderer.scale, 0.5);
  assert.equal(canvas.style.width, '480px');
});

test('backing store uses the device pixel ratio, capped by maxPixelRatio', () => {
  const { canvas, renderer } = make({ maxPixelRatio: 2 }, { innerWidth: 960, innerHeight: 540, devicePixelRatio: 3 });
  renderer.resize();
  assert.equal(renderer.pixelRatio, 2);
  assert.equal(canvas.width, 1920);
  assert.equal(canvas.height, 1080);
  assert.equal(canvas.style.width, '960px');
});

test('integer scaling floors the scale once >= 1, but never below 1 shrinking', () => {
  const big = make({ integerScaling: true }, { innerWidth: 2000, innerHeight: 1100 });
  big.renderer.resize();
  assert.equal(big.renderer.scale, 2);
  const small = make({ integerScaling: true }, { innerWidth: 700, innerHeight: 500 });
  small.renderer.resize();
  assert.ok(Math.abs(small.renderer.scale - 700 / 960) < 1e-9);
});

test('a collapsed (zero-size) container keeps the previous size', () => {
  const { canvas, renderer } = make({}, { innerWidth: 480, innerHeight: 270 });
  renderer.resize();
  const before = canvas.style.width;
  renderer.resize(0, 0);
  assert.equal(canvas.style.width, before);
});

test('clientToLogical maps page coordinates through the canvas rect', () => {
  const { canvas, renderer } = make();
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 480, height: 270 });
  assert.deepEqual(renderer.clientToLogical(100, 50), { x: 0, y: 0 });
  assert.deepEqual(renderer.clientToLogical(340, 185), { x: 480, y: 270 });
});

test('base transform maps logical units to backing pixels', () => {
  const { canvas, renderer } = make({}, { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1 });
  renderer.resize();
  renderer.beginFrame();
  const call = canvas.ctx.calls.find((c) => c[0] === 'setTransform');
  assert.deepEqual(call.slice(1), [2, 0, 0, 2, 0, 0]);
});

test('pipeline order: clear -> background -> world(camera) -> UI -> overlay', () => {
  const { canvas, renderer } = make();
  const cam = new Camera({ width: 960, height: 540 });
  cam.snapTo(100, 40);
  const order = [];
  const scene = {
    renderBackground: () => order.push('background'),
    renderWorld: () => order.push('world'),
    renderUI: () => order.push('ui'),
  };
  canvas.ctx.calls.length = 0;
  renderer.render(scene, cam, 1, { overlay: { color: '#000', alpha: 0.5 } });
  assert.deepEqual(order, ['background', 'world', 'ui']);
  const names = canvas.ctx.calls.map((c) => c[0]);
  assert.ok(names.indexOf('translate') > names.indexOf('fillRect'), 'camera transform after the clear');
  const translate = canvas.ctx.calls.find((c) => c[0] === 'translate');
  assert.deepEqual(translate.slice(1), [-100, -40]);
  // overlay drawn last
  assert.equal(names.at(-2), 'fillRect');
});

test('world pass is always closed (save/restore balanced), even if a hook throws', () => {
  const { canvas, renderer } = make();
  const cam = new Camera();
  const scene = {
    renderWorld: () => {
      throw new Error('boom');
    },
  };
  canvas.ctx.calls.length = 0;
  assert.throws(() => renderer.render(scene, cam), /boom/);
  const names = canvas.ctx.calls.map((c) => c[0]);
  assert.equal(names.filter((n) => n === 'save').length, names.filter((n) => n === 'restore').length);
});

test('rendering never mutates the camera position', () => {
  const { renderer } = make();
  const cam = new Camera({ random: () => 1 });
  cam.snapTo(12.4, 7.6);
  cam.shake(10, 1);
  cam.update(0.1);
  renderer.render({ renderWorld() {} }, cam);
  assert.deepEqual([cam.x, cam.y], [12.4, 7.6]);
});

test('camera pixel snapping rounds the render offset only', () => {
  const { canvas, renderer } = make();
  const cam = new Camera();
  cam.snapTo(10.4, 20.6);
  renderer.render({ renderWorld() {} }, cam);
  const t = canvas.ctx.calls.find((c) => c[0] === 'translate');
  assert.deepEqual(t.slice(1), [-10, -21]);
  assert.equal(cam.x, 10.4);
});
