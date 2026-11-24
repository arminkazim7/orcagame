import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Entity, Scene } from '../GameEngine.js';
import { makeEngine, run, key } from './helpers.js';

const STEP = 1 / 60;

class Recorder extends Scene {
  constructor(name = 'scene', log = []) {
    super();
    this.name = name;
    this.log = log;
    this.dts = [];
  }
  onEnter(engine, data) {
    this.log.push(`${this.name}:enter:${data?.tag ?? ''}`);
  }
  onExit() {
    this.log.push(`${this.name}:exit`);
  }
  onPause() {
    this.log.push(`${this.name}:pause`);
  }
  onResume() {
    this.log.push(`${this.name}:resume`);
  }
  update(dt) {
    this.dts.push(dt);
    super.update(dt);
  }
}

// ---- loop & delta time ---------------------------------------------------------------------

test('start schedules exactly one loop, is idempotent, and reports state', () => {
  const { engine, raf } = makeEngine();
  assert.equal(engine.getState(), 'idle');
  engine.start();
  engine.start();
  assert.equal(engine.getState(), 'running');
  assert.equal(raf.pending.size, 1);
});

test('the loop callback re-schedules itself (single central rAF loop)', () => {
  const { engine, raf } = makeEngine();
  engine.start();
  const [[id, cb]] = [...raf.pending];
  raf.pending.delete(id);
  cb(16.7);
  assert.equal(raf.pending.size, 1);
});

test('fixed timestep: updates run with a constant dt regardless of frame time', () => {
  const { engine } = makeEngine();
  const scene = new Recorder();
  engine.setScene(scene);
  engine.start();
  run(engine, 1); // first frame establishes the clock
  run(engine, 60, 1000 / 30); // 30 fps display: two steps per frame
  assert.ok(scene.dts.length >= 118 && scene.dts.length <= 122, `got ${scene.dts.length}`);
  assert.ok(scene.dts.every((d) => d === STEP));
});

test('fixed timestep on a fast display: some frames run zero updates, none run extra', () => {
  const { engine } = makeEngine();
  const scene = new Recorder();
  engine.setScene(scene);
  engine.start();
  run(engine, 1);
  run(engine, 144, 1000 / 144); // one second at 144 Hz
  assert.ok(scene.dts.length >= 59 && scene.dts.length <= 61, `got ${scene.dts.length}`);
});

test('tab suspension: a huge gap never causes a physics jump', () => {
  const { engine } = makeEngine();
  const scene = new Recorder();
  engine.setScene(scene);
  engine.start();
  engine.tick(0);
  engine.tick(16);
  const before = scene.dts.length;
  engine.tick(16 + 10 * 60 * 1000); // ten minutes in a background tab
  const steps = scene.dts.length - before;
  assert.ok(steps <= engine.maxSubSteps, `ran ${steps} steps`);
  assert.ok(scene.dts.every((d) => d <= STEP + 1e-12), 'dt never exceeds the fixed step');
  assert.ok(engine.getStats().elapsed < 1, 'simulated time stays bounded');
});

test('variable timestep mode clamps dt to maxFrameTime', () => {
  const { engine } = makeEngine({ fixedTimeStep: 0, maxFrameTime: 0.1 });
  const scene = new Recorder();
  engine.setScene(scene);
  engine.start();
  engine.tick(0);
  engine.tick(20);
  engine.tick(60000);
  assert.deepEqual(scene.dts, [0.02, 0.1]);
});

test('update(deltaTime) is a public, manually steppable API', () => {
  const { engine } = makeEngine();
  const scene = new Recorder();
  engine.setScene(scene);
  engine.update(0.5);
  assert.deepEqual(scene.dts, [0.5]);
  assert.equal(engine.getStats().elapsed, 0.5);
});

