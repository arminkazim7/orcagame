/**
 * InputManager — keyboard, touch and mouse input mapped to named actions.
 *
 * Design rules
 *   - Keyboard and touch are independent sources that are OR-ed per action, so using one never
 *     blocks the other and any number of keys/touches can be held at once.
 *   - Actions ("left", "jump", ...) are what game code reads. Keys are bound to actions with
 *     `bind`; on-screen touch buttons are bound to actions with `addTouchButton`.
 *   - Edges (`wasPressed`/`wasReleased`) exist at two granularities:
 *       step-level  — cleared after every simulation step; use inside `update`.
 *       frame-level — cleared after every rendered frame; use for UI / engine-level hotkeys
 *                     (`wasPressedThisFrame`, `wasReleasedThisFrame`).
 *     This keeps an edge visible to exactly one `update` even when the simulation runs
 *     0, 1 or several fixed steps per frame.
 */

export const DEFAULT_BINDINGS = Object.freeze({
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  jump: ['Space', 'KeyZ'],
  action: ['KeyX', 'KeyJ'],
  confirm: ['Enter'],
  pause: ['Escape', 'KeyP'],
});

function isEditable(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
}

function inRect(px, py, r) {
  return px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height;
}

export class InputManager {
  /**
   * @param {object} [options]
   * @param {EventTarget} [options.keyTarget]      Receives key events (default: `window`).
   * @param {EventTarget} [options.pointerTarget]  Receives touch/mouse events (usually the canvas).
   * @param {(clientX:number, clientY:number) => {x:number,y:number}} [options.toLogical]
   *        Converts client coordinates to logical canvas coordinates (the engine supplies this).
   * @param {Record<string,string[]>} [options.bindings]  Action -> KeyboardEvent.code list.
   * @param {boolean} [options.preventTouchDefault=true]
   */
  constructor(options = {}) {
    this.keyTarget = options.keyTarget ?? globalThis.window ?? null;
    this.pointerTarget = options.pointerTarget ?? null;
    this.toLogical = options.toLogical ?? ((x, y) => ({ x, y }));
    this.preventTouchDefault = options.preventTouchDefault ?? true;

    /** @type {Map<string,string[]>} */
    this._bindings = new Map();
    for (const [action, codes] of Object.entries(options.bindings ?? DEFAULT_BINDINGS)) {
      this._bindings.set(action, [...codes]);
    }

    this._keysDown = new Set();
    this._actionDown = new Map();
    this._touchHolds = new Map(); // touch id -> Set(actions)
    this._touchCounts = new Map(); // action -> number of touches holding it
    this._touchButtons = new Map(); // id -> { id, action, rect, label }
    this._touches = new Map(); // touch id -> { id, x, y }
    this._nextButtonId = 1;

    this._stepPressed = new Set();
    this._stepReleased = new Set();
    this._framePressed = new Set();
    this._frameReleased = new Set();

    this._mouse = { x: 0, y: 0, down: false, pressed: false, released: false };

    /** True once any touch has been seen; the engine uses it to auto-show touch buttons. */
    this.hasTouched = false;
    this._attached = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onTouch = this._onTouch.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  // ---- lifecycle ---------------------------------------------------------------------------

  get isAttached() {
    return this._attached;
  }

  /** Start listening. Idempotent. */
  attach() {
    if (this._attached) return;
    this._attached = true;
    const k = this.keyTarget;
    if (k) {
      k.addEventListener('keydown', this._onKeyDown);
      k.addEventListener('keyup', this._onKeyUp);
      k.addEventListener('blur', this._onBlur);
      k.addEventListener('mouseup', this._onMouseUp);
    }
    const p = this.pointerTarget;
    if (p) {
      const opts = { passive: false };
      p.addEventListener('touchstart', this._onTouch, opts);
      p.addEventListener('touchmove', this._onTouch, opts);
      p.addEventListener('touchend', this._onTouchEnd, opts);
      p.addEventListener('touchcancel', this._onTouchEnd, opts);
      p.addEventListener('mousedown', this._onMouseDown);
      p.addEventListener('mousemove', this._onMouseMove);
    }
  }

  /** Stop listening and release everything. Idempotent. */
  detach() {
    if (!this._attached) return;
    this._attached = false;
    const k = this.keyTarget;
    if (k) {
      k.removeEventListener('keydown', this._onKeyDown);
      k.removeEventListener('keyup', this._onKeyUp);
      k.removeEventListener('blur', this._onBlur);
      k.removeEventListener('mouseup', this._onMouseUp);
    }
    const p = this.pointerTarget;
    if (p) {
      p.removeEventListener('touchstart', this._onTouch);
      p.removeEventListener('touchmove', this._onTouch);
      p.removeEventListener('touchend', this._onTouchEnd);
      p.removeEventListener('touchcancel', this._onTouchEnd);
      p.removeEventListener('mousedown', this._onMouseDown);
      p.removeEventListener('mousemove', this._onMouseMove);
    }
    this.releaseAll();
  }

  /** Call after every simulation step (the engine does this). Clears step-level edges. */
  endStep() {
    this._stepPressed.clear();
    this._stepReleased.clear();
  }

  /** Call after every rendered frame (the engine does this). Clears frame-level edges. */
  endFrame() {
    this._framePressed.clear();
    this._frameReleased.clear();
    this._mouse.pressed = false;
    this._mouse.released = false;
  }

  /** Release every key, touch and mouse button (produces release edges). */
  releaseAll() {
    this._keysDown.clear();
    for (const id of [...this._touchHolds.keys()]) this._setTouchActions(id, new Set());
    this._touches.clear();
    if (this._mouse.down) {
      this._mouse.down = false;
      this._mouse.released = true;
    }
    for (const action of this._allActions()) this._refresh(action);
  }

  // ---- bindings ----------------------------------------------------------------------------

  /** Replace the key codes bound to an action (`KeyboardEvent.code` values). */
  bind(action, codes) {
    this._bindings.set(action, Array.isArray(codes) ? [...codes] : [codes]);
    this._refresh(action);
  }

  unbind(action) {
    this._bindings.delete(action);
    this._refresh(action);
  }

  getBindings() {
    const out = {};
    for (const [action, codes] of this._bindings) out[action] = [...codes];
    return out;
  }

  // ---- queries -----------------------------------------------------------------------------

  /** Is the action held (by keyboard OR touch)? */
  isDown(action) {
    return this._actionDown.get(action) === true;
  }

  /** Did the action go down since the last simulation step? Use in `update`. */
  wasPressed(action) {
    return this._stepPressed.has(action);
  }

  /** Did the action go up since the last simulation step? Use in `update`. */
  wasReleased(action) {
    return this._stepReleased.has(action);
  }

  /** Frame-level edge: pressed since the last rendered frame. Use for UI / engine hotkeys. */
  wasPressedThisFrame(action) {
    return this._framePressed.has(action);
  }

  wasReleasedThisFrame(action) {
    return this._frameReleased.has(action);
  }

  /** -1, 0 or +1 from two actions (both held cancel out). */
  getAxis(negativeAction, positiveAction) {
    return (this.isDown(positiveAction) ? 1 : 0) - (this.isDown(negativeAction) ? 1 : 0);
  }

  /** Raw key query by `KeyboardEvent.code`. */
  isKeyDown(code) {
    return this._keysDown.has(code);
  }

  // ---- touch buttons & pointers --------------------------------------------------------------

  /**
   * Add an on-screen button. `rect` is in LOGICAL screen coordinates (not world coordinates).
   * Holding a touch on it holds `action`. Returns a button id.
   */
  addTouchButton(action, rect, label = '') {
    const id = this._nextButtonId++;
    this._touchButtons.set(id, { id, action, rect: { ...rect }, label });
    return id;
  }

  removeTouchButton(id) {
    const b = this._touchButtons.get(id);
    if (!b) return false;
    this._touchButtons.delete(id);
    // Re-evaluate every active touch against the remaining buttons.
    for (const t of this._touches.values()) this._setTouchActions(t.id, this._hitActions(t.x, t.y));
    return true;
  }

  clearTouchButtons() {
    for (const id of [...this._touchButtons.keys()]) this.removeTouchButton(id);
  }

  getTouchButtons() {
    return [...this._touchButtons.values()];
  }

  /** Active touches in logical coordinates: `[{ id, x, y }]`. Treat as read-only. */
  getTouches() {
    return [...this._touches.values()];
  }

  /**
   * Mouse state in logical coordinates. `pressed`/`released` are frame-level edges.
   * Treat the returned object as read-only.
   */
  getMouse() {
    return this._mouse;
  }

  // ---- keyboard handlers -------------------------------------------------------------------

  _actionsForCode(code) {
    const out = [];
    for (const [action, codes] of this._bindings) if (codes.includes(code)) out.push(action);
    return out;
  }

  _onKeyDown(e) {
    if (isEditable(e.target)) return;
    const code = e.code;
    if (!code) return;
    const actions = this._actionsForCode(code);
    if (actions.length && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault?.();
    if (this._keysDown.has(code)) return; // auto-repeat
    this._keysDown.add(code);
    for (const a of actions) this._refresh(a);
  }

  _onKeyUp(e) {
    const code = e.code;
    if (!code || !this._keysDown.delete(code)) return;
    for (const a of this._actionsForCode(code)) this._refresh(a);
  }

  _onBlur() {
    this.releaseAll();
  }

  // ---- touch handlers ----------------------------------------------------------------------

  _onTouch(e) {
    this.hasTouched = true;
    const list = e.changedTouches;
    for (let i = 0; i < list.length; i++) this._touchPoint(list[i]);
    if (this.preventTouchDefault) e.preventDefault?.();
  }

  _onTouchEnd(e) {
    const list = e.changedTouches;
    for (let i = 0; i < list.length; i++) {
      const id = list[i].identifier;
      this._touches.delete(id);
      this._setTouchActions(id, new Set());
    }
    if (this.preventTouchDefault) e.preventDefault?.();
  }

  _touchPoint(touch) {
    const p = this.toLogical(touch.clientX, touch.clientY);
    this._touches.set(touch.identifier, { id: touch.identifier, x: p.x, y: p.y });
    this._setTouchActions(touch.identifier, this._hitActions(p.x, p.y));
  }

  _hitActions(x, y) {
    const hit = new Set();
    for (const b of this._touchButtons.values()) if (inRect(x, y, b.rect)) hit.add(b.action);
    return hit;
  }

  _setTouchActions(touchId, next) {
    const prev = this._touchHolds.get(touchId) ?? new Set();
    for (const a of prev) {
      if (!next.has(a)) {
        this._touchCounts.set(a, Math.max(0, (this._touchCounts.get(a) ?? 0) - 1));
        this._refresh(a);
      }
    }
    for (const a of next) {
      if (!prev.has(a)) {
        this._touchCounts.set(a, (this._touchCounts.get(a) ?? 0) + 1);
        this._refresh(a);
      }
    }
    if (next.size) this._touchHolds.set(touchId, next);
    else this._touchHolds.delete(touchId);
  }

  // ---- mouse handlers ----------------------------------------------------------------------

  _onMouseMove(e) {
    const p = this.toLogical(e.clientX, e.clientY);
    this._mouse.x = p.x;
    this._mouse.y = p.y;
  }

  _onMouseDown(e) {
    this._onMouseMove(e);
    if (!this._mouse.down) {
      this._mouse.down = true;
      this._mouse.pressed = true;
    }
  }

  _onMouseUp() {
    if (this._mouse.down) {
      this._mouse.down = false;
      this._mouse.released = true;
    }
  }

  // ---- state recomputation -----------------------------------------------------------------

  _allActions() {
    return new Set([...this._bindings.keys(), ...this._touchCounts.keys(), ...this._actionDown.keys()]);
  }

  _refresh(action) {
    const codes = this._bindings.get(action);
    const keyDown = codes ? codes.some((c) => this._keysDown.has(c)) : false;
    const touchDown = (this._touchCounts.get(action) ?? 0) > 0;
    const next = keyDown || touchDown;
    const prev = this._actionDown.get(action) === true;
    if (next === prev) return;
    this._actionDown.set(action, next);
    if (next) {
      this._stepPressed.add(action);
      this._framePressed.add(action);
    } else {
      this._stepReleased.add(action);
      this._frameReleased.add(action);
    }
  }
}
