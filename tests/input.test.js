import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InputManager } from '../src/engine/InputManager.js';
import { key, touch } from './helpers.js';

function setup(options = {}) {
  const keys = new EventTarget();
  const canvas = new EventTarget();
  const input = new InputManager({ keyTarget: keys, pointerTarget: canvas, ...options });
  input.attach();
  return { input, keys, canvas };
}

test('key down/up drive action state and edges', () => {
  const { input, keys } = setup();
  assert.ok(!input.isDown('left'));
  key(keys, 'keydown', 'ArrowLeft');
  assert.ok(input.isDown('left'));
  assert.ok(input.wasPressed('left'));
  input.endStep();
  assert.ok(input.isDown('left'));
  assert.ok(!input.wasPressed('left'), 'edge only lasts one step');
  key(keys, 'keyup', 'ArrowLeft');
  assert.ok(!input.isDown('left'));
  assert.ok(input.wasReleased('left'));
});

test('several keys bound to one action: held until all are released', () => {
  const { input, keys } = setup();
  key(keys, 'keydown', 'ArrowLeft');
  key(keys, 'keydown', 'KeyA');
  key(keys, 'keyup', 'ArrowLeft');
  assert.ok(input.isDown('left'));
  key(keys, 'keyup', 'KeyA');
  assert.ok(!input.isDown('left'));
});

test('auto-repeat keydown does not create new press edges', () => {
  const { input, keys } = setup();
  key(keys, 'keydown', 'Space');
  input.endStep();
  key(keys, 'keydown', 'Space', { repeat: true });
  assert.ok(!input.wasPressed('jump'));
});

test('simultaneous keys are all tracked; axis cancels when both held', () => {
  const { input, keys } = setup();
  key(keys, 'keydown', 'ArrowRight');
  key(keys, 'keydown', 'Space');
  assert.ok(input.isDown('right') && input.isDown('jump'));
  assert.equal(input.getAxis('left', 'right'), 1);
  key(keys, 'keydown', 'ArrowLeft');
  assert.equal(input.getAxis('left', 'right'), 0);
  key(keys, 'keyup', 'ArrowRight');
  assert.equal(input.getAxis('left', 'right'), -1);
});

test('step-level and frame-level edges are cleared independently', () => {
  const { input, keys } = setup();
  key(keys, 'keydown', 'Enter');
  input.endStep();
  assert.ok(!input.wasPressed('confirm'));
  assert.ok(input.wasPressedThisFrame('confirm'));
  input.endFrame();
  assert.ok(!input.wasPressedThisFrame('confirm'));
});

test('rebinding replaces keys', () => {
  const { input, keys } = setup();
  input.bind('jump', ['KeyK']);
  key(keys, 'keydown', 'Space');
  assert.ok(!input.isDown('jump'));
  key(keys, 'keydown', 'KeyK');
  assert.ok(input.isDown('jump'));
});

test('preventDefault only for bound keys without ctrl/meta/alt', () => {
  const { keys } = setup();
  assert.ok(key(keys, 'keydown', 'Space').defaultPrevented);
  assert.ok(!key(keys, 'keydown', 'F5').defaultPrevented);
  assert.ok(!key(keys, 'keydown', 'KeyA', { ctrlKey: true }).defaultPrevented);
});

test('keys typed into text fields are ignored', () => {
  const { input, keys } = setup();
  const e = Object.assign(new Event('keydown'), { code: 'KeyA' });
  Object.defineProperty(e, 'target', { value: { tagName: 'INPUT' } });
  keys.dispatchEvent(e);
  assert.ok(!input.isDown('left'));
});

test('window blur releases everything so keys cannot stick', () => {
  const { input, keys } = setup();
  key(keys, 'keydown', 'ArrowRight');
  keys.dispatchEvent(new Event('blur'));
  assert.ok(!input.isDown('right'));
  assert.ok(input.wasReleased('right'));
});

test('touch buttons hold actions; coordinates go through toLogical', () => {
  // Canvas drawn at half size: client coords are half of logical coords.
  const { input, canvas } = setup({ toLogical: (x, y) => ({ x: x * 2, y: y * 2 }) });
  input.addTouchButton('jump', { x: 100, y: 100, width: 50, height: 50 });
  touch(canvas, 'touchstart', [{ id: 1, x: 60, y: 60 }]); // logical 120,120 -> inside
  assert.ok(input.isDown('jump'));
  assert.ok(input.hasTouched);
  touch(canvas, 'touchend', [{ id: 1, x: 60, y: 60 }]);
  assert.ok(!input.isDown('jump'));
});