test('render(alpha) is a public API and forwards alpha to scene hooks', () => {
  const { engine } = makeEngine();
  const seen = [];
  const scene = new Scene();
  scene.renderWorld = (r, cam, alpha) => seen.push(alpha);
  engine.setScene(scene);
  engine.render(0.25);
  assert.deepEqual(seen, [0.25]);
});

// ---- pause / resume / restart ----------------------------------------------------------------

test('pause stops updates but keeps rendering; resume continues without a time jump', () => {
  const { engine } = makeEngine();
  const log = [];
  const scene = new Recorder('s', log);
  let renders = 0;
  scene.renderWorld = () => renders++;
  engine.setScene(scene);
  engine.start();
  run(engine, 10);
  const updates = scene.dts.length;
  engine.pause();
  assert.equal(engine.getState(), 'paused');
  const r0 = renders;
  run(engine, 30);
  assert.equal(scene.dts.length, updates, 'no updates while paused');
  assert.equal(renders - r0, 30, 'still rendering while paused');

  engine.resume();
  assert.equal(engine.getState(), 'running');
  // 5 minutes passed while paused; the next frame must not simulate any of it
  engine._testTime += 5 * 60 * 1000;
  run(engine, 1);
  assert.ok(scene.dts.length - updates <= 1);
  assert.deepEqual(log.filter((l) => /pause|resume/.test(l)), ['s:pause', 's:resume']);
});

test('pause/resume are no-ops in the wrong state', () => {
  const { engine } = makeEngine();
  engine.pause();
  engine.resume();
  assert.equal(engine.getState(), 'idle');
  engine.start();
  engine.resume();
  assert.equal(engine.getState(), 'running');
});

test('hidden tab auto-pauses and resumes; first frame back has dt 0', () => {
  const { engine, doc } = makeEngine();
  const scene = new Recorder();
  engine.setScene(scene);
  engine.start();
  run(engine, 5);
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(engine.getState(), 'paused');
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(engine.getState(), 'running');
  const n = scene.dts.length;
  engine._testTime += 600000;
  run(engine, 1);
  assert.equal(scene.dts.length, n, 'no catch-up simulation after returning');
});

test('hidden tab does not resume a game the user had paused themselves', () => {
  const { engine, doc } = makeEngine();
  engine.start();
  engine.pause();
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(engine.getState(), 'paused');
});

test('keys held while the tab is hidden are released', () => {
  const { engine, doc, win } = makeEngine();
  engine.start();
  key(win, 'keydown', 'ArrowRight');
  assert.ok(engine.getInput().isDown('right'));
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.ok(!engine.getInput().isDown('right'));
});

test('restart re-enters the scene with its original data and rebuilds entities', () => {
  const { engine } = makeEngine();
  const log = [];
  const scene = new Recorder('s', log);
  const destroyed = [];
  scene.onEnter = function (eng, data) {
    log.push(`enter:${data.tag}`);
    const e = this.add(new Entity());
    e.destroy = () => destroyed.push(e);
  };
  engine.setScene(scene, { data: { tag: 'A' } });
  engine.start();
  engine.getCamera().snapTo(500, 500);
  engine.getCollisionSystem().addSolid({ x: 0, y: 0, width: 1, height: 1 });
  run(engine, 30);
  engine.pause();
  engine.restart();
  assert.deepEqual(log.filter((l) => l.startsWith('enter')), ['enter:A', 'enter:A']);
  assert.equal(destroyed.length, 1, 'old entities destroyed');
  assert.equal(scene.entities.length, 1, 'new entities built');
  assert.deepEqual([engine.getCamera().x, engine.getCamera().y], [0, 0]);
  assert.equal(engine.getCollisionSystem().solids.length, 0);
  assert.equal(engine.getState(), 'running', 'restart leaves paused state');
  assert.equal(engine.getStats().elapsed, 0);
});

