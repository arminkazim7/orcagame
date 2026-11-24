/**
 * Engine test scene — NOT game content.
 *
 * Demonstrates the engine foundation only:
 *   - scrolling   : a 3200x900 world viewed through a 960x540 camera (deadzone + smoothing)
 *   - input       : arrows/WASD to move, Space/Z to jump, touch buttons on mobile
 *   - collision   : solid ground/walls/ceiling block, plus one-way platforms to jump up through
 *                   (hold Down + Jump to drop through one)
 *   - lifecycle   : P/Esc pause, R restart, T fade to a second scene
 *
 * `DemoBox` is a throw-away physics rectangle used to exercise the collision system. It is
 * not the player; the player agent owns the real implementation.
 */
import { Entity, Scene } from '../src/engine/GameEngine.js';

export const WORLD_WIDTH = 3200;
export const WORLD_HEIGHT = 900;
export const GROUND_Y = 820;

const GRAVITY = 2000;
const MOVE_SPEED = 260;
const JUMP_SPEED = 760;
const MAX_FALL = 1200;

/** A static rect that registers itself with the collision system. */
class Block extends Entity {
  constructor(x, y, width, height, { oneWay = false, color } = {}) {
    super({ x, y, width, height, layer: 1, tag: oneWay ? 'oneway' : 'solid' });
    this.oneWay = oneWay;
    this.color = color ?? (oneWay ? '#4caf7d' : '#5b6575');
  }

  init(scene) {
    scene.engine.getCollisionSystem().add(this);
  }

  destroy() {
    this.scene?.engine?.getCollisionSystem().remove(this);
  }

  render(ctx, renderer) {
    if (this.oneWay) {
      renderer.fillRect(this.x, this.y, this.width, this.height, this.color);
      renderer.fillRect(this.x, this.y, this.width, 3, '#a5f0c4');
    } else {
      renderer.fillRect(this.x, this.y, this.width, this.height, this.color);
      renderer.fillRect(this.x, this.y, this.width, 3, '#8a95a8');
    }
  }
}

/** Reference grid so scrolling is visible. Always drawn, never culled. */
class Grid extends Entity {
  constructor() {
    super({ layer: 0 });
    this.cullable = false;
  }

  render(ctx, renderer) {
    const cam = this.scene.engine.getCamera();
    const x0 = Math.floor(cam.x / 100) * 100;
    const y0 = Math.floor(cam.y / 100) * 100;
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    for (let x = x0; x <= cam.x + cam.width + 100; x += 100) {
      ctx.moveTo(x, cam.y - 100);
      ctx.lineTo(x, cam.y + cam.height + 100);
    }
    for (let y = y0; y <= cam.y + cam.height + 100; y += 100) {
      ctx.moveTo(cam.x - 100, y);
      ctx.lineTo(cam.x + cam.width + 100, y);
    }
    ctx.stroke();
    for (let x = x0; x <= cam.x + cam.width; x += 400) {
      renderer.text(String(x), x + 4, GROUND_Y - 24, { font: '12px monospace', color: 'rgba(255,255,255,0.35)' });
    }
  }
}

/** Throw-away controllable rectangle used to exercise input + collision. */
export class DemoBox extends Entity {
  constructor(x, y) {
    super({ x, y, width: 32, height: 48, layer: 2, tag: 'demo-box' });
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.lastMove = null;
    this.spawn = { x, y };
  }

  update(dt, scene) {
    const engine = scene.engine;
    const input = engine.getInput();
    const collision = engine.getCollisionSystem();

    this.vx = input.getAxis('left', 'right') * MOVE_SPEED;

    const dropThrough = input.isDown('down') && input.wasPressed('jump');
    if (input.wasPressed('jump') && this.onGround && !dropThrough) this.vy = -JUMP_SPEED;
    if (dropThrough && this.onGround) this._dropUntilY = this.y + this.height + 2;

    this.vy = Math.min(this.vy + GRAVITY * dt, MAX_FALL);

    // While dropping, ignore one-way platforms until clear of them.
    const ignoreOneWay = this._dropUntilY !== undefined && this.y + this.height < this._dropUntilY + 40;
    if (!ignoreOneWay) this._dropUntilY = undefined;

    const r = collision.moveBody(this, this.vx * dt, this.vy * dt, { ignoreOneWay });
    this.lastMove = r;
    if (r.hitBottom || r.hitTop) this.vy = 0;
    this.onGround = r.hitBottom;

    if (this.y > WORLD_HEIGHT + 200) {
      this.x = this.spawn.x;
      this.y = this.spawn.y;
      this.vy = 0;
    }
  }

