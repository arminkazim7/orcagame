/**
 * GameEngine — the single owner of the game loop.
 *
 * Specialist modules (player, levels, enemies, menus, ...) must NOT create their own
 * requestAnimationFrame / setInterval loops. They plug in by subclassing `Scene` and
 * `Entity` and are driven by `GameEngine.update(deltaTime)` / `render(alpha)`.
 *
 * This file also exports `Scene` and `Entity`, the two base classes that define the entity
 * lifecycle, so the public surface stays within the five engine files.
 */
import { Camera } from './Camera.js';
import { CollisionSystem } from './Collision.js';
import { InputManager } from './InputManager.js';
import { Renderer } from './Renderer.js';

// =============================================================================================
// Entity
// =============================================================================================

/**
 * Convenience base class for scene objects. Subclassing is optional: any object with the
 * hooks you need works (the engine only calls hooks that exist).
 *
 * Lifecycle: `init(scene)` once when added -> `update(dt, scene)` every step ->
 * `destroy()` once when removed. Call `kill()` to request removal (safe during `update`).
 *
 * World position (`x`, `y`) is in WORLD coordinates and is never touched by the camera.
 */
export class Entity {
  constructor({ x = 0, y = 0, width = 0, height = 0, layer = 0, zIndex = 0, tag = null } = {}) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    /** Draw order: lower layers first, then lower zIndex, then insertion order. */
    this.layer = layer;
    this.zIndex = zIndex;
    this.tag = tag;
    /** Inactive entities are skipped by `update`. */
    this.active = true;
    /** Invisible entities are skipped by render. */
    this.visible = true;
    /** Set false for entities that must always draw (backgrounds), skipping camera culling. */
    this.cullable = true;
    /** @type {Scene|null} */
    this.scene = null;
    this.destroyed = false;
  }

  /** Called once after the entity is added to a scene. */
  init(scene) {}
  /** Called once per simulation step with a fixed (or clamped) `dt` in seconds. */
  update(dt, scene) {}
  /** World-space draw. The camera transform is already applied. */
  render(ctx, renderer, alpha) {}
  /** Screen-space draw (HUD). Optional; no camera transform. */
  renderUI(ctx, renderer, alpha) {}
  /** Called once when the entity is removed. Release listeners/colliders here. */
  destroy() {}

  /** Request removal from the scene. Safe to call from `update`. */
  kill() {
    if (this.scene) this.scene.remove(this);
  }
}

// =============================================================================================
// Scene
// =============================================================================================

function byDrawOrder(a, b) {
  return (a.layer ?? 0) - (b.layer ?? 0) || (a.zIndex ?? 0) - (b.zIndex ?? 0);
}

/**
 * A scene owns a set of entities and defines what is shown for one "screen" of the game
 * (a level, a menu, ...). Subclass it and override the hooks.
 *
 * Entity adds/removes made while the scene is updating are deferred to the end of that step,
 * so it is always safe to `add`/`remove` from inside an entity's `update`.
 */
export class Scene {
  constructor() {
    /** @type {GameEngine|null} Set by the engine before `onEnter`. */
    this.engine = null;
    /** @type {object[]} Live entities, in insertion order. Treat as read-only. */
    this.entities = [];
    /** World size hint (used by subclasses to configure camera bounds). */
    this.worldWidth = 0;
    this.worldHeight = 0;
    /** Extra world units around the view within which entities are still drawn. */
    this.cullMargin = 64;
    this._pendingAdd = [];
    this._dead = new Set();
    this._updating = false;
    this._renderList = [];
  }

  // ---- hooks to override -------------------------------------------------------------------

  /** Build the scene here (add entities, set camera bounds, register colliders). */
  onEnter(engine, data) {}
  /** The scene is being left or restarted; entities are destroyed right after this. */
  onExit() {}
  onPause() {}
  onResume() {}

  /** Advance the scene. Subclasses should call `super.update(dt)`. */
  update(dt) {
    this._updating = true;
    try {
      for (const e of this.entities) {
        if (e.active === false || this._dead.has(e)) continue;
        e.update?.(dt, this);
      }
    } finally {
      this._updating = false;
    }
    this._flush();
  }

  /** Screen-space backdrop drawn before the world. */
  renderBackground(renderer, alpha) {}