test('restart called from inside update is deferred to the end of the step', () => {
  const { engine } = makeEngine();
  const log = [];
  const scene = new Recorder('s', log);
  scene.update = function (dt) {
    log.push('update:start');
    engine.restart();
    log.push('update:end');
  };
  engine.setScene(scene);
  engine.update(STEP);
  assert.deepEqual(log, ['s:enter:', 'update:start', 'update:end', 's:exit', 's:enter:']);
});

test('stop detaches listeners and cancels the frame', () => {
  const { engine, raf, win } = makeEngine();
  engine.start();
  engine.stop();
  assert.equal(engine.getState(), 'stopped');
  assert.equal(raf.pending.size, 0);
  key(win, 'keydown', 'ArrowLeft');
  assert.ok(!engine.getInput().isDown('left'));
  engine.start(); // can be restarted
  assert.equal(engine.getState(), 'running');
});

// ---- scenes & transitions --------------------------------------------------------------------

test('first setScene is immediate even with a transition', () => {
  const { engine } = makeEngine();
  const a = new Recorder('a');
  engine.setScene(a, { transition: true });
  assert.equal(engine.getScene(), a);
  assert.ok(!engine.isTransitioning());
});

test('immediate scene change: exit -> teardown -> camera/collision reset -> enter', () => {
  const { engine } = makeEngine();
  const log = [];
  const a = new Recorder('a', log);
  const b = new Recorder('b', log);
  engine.setScene(a);
  const e = a.add(new Entity());
  let destroyed = 0;
  e.destroy = () => destroyed++;
  engine.getCamera().snapTo(300, 300);
  engine.getCollisionSystem().addSolid({ x: 0, y: 0, width: 1, height: 1 });
  engine.setScene(b, { data: { tag: 'x' } });
  assert.deepEqual(log, ['a:enter:', 'a:exit', 'b:enter:x']);
  assert.equal(destroyed, 1);
  assert.equal(engine.getCamera().x, 0);
  assert.equal(engine.getCollisionSystem().solids.length, 0);
  assert.equal(b.engine, engine);
});

test('fade transition: old scene frozen while fading out, swap at full black, new scene fades in', () => {
  const { engine } = makeEngine();
  const log = [];
  const a = new Recorder('a', log);
  const b = new Recorder('b', log);
  engine.setScene(a);
  engine.setScene(b, { transition: { duration: 0.5, color: '#fff' } });
  assert.ok(engine.isTransitioning());
  assert.equal(engine.getScene(), a, 'not swapped yet');

  engine.update(0.25);
  assert.equal(a.dts.length, 0, 'outgoing scene frozen during fade-out');
  const overlays = [];
  const origRender = engine.renderer.render.bind(engine.renderer);
  engine.renderer.render = (s, c, al, extras) => {
    overlays.push(extras.overlay);
    return origRender(s, c, al, extras);
  };
  engine.render();
  assert.equal(overlays[0].alpha, 0.5);
  assert.equal(overlays[0].color, '#fff');

  engine.update(0.25); // reaches 0.5 -> swap
  assert.equal(engine.getScene(), b);
  assert.deepEqual(log, ['a:enter:', 'a:exit', 'b:enter:']);
  engine.render();
  assert.equal(overlays[1].alpha, 1, 'fully covered at the swap point');

  engine.update(0.25);
  assert.equal(b.dts.length, 1, 'incoming scene runs during fade-in');
  engine.render();
  assert.equal(overlays[2].alpha, 0.5);
  engine.update(0.25);
  assert.ok(!engine.isTransitioning());
});

test('setScene during a fade-out retargets the pending scene', () => {
  const { engine } = makeEngine();
  const a = new Recorder('a');
  const b = new Recorder('b');
  const c = new Recorder('c');
  engine.setScene(a);
  engine.setScene(b, { transition: { duration: 0.2 } });
  engine.setScene(c, { transition: { duration: 0.2 } });
  engine.update(0.2);
  assert.equal(engine.getScene(), c);
});