test('touch and keyboard are independent: neither blocks the other', () => {
  const { input, keys, canvas } = setup();
  input.addTouchButton('right', { x: 0, y: 0, width: 100, height: 100 });
  key(keys, 'keydown', 'Space');
  touch(canvas, 'touchstart', [{ id: 1, x: 10, y: 10 }]);
  assert.ok(input.isDown('jump'), 'keyboard still works while touching');
  assert.ok(input.isDown('right'));
  // keyboard and touch on the SAME action: releasing one keeps the other
  key(keys, 'keydown', 'ArrowRight');
  touch(canvas, 'touchend', [{ id: 1, x: 10, y: 10 }]);
  assert.ok(input.isDown('right'), 'keyboard keeps the action alive after touch release');
  key(keys, 'keyup', 'ArrowRight');
  assert.ok(!input.isDown('right'));
});

test('multi-touch: two fingers on two buttons, releasing one keeps the other', () => {
  const { input, canvas } = setup();
  input.addTouchButton('left', { x: 0, y: 0, width: 100, height: 100 });
  input.addTouchButton('jump', { x: 200, y: 0, width: 100, height: 100 });
  touch(canvas, 'touchstart', [
    { id: 1, x: 50, y: 50 },
    { id: 2, x: 250, y: 50 },
  ]);
  assert.ok(input.isDown('left') && input.isDown('jump'));
  assert.equal(input.getTouches().length, 2);
  touch(canvas, 'touchend', [{ id: 1, x: 50, y: 50 }]);
  assert.ok(!input.isDown('left'));
  assert.ok(input.isDown('jump'));
});

test('two fingers on the same button: released only when both lift', () => {
  const { input, canvas } = setup();
  input.addTouchButton('jump', { x: 0, y: 0, width: 100, height: 100 });
  touch(canvas, 'touchstart', [{ id: 1, x: 10, y: 10 }]);
  touch(canvas, 'touchstart', [{ id: 2, x: 20, y: 20 }]);
  touch(canvas, 'touchend', [{ id: 1, x: 10, y: 10 }]);
  assert.ok(input.isDown('jump'));
  touch(canvas, 'touchend', [{ id: 2, x: 20, y: 20 }]);
  assert.ok(!input.isDown('jump'));
});

test('sliding a finger between buttons switches the held action', () => {
  const { input, canvas } = setup();
  input.addTouchButton('left', { x: 0, y: 0, width: 100, height: 100 });
  input.addTouchButton('right', { x: 100, y: 0, width: 100, height: 100 });
  touch(canvas, 'touchstart', [{ id: 1, x: 50, y: 50 }]);
  assert.ok(input.isDown('left'));
  touch(canvas, 'touchmove', [{ id: 1, x: 150, y: 50 }]);
  assert.ok(!input.isDown('left') && input.isDown('right'));
  touch(canvas, 'touchmove', [{ id: 1, x: 500, y: 500 }]);
  assert.ok(!input.isDown('right'));
});

test('touchcancel releases', () => {
  const { input, canvas } = setup();
  input.addTouchButton('jump', { x: 0, y: 0, width: 100, height: 100 });
  touch(canvas, 'touchstart', [{ id: 1, x: 10, y: 10 }]);
  touch(canvas, 'touchcancel', [{ id: 1, x: 10, y: 10 }]);
  assert.ok(!input.isDown('jump'));
});

test('removing a touch button releases its held action', () => {
  const { input, canvas } = setup();
  const id = input.addTouchButton('jump', { x: 0, y: 0, width: 100, height: 100 });
  touch(canvas, 'touchstart', [{ id: 1, x: 10, y: 10 }]);
  assert.ok(input.removeTouchButton(id));
  assert.ok(!input.isDown('jump'));
});

test('mouse position, press and release edges (frame-level)', () => {
  const { input, canvas, keys } = setup();
  canvas.dispatchEvent(Object.assign(new Event('mousedown'), { clientX: 30, clientY: 40 }));
  const m = input.getMouse();
  assert.deepEqual([m.x, m.y, m.down, m.pressed], [30, 40, true, true]);
  input.endFrame();
  assert.ok(!input.getMouse().pressed);
  keys.dispatchEvent(new Event('mouseup'));
  assert.ok(!input.getMouse().down && input.getMouse().released);
});

test('detach stops listening and releases held input', () => {
  const { input, keys } = setup();
  key(keys, 'keydown', 'ArrowLeft');
  input.detach();
  assert.ok(!input.isDown('left'));
  key(keys, 'keydown', 'ArrowLeft');
  assert.ok(!input.isDown('left'));
  assert.ok(!input.isAttached);
});