  /** World-space draw: all visible entities, sorted by layer/zIndex, culled to the camera. */
  renderWorld(renderer, camera, alpha) {
    const list = this._renderList;
    list.length = 0;
    for (const e of this.entities) {
      if (e.visible === false || typeof e.render !== 'function' || this._dead.has(e)) continue;
      if (
        e.cullable !== false &&
        e.width > 0 &&
        e.height > 0 &&
        !camera.isVisible(e, this.cullMargin)
      ) {
        continue;
      }
      list.push(e);
    }
    list.sort(byDrawOrder);
    for (const e of list) e.render(renderer.ctx, renderer, alpha);
    list.length = 0;
  }

  /** Screen-space overlay drawn after the world (HUD). Default: entities' `renderUI`. */
  renderUI(renderer, alpha) {
    for (const e of this.entities) {
      if (e.visible === false || typeof e.renderUI !== 'function' || this._dead.has(e)) continue;
      e.renderUI(renderer.ctx, renderer, alpha);
    }
  }

  // ---- entity management -------------------------------------------------------------------

  /** Add an entity. Initialised immediately, or at the end of the step if mid-update. */
  add(entity) {
    entity.scene = this;
    this._pendingAdd.push(entity);
    if (!this._updating) this._flush();
    return entity;
  }

  /** Remove an entity. Destroyed immediately, or at the end of the step if mid-update. */
  remove(entity) {
    this._dead.add(entity);
    if (!this._updating) this._flush();
  }

  /** Entities whose `tag` equals `tag` or whose `tags` array includes it. */
  getByTag(tag) {
    return this.entities.filter((e) => e.tag === tag || (Array.isArray(e.tags) && e.tags.includes(tag)));
  }

  /** Destroy every entity (called by the engine when the scene exits). */
  _teardown() {
    this._flush();
    const all = this.entities;
    this.entities = [];
    this._dead.clear();
    this._pendingAdd.length = 0;
    for (const e of all) {
      e.destroy?.();
      e.destroyed = true;
      e.scene = null;
    }
  }

  _flush() {
    if (this._pendingAdd.length) {
      const adding = this._pendingAdd;
      this._pendingAdd = [];
      for (const e of adding) {
        this.entities.push(e);
        e.destroyed = false;
        e.init?.(this);
      }
    }
    if (this._dead.size) {
      const dead = this._dead;
      this._dead = new Set();
      this.entities = this.entities.filter((e) => !dead.has(e));
      for (const e of dead) {
        e.destroy?.();
        e.destroyed = true;
        e.scene = null;
      }
    }
  }
}

// =============================================================================================
// GameEngine
// =============================================================================================

const DEFAULT_TRANSITION = { type: 'fade', duration: 0.4, color: '#000' };

function normalizeTransition(t) {
  if (!t || t === 'none') return null;
  const base = t === true || t === 'fade' ? {} : t;
  const out = { ...DEFAULT_TRANSITION, ...base };
  return out.duration > 0 ? out : null;
}