test('setScene from inside update takes effect after the step, not mid-iteration', () => {
  const { engine } = makeEngine();
  const log = [];
  const a = new Recorder('a', log);
  const b = new Recorder('b', log);
  a.update = function () {
    engine.setScene(b);
    log.push(`still-in:${engine.getScene().name}`);
  };
  engine.setScene(a);
  engine.update(STEP);
  assert.deepEqual(log, ['a:enter:', 'still-in:a', 'a:exit', 'b:enter:']);
});

test("'scenechange' event reports from/to", () => {
  const { engine } = makeEngine();
  const events = [];
  engine.on('scenechange', (e) => events.push([e.from?.name ?? null, e.to?.name ?? null]));
  engine.setScene(new Recorder('a'));
  engine.setScene(new Recorder('b'));
  assert.deepEqual(events, [[null, 'a'], ['a', 'b']]);
});

// ---- entity lifecycle ------------------------------------------------------------------------

test('entity lifecycle: init once -> update per step -> destroy once', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const calls = [];
  const e = new Entity();
  e.init = (s) => calls.push(['init', s === scene]);
  e.update = (dt) => calls.push(['update', dt]);
  e.destroy = () => calls.push(['destroy']);
  engine.setScene(scene);
  scene.add(e);
  engine.update(STEP);
  engine.update(STEP);
  e.kill();
  engine.update(STEP);
  assert.deepEqual(calls, [['init', true], ['update', STEP], ['update', STEP], ['destroy']]);
  assert.equal(e.destroyed, true);
  assert.equal(scene.entities.length, 0);
});

test('adding and removing during update is deferred and safe', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const log = [];
  const child = new Entity();
  child.init = () => log.push('child:init');
  child.update = () => log.push('child:update');
  const spawner = new Entity();
  let spawned = false;
  spawner.update = function () {
    if (spawned) return;
    spawned = true;
    scene.add(child);
    log.push(`added; in list yet? ${scene.entities.includes(child)}`);
    spawner.kill();
    log.push('killed spawner');
  };
  spawner.destroy = () => log.push('spawner:destroy');
  engine.setScene(scene);
  scene.add(spawner);
  engine.update(STEP);
  engine.update(STEP);
  assert.deepEqual(log, [
    'added; in list yet? false',
    'killed spawner',
    'child:init',
    'spawner:destroy',
    'child:update',
  ]);
});

test('an entity added and removed in the same step is still initialised then destroyed', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const log = [];
  const e = new Entity();
  e.init = () => log.push('init');
  e.destroy = () => log.push('destroy');
  const host = new Entity();
  host.update = () => {
    scene.add(e);
    scene.remove(e);
  };
  engine.setScene(scene);
  scene.add(host);
  engine.update(STEP);
  assert.deepEqual(log, ['init', 'destroy']);
});

test('inactive entities do not update; invisible ones do not render', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const log = [];
  const e = new Entity({ width: 10, height: 10 });
  e.update = () => log.push('update');
  e.render = () => log.push('render');
  scene.add(e);
  engine.setScene(scene);
  e.active = false;
  e.visible = false;
  engine.update(STEP);
  engine.render();
  assert.deepEqual(log, []);
});

test('render order: layer, then zIndex, then insertion order', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const order = [];
  const mk = (name, layer, zIndex) => {
    const e = new Entity({ layer, zIndex });
    e.render = () => order.push(name);
    scene.add(e);
  };
  mk('c', 1, 0);
  mk('a', 0, 5);
  mk('b', 0, 9);
  mk('d', 1, 0);
  engine.setScene(scene);
  engine.render();
  assert.deepEqual(order, ['a', 'b', 'c', 'd']);
});