  render(ctx, renderer) {
    renderer.fillRect(this.x, this.y, this.width, this.height, this.onGround ? '#ffd166' : '#ef476f');
    renderer.fillRect(this.x + 20, this.y + 10, 6, 6, '#111'); // eye, so facing-less box has life
  }
}

/** Screen-space readout. */
class Hud extends Entity {
  constructor(box) {
    super({ layer: 10 });
    this.box = box;
    this.cullable = false;
  }

  renderUI(ctx, renderer) {
    const engine = this.scene.engine;
    const cam = engine.getCamera();
    const input = engine.getInput();
    const held = ['left', 'right', 'up', 'down', 'jump'].filter((a) => input.isDown(a)).join(' ') || '-';
    const lines = [
      `fps ${engine.fps.toFixed(0)}   state ${engine.getState()}`,
      `box   x ${this.box.x.toFixed(0)}  y ${this.box.y.toFixed(0)}  ${this.box.onGround ? 'GROUNDED' : 'airborne'}`,
      `camera x ${cam.x.toFixed(0)}  y ${cam.y.toFixed(0)}  (box world coords unchanged by camera)`,
      `input ${held}`,
      'arrows/WASD move · Space/Z jump · Down+Jump drop · P pause · R restart · T scene fade',
    ];
    lines.forEach((l, i) => renderer.text(l, 12, 10 + i * 18, { font: '13px monospace', color: '#e8e8e8' }));
  }
}

export class DemoScene extends Scene {
  constructor() {
    super();
    this.worldWidth = WORLD_WIDTH;
    this.worldHeight = WORLD_HEIGHT;
  }

  onEnter(engine) {
    const camera = engine.getCamera();
    camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

    this.add(new Grid());

    // Ground and boundary walls (solid)
    this.add(new Block(0, GROUND_Y, WORLD_WIDTH, WORLD_HEIGHT - GROUND_Y));
    this.add(new Block(-40, 0, 40, WORLD_HEIGHT));
    this.add(new Block(WORLD_WIDTH, 0, 40, WORLD_HEIGHT));

    // A solid wall to bump into, and a solid ledge with an overhead block (ceiling test)
    this.add(new Block(900, GROUND_Y - 160, 40, 160));
    this.add(new Block(1500, GROUND_Y - 120, 220, 120));
    this.add(new Block(1500, GROUND_Y - 300, 220, 40));

    // One-way staircase: jump up through them, land on top
    this.add(new Block(300, GROUND_Y - 110, 160, 16, { oneWay: true }));
    this.add(new Block(520, GROUND_Y - 220, 160, 16, { oneWay: true }));
    this.add(new Block(740, GROUND_Y - 330, 160, 16, { oneWay: true }));
    this.add(new Block(2000, GROUND_Y - 110, 300, 16, { oneWay: true }));
    this.add(new Block(2400, GROUND_Y - 220, 300, 16, { oneWay: true }));

    this.box = this.add(new DemoBox(100, GROUND_Y - 48));
    this.add(new Hud(this.box));

    camera.follow(this.box, { smoothing: 0.12, deadzone: { width: 120, height: 80 } });

    // Touch buttons (logical screen coordinates). Shown automatically after the first touch.
    const input = engine.getInput();
    input.clearTouchButtons();
    input.addTouchButton('left', { x: 24, y: 410, width: 100, height: 100 }, '◀');
    input.addTouchButton('right', { x: 140, y: 410, width: 100, height: 100 }, '▶');
    input.addTouchButton('jump', { x: 836, y: 410, width: 100, height: 100 }, '▲');
  }

  renderBackground(renderer) {
    const g = renderer.ctx.createLinearGradient?.(0, 0, 0, renderer.height);
    if (g) {
      g.addColorStop(0, '#1b2433');
      g.addColorStop(1, '#2b3a55');
      renderer.ctx.fillStyle = g;
      renderer.ctx.fillRect(0, 0, renderer.width, renderer.height);
    }
  }
}

export class SecondScene extends Scene {
  onEnter(engine, data) {
    this.label = data?.label ?? 'Second scene';
  }

  renderBackground(renderer) {
    renderer.fillRect(0, 0, renderer.width, renderer.height, '#3d2a4f');
    renderer.text(this.label, renderer.width / 2, renderer.height / 2 - 12, {
      font: '28px monospace',
      align: 'center',
    });
    renderer.text('press T to fade back', renderer.width / 2, renderer.height / 2 + 24, {
      font: '16px monospace',
      align: 'center',
      color: '#cbb8e0',
    });
  }
}
