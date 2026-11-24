/**
 * Renderer — canvas setup, responsive scaling and the draw pipeline.
 *
 * Scaling model
 *   The game draws in a fixed LOGICAL resolution (default 960x540) regardless of window size.
 *   `resize()` fits that resolution inside the available area ("contain", aspect preserved),
 *   sizes the canvas via CSS, and sets a sharp backing store using the device pixel ratio.
 *   The canvas element is exactly the game area; centre/letterbox it with page CSS
 *   (e.g. a flex-centred, full-height body).
 *
 * Draw pipeline (one call to `render`)
 *   1. clear                      (screen space)
 *   2. scene.renderBackground     (screen space — skies, parallax)
 *   3. scene.renderWorld          (world space — camera transform applied)
 *   4. scene.renderUI             (screen space — HUD, menus)
 *   5. touch buttons              (screen space, when shown)
 *   6. transition overlay         (screen space)
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {number} [options.width=960]    Logical width.
   * @param {number} [options.height=540]   Logical height.
   * @param {string|null} [options.backgroundColor='#000']  null = transparent clear.
   * @param {boolean} [options.pixelArt=false]       Disable image smoothing.
   * @param {boolean} [options.integerScaling=false] Only scale by whole numbers (when >= 1).
   * @param {boolean} [options.pixelSnapCamera=true] Round the camera offset to whole logical px.
   * @param {number} [options.maxPixelRatio=2]       Cap on devicePixelRatio (fill-rate on phones).
   * @param {Window} [options.window]
   * @param {HTMLElement|null} [options.resizeTarget] Element to fit into; null = the window.
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: options.backgroundColor === null });
    this.width = options.width ?? 960;
    this.height = options.height ?? 540;
    this.backgroundColor = options.backgroundColor === undefined ? '#000' : options.backgroundColor;
    this.pixelArt = options.pixelArt ?? false;
    this.integerScaling = options.integerScaling ?? false;
    this.pixelSnapCamera = options.pixelSnapCamera ?? true;
    this.maxPixelRatio = options.maxPixelRatio ?? 2;
    this.window = options.window ?? globalThis.window ?? null;
    this.resizeTarget = options.resizeTarget ?? null;

    /** CSS pixels per logical unit. */
    this.scale = 1;
    /** Device pixel ratio actually used (after the cap). */
    this.pixelRatio = 1;
    this._sx = 1;
    this._sy = 1;
    this.resize(this.width, this.height, 1);
  }

  /**
   * Recompute canvas size. With no arguments, measures the resize target (or window) and the
   * device pixel ratio. Arguments exist so tests and custom layouts can drive it explicitly.
   *
   * @param {number} [availWidth]   Available CSS width.
   * @param {number} [availHeight]  Available CSS height.
   * @param {number} [pixelRatio]
   */
  resize(availWidth, availHeight, pixelRatio) {
    const target = this.resizeTarget;
    const win = this.window;
    const aw = availWidth ?? (target ? target.clientWidth : win?.innerWidth) ?? this.width;
    const ah = availHeight ?? (target ? target.clientHeight : win?.innerHeight) ?? this.height;
    if (!(aw > 0) || !(ah > 0)) return; // hidden / collapsed container: keep the last size

    const dpr = Math.min(pixelRatio ?? win?.devicePixelRatio ?? 1, this.maxPixelRatio);
    let scale = Math.min(aw / this.width, ah / this.height);
    if (this.integerScaling && scale >= 1) scale = Math.floor(scale);

    const cssW = this.width * scale;
    const cssH = this.height * scale;
    const backW = Math.max(1, Math.round(cssW * dpr));
    const backH = Math.max(1, Math.round(cssH * dpr));

    if (this.canvas.width !== backW) this.canvas.width = backW;
    if (this.canvas.height !== backH) this.canvas.height = backH;
    if (this.canvas.style) {
      this.canvas.style.width = `${cssW}px`;
      this.canvas.style.height = `${cssH}px`;
      this.canvas.style.display = 'block';
      if (this.pixelArt) this.canvas.style.imageRendering = 'pixelated';
    }

    this.scale = scale;
    this.pixelRatio = dpr;
    this._sx = backW / this.width;
    this._sy = backH / this.height;
    this.ctx.imageSmoothingEnabled = !this.pixelArt; // resizing resets context state
  }

  /** Convert client (page) coordinates to logical canvas coordinates. */
  clientToLogical(clientX, clientY, out = {}) {
    const r = this.canvas.getBoundingClientRect();
    const w = r.width || this.width;
    const h = r.height || this.height;
    out.x = ((clientX - r.left) * this.width) / w;
    out.y = ((clientY - r.top) * this.height) / h;
    return out;
  }

  /** Reset to the base (logical, screen-space) transform and clear. */
  beginFrame() {
    const ctx = this.ctx;
    ctx.setTransform(this._sx, 0, 0, this._sy, 0, 0);
    if (this.backgroundColor === null) {
      ctx.clearRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  /** Enter world space: draw calls after this use world coordinates. Pair with `endWorld`. */
  beginWorld(camera) {
    const ctx = this.ctx;
    const z = camera.zoom;
    let cx = camera.getRenderX();
    let cy = camera.getRenderY();
    if (this.pixelSnapCamera) {
      cx = Math.round(cx * z) / z;
      cy = Math.round(cy * z) / z;
    }
    ctx.save();
    ctx.scale(z, z);
    ctx.translate(-cx, -cy);
  }

  endWorld() {
    this.ctx.restore();
  }

  /**
   * Run the full pipeline for one frame.
   *
   * @param {object|null} scene  Scene (or any object with the optional render hooks).
   * @param {import('./Camera.js').Camera} camera
   * @param {number} [alpha=1]   Fixed-step interpolation factor (0..1).
   * @param {object} [extras]
   * @param {Array} [extras.touchButtons]
   * @param {(action:string)=>boolean} [extras.isButtonDown]
   * @param {{color:string, alpha:number}|null} [extras.overlay]  Full-screen fade colour.
   */
  render(scene, camera, alpha = 1, extras = {}) {
    this.beginFrame();
    if (scene) {
      scene.renderBackground?.(this, alpha);
      this.beginWorld(camera);
      try {
        scene.renderWorld?.(this, camera, alpha);
      } finally {
        this.endWorld();
      }
      scene.renderUI?.(this, alpha);
    }
    if (extras.touchButtons && extras.touchButtons.length) {
      this.drawTouchButtons(extras.touchButtons, extras.isButtonDown);
    }
    if (extras.overlay && extras.overlay.alpha > 0) {
      this.drawOverlay(extras.overlay.color, extras.overlay.alpha);
    }
  }

  // ---- drawing helpers (use in whichever space is active) ------------------------------------

  fillRect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  strokeRect(x, y, w, h, color, lineWidth = 1) {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, w, h);
  }

  circle(x, y, radius, color) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  text(str, x, y, { font = '14px monospace', color = '#fff', align = 'left', baseline = 'top' } = {}) {
    const ctx = this.ctx;
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(str, x, y);
  }

  image(img, x, y, w, h) {
    if (w === undefined) this.ctx.drawImage(img, x, y);
    else this.ctx.drawImage(img, x, y, w, h);
  }

  /** Full-screen colour wash (screen space). */
  drawOverlay(color, alpha) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this._sx, 0, 0, this._sy, 0, 0);
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  /** Simple translucent on-screen buttons (screen space). */
  drawTouchButtons(buttons, isDown = () => false) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this._sx, 0, 0, this._sy, 0, 0);
    for (const b of buttons) {
      const { x, y, width, height } = b.rect;
      ctx.globalAlpha = isDown(b.action) ? 0.55 : 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, width, height);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      if (b.label) {
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = '#000000';
        ctx.font = '20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(b.label, x + width / 2, y + height / 2);
      }
    }
    ctx.restore();
  }
}