export class GameEngine {
  /**
   * @param {object} [options]
   * @param {HTMLCanvasElement|string|null} [options.canvas]  Element, CSS selector, or omitted
   *        (a canvas is created and appended to `document.body`).
   * @param {number} [options.width=960]            Logical width.
   * @param {number} [options.height=540]           Logical height.
   * @param {string|null} [options.backgroundColor='#000']
   * @param {number} [options.fixedTimeStep=1/60]   Seconds per simulation step; 0 = variable dt.
   * @param {number} [options.maxFrameTime=0.25]    Longest real frame time simulated (seconds).
   * @param {number} [options.maxSubSteps=5]        Max fixed steps per rendered frame.
   * @param {boolean} [options.pauseOnHidden=true]  Auto-pause while the tab is hidden.
   * @param {boolean|'auto'} [options.showTouchControls='auto']
   * @param {Record<string,string[]>} [options.bindings]  Key bindings (see InputManager).
   * @param {boolean} [options.pixelArt]
   * @param {boolean} [options.integerScaling]
   * @param {number} [options.maxPixelRatio]
   * Environment hooks (mainly for tests): `window`, `document`, `requestAnimationFrame`,
   * `cancelAnimationFrame`.
   */
  constructor(options = {}) {
    const win = options.window ?? globalThis.window ?? null;
    const doc = options.document ?? globalThis.document ?? null;
    this._win = win;
    this._doc = doc;
    this._requestFrame =
      options.requestAnimationFrame ?? (win?.requestAnimationFrame ? win.requestAnimationFrame.bind(win) : null);
    this._cancelFrame =
      options.cancelAnimationFrame ?? (win?.cancelAnimationFrame ? win.cancelAnimationFrame.bind(win) : null);

    this.width = options.width ?? 960;
    this.height = options.height ?? 540;
    this.fixedTimeStep = options.fixedTimeStep ?? 1 / 60;
    this.maxFrameTime = options.maxFrameTime ?? 0.25;
    this.maxSubSteps = options.maxSubSteps ?? 5;
    this.pauseOnHidden = options.pauseOnHidden ?? true;
    this.showTouchControls = options.showTouchControls ?? 'auto';

    this.canvas = this._resolveCanvas(options.canvas);
    this.renderer = new Renderer(this.canvas, {
      width: this.width,
      height: this.height,
      backgroundColor: options.backgroundColor,
      pixelArt: options.pixelArt,
      integerScaling: options.integerScaling,
      maxPixelRatio: options.maxPixelRatio,
      window: win,
    });
    this.camera = new Camera({ width: this.width, height: this.height });
    this.collision = new CollisionSystem();
    this.input = new InputManager({
      keyTarget: win,
      pointerTarget: this.canvas,
      toLogical: (x, y) => this.renderer.clientToLogical(x, y),
      bindings: options.bindings,
    });

    /** 'idle' | 'running' | 'paused' | 'stopped' */
    this.state = 'idle';
    this._scene = null;
    this._sceneData = undefined;
    this._transition = null;
    this._deferred = [];
    this._inUpdate = false;
    this._autoPaused = false;
    this._last = null;
    this._acc = 0;
    this._rafId = null;
    this._listeners = new Map();

    /** Simulated seconds since start/restart. */
    this.elapsed = 0;
    /** Rendered frames since start. */
    this.frame = 0;
    /** Simulation steps since start. */
    this.updateCount = 0;
    /** Smoothed frames per second. */
    this.fps = 0;

    this._loop = this._loop.bind(this);
    this._onResize = () => {
      this.renderer.resize();
      this._emit('resize', { scale: this.renderer.scale });
    };
    this._onVisibility = () => this._handleVisibility();
  }

  // ---- public API: lifecycle ---------------------------------------------------------------

  /** Start the loop. Idempotent while running or paused. */
  start() {
    if (this.state === 'running' || this.state === 'paused') return;
    if (!this._requestFrame) throw new Error('GameEngine: no requestAnimationFrame available');
    this.state = 'running';
    this._last = null;
    this._acc = 0;
    this.renderer.resize();
    this.input.attach();
    this._win?.addEventListener?.('resize', this._onResize);
    this._win?.addEventListener?.('orientationchange', this._onResize);
    this._doc?.addEventListener?.('visibilitychange', this._onVisibility);
    this._rafId = this._requestFrame(this._loop);
    this._emit('start');
  }

