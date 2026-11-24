/**
 * Camera — a read-only "window" onto world space.
 *
 * Coordinate model
 *   - World space: the coordinates every entity lives in. Never changed by the camera.
 *   - Screen space: logical canvas pixels (0..viewportWidth, 0..viewportHeight).
 *   - `x`/`y` are the world position of the camera's top-left corner.
 *   - `zoom` scales world -> screen (2 = everything twice as large).
 *
 * The camera only ever READS target positions (see `follow`). It has no API that writes to an
 * entity, so scrolling can never alter world coordinates.
 */

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

export class Camera {
  /**
   * @param {object} [options]
   * @param {number} [options.width=960]   Logical viewport width (screen units).
   * @param {number} [options.height=540]  Logical viewport height (screen units).
   * @param {number} [options.zoom=1]
   * @param {() => number} [options.random=Math.random]  RNG used for shake (injectable for tests).
   */
  constructor({ width = 960, height = 540, zoom = 1, random = Math.random } = {}) {
    this.x = 0;
    this.y = 0;
    this.viewportWidth = width;
    this.viewportHeight = height;
    this._zoom = zoom;
    /** @type {{x:number,y:number,width:number,height:number}|null} */
    this.bounds = null;
    this.random = random;
    this._target = null;
    this._follow = null;
    this._shake = { time: 0, duration: 0, intensity: 0, x: 0, y: 0 };
  }

  /** Zoom factor (> 0). Setting it keeps the view centred on the same world point. */
  get zoom() {
    return this._zoom;
  }
  set zoom(value) {
    this.setZoom(value);
  }

  /** Visible world width (viewport / zoom). */
  get width() {
    return this.viewportWidth / this._zoom;
  }
  /** Visible world height (viewport / zoom). */
  get height() {
    return this.viewportHeight / this._zoom;
  }
  get centerX() {
    return this.x + this.width / 2;
  }
  get centerY() {
    return this.y + this.height / 2;
  }

  /** Change the logical viewport size (called by the engine; rarely needed directly). */
  setViewport(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this._clamp();
  }

  setZoom(zoom) {
    if (!(zoom > 0)) throw new RangeError('Camera zoom must be > 0');
    const cx = this.centerX;
    const cy = this.centerY;
    this._zoom = zoom;
    this.centerOn(cx, cy);
  }

  /**
   * Restrict the camera so the view never leaves this world rectangle.
   * If the world is smaller than the view on an axis, the world is centred on that axis.
   */
  setBounds(x, y, width, height) {
    this.bounds = { x, y, width, height };
    this._clamp();
  }

  clearBounds() {
    this.bounds = null;
  }

  /**
   * Follow a target. The target is any object with numeric `x`, `y` and optionally
   * `width`/`height` (its centre is followed). It is only ever read.
   *
   * @param {{x:number,y:number,width?:number,height?:number}} target
   * @param {object} [options]
   * @param {number} [options.offsetX=0]   World-space offset added to the target centre.
   * @param {number} [options.offsetY=0]
   * @param {number} [options.smoothing=0] Time constant in seconds (0 = rigid follow).
   *                                       Frame-rate independent: after `smoothing` seconds the
   *                                       camera has closed ~63% of the gap.
   * @param {{width:number,height:number}|null} [options.deadzone=null]
   *        World-space box around the view centre in which the target can move without
   *        scrolling the camera.
   * @param {boolean} [options.snap=true]  Jump to the target immediately.
   */
  follow(target, { offsetX = 0, offsetY = 0, smoothing = 0, deadzone = null, snap = true } = {}) {
    this._target = target;
    this._follow = { offsetX, offsetY, smoothing, deadzone };
    if (snap && target) {
      const { x, y } = this._targetPoint();
      this.centerOn(x, y);
    }
  }

  unfollow() {
    this._target = null;
    this._follow = null;
  }

  get target() {
    return this._target;
  }

