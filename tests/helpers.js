// Shared fakes so the engine can run headless under node:test.
import { GameEngine } from '../src/engine/GameEngine.js';

/** A 2D context that records calls and ignores property reads/writes. */
export function fakeContext() {
  const calls = [];
  const target = { calls };
  return new Proxy(target, {
    get(t, key) {
      if (key in t) return t[key];
      return (...args) => {
        calls.push([key, ...args]);
      };
    },
    set(t, key, value) {
      t[key] = value;
      return true;
    },
  });
}

export function fakeCanvas({ left = 0, top = 0, cssWidth = 960, cssHeight = 540 } = {}) {
  const target = new EventTarget();
  const ctx = fakeContext();
  return Object.assign(target, {
    width: 0,
    height: 0,
    style: {},
    ctx,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left, top, width: cssWidth, height: cssHeight }),
  });
}

export function fakeWindow({ innerWidth = 960, innerHeight = 540, devicePixelRatio = 1 } = {}) {
  return Object.assign(new EventTarget(), { innerWidth, innerHeight, devicePixelRatio });
}

export function fakeDocument() {
  return Object.assign(new EventTarget(), { hidden: false });
}

/** Create an engine wired to fakes. rAF only records the callback; drive time with `tick`. */
export function makeEngine(options = {}) {
  const win = options.window ?? fakeWindow();
  const doc = options.document ?? fakeDocument();
  const canvas = options.canvas ?? fakeCanvas();
  const raf = { id: 0, pending: new Map() };
  const engine = new GameEngine({
    canvas,
    window: win,
    document: doc,
    requestAnimationFrame: (cb) => {
      raf.pending.set(++raf.id, cb);
      return raf.id;
    },
    cancelAnimationFrame: (id) => raf.pending.delete(id),
    ...options,
  });
  return { engine, win, doc, canvas, raf };
}

/** Dispatch a keyboard event on a target. */
export function key(target, type, code, extra = {}) {
  const e = Object.assign(new Event(type, { cancelable: true }), { code, ...extra });
  target.dispatchEvent(e);
  return e;
}

/** Dispatch a touch event. `touches` = [{ id, x, y }] in client coordinates. */
export function touch(target, type, touches) {
  const changedTouches = touches.map((t) => ({ identifier: t.id, clientX: t.x, clientY: t.y }));
  const e = Object.assign(new Event(type, { cancelable: true }), { changedTouches });
  target.dispatchEvent(e);
  return e;
}

/** Advance an engine by `frames` ticks of `ms` each, starting from `engine._testTime`. */
export function run(engine, frames, ms = 1000 / 60) {
  engine._testTime ??= 0;
  for (let i = 0; i < frames; i++) {
    engine._testTime += ms;
    engine.tick(engine._testTime);
  }
}