test('entities outside the camera are culled unless cullable is false', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const drawn = [];
  const mk = (name, x, cullable = true) => {
    const e = new Entity({ x, y: 0, width: 10, height: 10 });
    e.cullable = cullable;
    e.render = () => drawn.push(name);
    scene.add(e);
  };
  mk('near', 100);
  mk('far', 5000);
  mk('far-but-always', 5000, false);
  engine.setScene(scene);
  engine.render();
  assert.deepEqual(drawn, ['near', 'far-but-always']);
});

test('getByTag finds entities by tag or tags', () => {
  const scene = new Scene();
  const a = scene.add(new Entity({ tag: 'coin' }));
  const b = scene.add(Object.assign(new Entity(), { tags: ['coin', 'shiny'] }));
  scene.add(new Entity({ tag: 'wall' }));
  assert.deepEqual(scene.getByTag('coin'), [a, b]);
});

// ---- consistency: world coordinates & input edges --------------------------------------------

test('camera scrolling never changes entity world coordinates', () => {
  const { engine } = makeEngine();
  const scene = new Scene();
  const e = new Entity({ x: 1234, y: 567, width: 20, height: 20 });
  scene.add(e);
  engine.setScene(scene);
  engine.getCamera().follow(e, { smoothing: 0.1 });
  engine.getCamera().setBounds(0, 0, 5000, 2000);
  engine.getCamera().shake(20, 1);
  engine.start();
  run(engine, 120);
  engine.getCamera().snapTo(900, 400);
  run(engine, 10);
  assert.deepEqual([e.x, e.y], [1234, 567]);
});

test('a key press is seen by exactly one update step', () => {
  const { engine, win } = makeEngine();
  const seen = [];
  const scene = new Scene();
  scene.update = () => seen.push(engine.getInput().wasPressed('jump'));
  engine.setScene(scene);
  engine.start();
  run(engine, 1);
  key(win, 'keydown', 'Space');
  run(engine, 10);
  assert.equal(seen.filter(Boolean).length, 1);
});

test('frame-level hotkeys fire once per press, also while paused', () => {
  const { engine, win } = makeEngine();
  let toggles = 0;
  engine.on('frame', () => {
    if (engine.getInput().wasPressedThisFrame('pause')) {
      toggles++;
      engine.togglePause();
    }
  });
  engine.start();
  run(engine, 2);
  key(win, 'keydown', 'KeyP');
  key(win, 'keyup', 'KeyP');
  run(engine, 5);
  assert.equal(toggles, 1);
  assert.equal(engine.getState(), 'paused');
  key(win, 'keydown', 'KeyP');
  run(engine, 5);
  assert.equal(toggles, 2);
  assert.equal(engine.getState(), 'running');
});

test('touch controls auto-show only after the first touch', () => {
  const { engine, canvas } = makeEngine();
  const scene = new Scene();
  engine.setScene(scene);
  engine.getInput().addTouchButton('jump', { x: 0, y: 0, width: 50, height: 50 }, 'J');
  engine.start();
  const drawn = () => canvas.ctx.calls.filter((c) => c[0] === 'fillText' && c[1] === 'J').length;
  run(engine, 2);
  assert.equal(drawn(), 0);
  canvas.dispatchEvent(Object.assign(new Event('touchstart'), { changedTouches: [{ identifier: 1, clientX: 9999, clientY: 9999 }] }));
  run(engine, 2);
  assert.ok(drawn() > 0);
});

test('on() returns an unsubscribe function', () => {
  const { engine } = makeEngine();
  let n = 0;
  const off = engine.on('start', () => n++);
  engine.start();
  engine.stop();
  off();
  engine.start();
  assert.equal(n, 1);
});

test('exposes the documented accessors', () => {
  const { engine } = makeEngine();
  assert.ok(engine.getInput() && engine.getCamera() && engine.getCollisionSystem());
  for (const m of ['start', 'pause', 'resume', 'restart', 'update', 'render', 'setScene', 'getInput', 'getCamera', 'getCollisionSystem']) {
    assert.equal(typeof engine[m], 'function', m);
  }
});