  /** Advance follow/shake logic. Called by the engine once per simulation step. */
  update(deltaTime) {
    if (this._target && this._follow) {
      const { smoothing, deadzone } = this._follow;
      const p = this._targetPoint();
      let dx = p.x - this.centerX;
      let dy = p.y - this.centerY;
      if (deadzone) {
        const hw = deadzone.width / 2;
        const hh = deadzone.height / 2;
        dx = Math.abs(dx) > hw ? dx - Math.sign(dx) * hw : 0;
        dy = Math.abs(dy) > hh ? dy - Math.sign(dy) * hh : 0;
      }
      const k = smoothing > 0 ? 1 - Math.exp(-deltaTime / smoothing) : 1;
      this.x += dx * k;
      this.y += dy * k;
    }
    this._clamp();
    this._updateShake(deltaTime);
  }

  /** Put the view's top-left corner at a world position. */
  snapTo(x, y) {
    this.x = x;
    this.y = y;
    this._clamp();
  }

  /** Centre the view on a world position. */
  centerOn(x, y) {
    this.x = x - this.width / 2;
    this.y = y - this.height / 2;
    this._clamp();
  }

  /** Screen shake. Affects only the render offset, never `x`/`y`. */
  shake(intensity, duration) {
    this._shake.intensity = intensity;
    this._shake.duration = duration;
    this._shake.time = duration;
  }

  /** Render-time camera X: position plus shake offset. */
  getRenderX() {
    return this.x + this._shake.x;
  }
  getRenderY() {
    return this.y + this._shake.y;
  }

  /** World -> screen (logical canvas pixels). Ignores shake. */
  worldToScreen(worldX, worldY, out = {}) {
    out.x = (worldX - this.x) * this._zoom;
    out.y = (worldY - this.y) * this._zoom;
    return out;
  }

  /** Screen (logical canvas pixels) -> world. Ignores shake. */
  screenToWorld(screenX, screenY, out = {}) {
    out.x = screenX / this._zoom + this.x;
    out.y = screenY / this._zoom + this.y;
    return out;
  }

  /** Does a world-space rect intersect the view (grown by `margin` world units)? */
  isVisible(rect, margin = 0) {
    return (
      rect.x + rect.width >= this.x - margin &&
      rect.x <= this.x + this.width + margin &&
      rect.y + rect.height >= this.y - margin &&
      rect.y <= this.y + this.height + margin
    );
  }

  /** Back to a pristine state (called on scene change). Keeps viewport size. */
  reset() {
    this.x = 0;
    this.y = 0;
    this._zoom = 1;
    this.bounds = null;
    this.unfollow();
    this._shake.time = 0;
    this._shake.x = 0;
    this._shake.y = 0;
  }

  // ---- internals ---------------------------------------------------------------------------

  _targetPoint() {
    const t = this._target;
    const f = this._follow;
    return {
      x: t.x + (t.width || 0) / 2 + f.offsetX,
      y: t.y + (t.height || 0) / 2 + f.offsetY,
    };
  }

  _clamp() {
    const b = this.bounds;
    if (!b) return;
    const maxX = b.x + b.width - this.width;
    const maxY = b.y + b.height - this.height;
    this.x = maxX < b.x ? b.x + (maxX - b.x) / 2 : clamp(this.x, b.x, maxX);
    this.y = maxY < b.y ? b.y + (maxY - b.y) / 2 : clamp(this.y, b.y, maxY);
  }

  _updateShake(deltaTime) {
    const s = this._shake;
    if (s.time > 0) {
      s.time = Math.max(0, s.time - deltaTime);
      const falloff = s.duration > 0 ? s.time / s.duration : 0;
      s.x = (this.random() * 2 - 1) * s.intensity * falloff;
      s.y = (this.random() * 2 - 1) * s.intensity * falloff;
    } else {
      s.x = 0;
      s.y = 0;
    }
  }
}