  /** Stop updating but keep rendering (so overlays can draw). No-op unless running. */
  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this._scene?.onPause?.();
    this._emit('pause');
  }

  /** Continue after `pause`. The time spent paused is discarded: no catch-up, no jump. */
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this._last = null;
    this._acc = 0;
    this._autoPaused = false;
    this._scene?.onResume?.();
    this._emit('resume');
  }

  togglePause() {
    if (this.state === 'running') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  /**
   * Restart the current scene: `onExit`, destroy entities, reset camera/collisions/timers,
   * then `onEnter` again with the data it was first given. Also leaves the paused state.
   * Deferred to the end of the step when called from inside `update`.
   */
  restart() {
    if (this._inUpdate) {
      this._deferred.push(() => this._applyRestart());
    } else {
      this._applyRestart();
    }
  }

  /** Stop the loop and detach all listeners. `start()` can be called again afterwards. */
  stop() {
    if (this.state === 'idle' || this.state === 'stopped') return;
    this.state = 'stopped';
    if (this._rafId !== null) this._cancelFrame?.(this._rafId);
    this._rafId = null;
    this.input.detach();
    this._win?.removeEventListener?.('resize', this._onResize);
    this._win?.removeEventListener?.('orientationchange', this._onResize);
    this._doc?.removeEventListener?.('visibilitychange', this._onVisibility);
    this._emit('stop');
  }

  // ---- public API: simulation & drawing ----------------------------------------------------

  /**
   * Advance the simulation by one step of `deltaTime` seconds. Normally called by the loop,
   * but safe to call manually (tests, tools). Order: transition -> scene.update ->
   * camera.update -> clear step input edges -> deferred scene changes.
   */
  update(deltaTime) {
    this.elapsed += deltaTime;
    this.updateCount++;

    this._inUpdate = true;
    try {
      const frozen = this._transition?.phase === 'out';
      if (this._transition) this._advanceTransition(deltaTime);
      if (!frozen && this._scene) {
        this._scene.update(deltaTime);
        this.camera.update(deltaTime);
      }
    } finally {
      this._inUpdate = false;
    }
    this.input.endStep();

    if (this._deferred.length) {
      const jobs = this._deferred;
      this._deferred = [];
      for (const job of jobs) job();
    }
  }

  /**
   * Draw the current scene through the Renderer pipeline.
   * @param {number} [alpha=1] Fixed-step interpolation factor (0..1) passed to render hooks.
   */
  render(alpha = 1) {
    const tr = this._transition;
    let overlay = null;
    if (tr) {
      const p = tr.duration > 0 ? Math.min(1, tr.t / tr.duration) : 1;
      overlay = { color: tr.color, alpha: tr.phase === 'out' ? p : 1 - p };
    }
    const showTouch = this.showTouchControls === true || (this.showTouchControls === 'auto' && this.input.hasTouched);
    this.renderer.render(this._scene, this.camera, alpha, {
      overlay,
      touchButtons: showTouch ? this.input.getTouchButtons() : null,
      isButtonDown: (a) => this.input.isDown(a),
    });
  }

  /**
   * Run one loop iteration for a `requestAnimationFrame`-style timestamp (milliseconds).
   * The loop calls this; tests can call it directly with synthetic timestamps.
   */
  tick(timestamp) {
    if (this.state === 'idle' || this.state === 'stopped') return;

    const now = timestamp / 1000;
    let frameDt = this._last === null ? 0 : now - this._last;
    this._last = now;
    if (!(frameDt > 0)) frameDt = 0;
    // Tab suspension / debugger pauses: never simulate more than maxFrameTime in one frame.
    if (frameDt > this.maxFrameTime) frameDt = this.maxFrameTime;

    this.frame++;
    if (frameDt > 0) {
      const inst = 1 / frameDt;
      this.fps = this.fps === 0 ? inst : this.fps + (inst - this.fps) * 0.1;
    }

    this._emit('frame', frameDt);

    let alpha = 1;
    if (this.state === 'running') {
      const fixed = this.fixedTimeStep;
      if (fixed > 0) {
        this._acc += frameDt;
        let steps = 0;
        while (this._acc >= fixed && steps < this.maxSubSteps && this.state === 'running') {
          this.update(fixed);
          this._acc -= fixed;
          steps++;
        }
        if (steps === this.maxSubSteps && this._acc >= fixed) this._acc = 0; // drop, don't spiral
        alpha = this._acc / fixed;
      } else if (frameDt > 0) {
        this.update(frameDt);
      }
    } else {
      this.input.endStep(); // nothing consumes step edges while paused
    }

    this.render(alpha);
    this.input.endFrame();
  }

  // ---- public API: scenes ------------------------------------------------------------------

  /**
   * Switch scenes. The first scene is entered immediately. Afterwards, by default the switch is
   * immediate; pass a transition for a fade:
   *   setScene(next, { transition: true })                                  // 0.4s black fade
   *   setScene(next, { transition: { duration: 0.6, color: '#fff' }, data })
   * During a fade-out the outgoing scene is frozen; the incoming scene runs during fade-in.
   * Calls made from inside `update` take effect at the end of that step.
   *
   * @param {Scene|null} scene
   * @param {object} [options]
   * @param {*} [options.data]  Passed to `scene.onEnter(engine, data)`.
   * @param {boolean|'fade'|'none'|{type?:string,duration?:number,color?:string}} [options.transition]
   */
  setScene(scene, options = {}) {
    if (this._inUpdate) {
      this._deferred.push(() => this._applySetScene(scene, options));
    } else {
      this._applySetScene(scene, options);
    }
  }

  // ---- public API: accessors ---------------------------------------------------------------

  getInput() {
    return this.input;
  }
  getCamera() {
    return this.camera;
  }
  getCollisionSystem() {
    return this.collision;
  }
  getRenderer() {
    return this.renderer;
  }
  getScene() {
    return this._scene;
  }
  getState() {
    return this.state;
  }
  /** True while a scene transition (fade) is in progress. */
  isTransitioning() {
    return this._transition !== null;
  }
  getStats() {
    return { fps: this.fps, frame: this.frame, updates: this.updateCount, elapsed: this.elapsed };
  }

  /**
   * Subscribe to engine events: 'start', 'pause', 'resume', 'restart', 'stop', 'resize',
   * 'scenechange' ({from, to}) and 'frame' (dt) — 'frame' fires once per rendered frame, even
   * while paused, before any updates; use it with `input.wasPressedThisFrame` for hotkeys.
   * Returns an unsubscribe function.
   */
  on(event, listener) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    this._listeners.get(event)?.delete(listener);
  }

  // ---- internals ---------------------------------------------------------------------------

  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) fn(payload);
  }

  _resolveCanvas(canvas) {
    if (canvas && typeof canvas === 'object') return canvas;
    const doc = this._doc;
    if (!doc) throw new Error('GameEngine: no canvas given and no document available');
    if (typeof canvas === 'string') {
      const el = doc.querySelector(canvas);
      if (!el) throw new Error(`GameEngine: canvas "${canvas}" not found`);
      return el;
    }
    const el = doc.createElement('canvas');
    doc.body.appendChild(el);
    return el;
  }

  _loop(timestamp) {
    if (this.state === 'idle' || this.state === 'stopped') return;
    // Schedule first so a throwing scene cannot silently kill the loop.
    this._rafId = this._requestFrame(this._loop);
    this.tick(timestamp);
  }

  _handleVisibility() {
    const hidden = this._doc?.hidden === true;
    if (hidden) {
      this.input.releaseAll(); // keys released while hidden would otherwise stay stuck
      if (this.pauseOnHidden && this.state === 'running') {
        this._autoPaused = true;
        this.pause();
      }
    } else {
      this._last = null; // first frame back has dt = 0
      this._acc = 0;
      if (this._autoPaused) {
        this._autoPaused = false;
        this.resume();
      }
    }
  }

  _applySetScene(scene, options) {
    const transition = normalizeTransition(options.transition);
    const tr = this._transition;
    if (tr && tr.phase === 'out') {
      tr.next = scene;
      tr.data = options.data;
      return;
    }
    this._transition = null; // cancel a fade-in that is still running
    if (!this._scene || !transition) {
      this._swap(scene, options.data);
      return;
    }
    this._transition = { phase: 'out', t: 0, duration: transition.duration, color: transition.color, next: scene, data: options.data };
  }

  _advanceTransition(dt) {
    const tr = this._transition;
    tr.t += dt;
    if (tr.t < tr.duration) return;
    if (tr.phase === 'out') {
      this._swap(tr.next, tr.data);
      tr.phase = 'in';
      tr.t = 0;
      tr.next = null;
      tr.data = undefined;
    } else {
      this._transition = null;
    }
  }

  _applyRestart() {
    this._transition = null;
    this._autoPaused = false;
    this.elapsed = 0;
    this._acc = 0;
    this._last = null;
    if (this.state === 'paused') this.state = 'running';
    if (this._scene) this._swap(this._scene, this._sceneData);
    this._emit('restart');
  }

  _swap(next, data) {
    const prev = this._scene;
    if (prev) {
      prev.onExit?.();
      prev._teardown?.();
    }
    this.collision.clear();
    this.camera.reset();
    this.input.endStep();
    this._scene = next;
    this._sceneData = data;
    if (next) {
      next.engine = this;
      next.onEnter?.(this, data);
      next._flush?.();
    }
    this._emit('scenechange', { from: prev, to: next });
  }
}
