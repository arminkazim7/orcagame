/** Deterministic, frame-rate independent platform physics for the orca. */
export const PLAYER_CONTROLS = Object.freeze({
  left: ['ArrowLeft', 'KeyA', 'a', 'A'],
  right: ['ArrowRight', 'KeyD', 'd', 'D'],
  jump: ['Space', 'ArrowUp', 'KeyW', ' ', 'w', 'W'],
  down: ['ArrowDown', 'KeyS', 's', 'S'],
  shoot: ['KeyX', 'KeyF', 'x', 'X', 'f', 'F']
});

const pw = p => p.width ?? p.w ?? 0;
const ph = p => p.height ?? p.h ?? 0;
const isOneWay = p => p.oneWay === true || p.isOneWay === true || p.type === 'oneWay';

export function inputDown(input, keys, action = null) {
  if (!input) return false;
  // Query named actions first so keyboard and touch share the same controls.
  if (action && typeof input.isDown === 'function' && input.isDown(action)) return true;
  if (action && input[action] === true) return true;
  for (const key of keys) {
    if (typeof input.isDown === 'function' && input.isDown(key)) return true;
    if (typeof input.isKeyDown === 'function' && input.isKeyDown(key)) return true;
    if (input.keys?.[key] || input[key] === true) return true;
  }
  return false;
}

export class OrcaPhysics {
  constructor(options = {}) {
    this.moveSpeed = options.moveSpeed ?? 250;
    this.acceleration = options.acceleration ?? 1800;
    this.gravity = options.gravity ?? 1450;
    this.maxFallSpeed = options.maxFallSpeed ?? 900;
    this.jumpVelocity = options.jumpVelocity ?? 570;
    this.airControl = options.airControl ?? 0.82;
    this.dropThroughMs = 180;
    this.jumpWasDown = false;
    this.dropWasDown = false;
    this.dropTimer = 0;
  }

  resetTransientState() {
    this.jumpWasDown = false;
    this.dropWasDown = false;
    this.dropTimer = 0;
  }

  update(orca, deltaTime, input, platforms = [], hooks = {}) {
    const dt = Math.min(Math.max(deltaTime, 0), 1 / 30);
    const left = inputDown(input, PLAYER_CONTROLS.left, 'left');
    const right = inputDown(input, PLAYER_CONTROLS.right, 'right');
    const down = inputDown(input, PLAYER_CONTROLS.down, 'down');
    const jump = inputDown(input, PLAYER_CONTROLS.jump, 'jump');
    const drop = inputDown(input, ['dropThrough'], 'dropThrough');
    const jumpPressed = jump && !this.jumpWasDown;
    const dropPressed = drop && !this.dropWasDown;
    this.jumpWasDown = jump;
    this.dropWasDown = drop;

    const direction = (right ? 1 : 0) - (left ? 1 : 0);
    if (direction) orca.facing = direction;
    const control = orca.grounded ? 1 : this.airControl;
    const targetVx = direction * this.moveSpeed * orca.sizeScale;
    const step = this.acceleration * control * dt;
    orca.vx += Math.max(-step, Math.min(step, targetVx - orca.vx));
    if (!direction && orca.grounded) orca.vx *= Math.max(0, 1 - 12 * dt);

    if ((dropPressed || (jumpPressed && down)) && this.#standingOnOneWay(orca, platforms)) {
      this.dropTimer = this.dropThroughMs;
      orca.y += 3;
      orca.grounded = false;
      orca.vy = Math.max(80, orca.vy);
      hooks.onDropThrough?.();
    } else if (jumpPressed && orca.grounded) {
      orca.vy = -this.jumpVelocity * orca.jumpScale;
      orca.grounded = false;
      hooks.onJump?.();
    }

    this.dropTimer = Math.max(0, this.dropTimer - dt * 1000);
    const previousBottom = orca.y + orca.height;
    orca.x += orca.vx * dt;
    this.#resolveHorizontal(orca, platforms);

    orca.vy = Math.min(this.maxFallSpeed, orca.vy + this.gravity * dt);
    orca.y += orca.vy * dt;
    orca.grounded = false;
    this.#resolveVertical(orca, platforms, previousBottom);
    orca.animationState = !orca.grounded ? (orca.vy < 0 ? 'jump' : 'fall') : Math.abs(orca.vx) > 12 ? 'swim' : 'idle';
  }

  #standingOnOneWay(orca, platforms) {
    const feet = orca.y + orca.height;
    return platforms.some(p => isOneWay(p) && Math.abs(feet - p.y) <= 5 && orca.x + orca.width > p.x && orca.x < p.x + pw(p));
  }

  #resolveHorizontal(orca, platforms) {
    for (const p of platforms) {
      if (isOneWay(p) || !this.#overlapY(orca, p)) continue;
      if (orca.vx > 0 && orca.x < p.x && orca.x + orca.width > p.x) {
        orca.x = p.x - orca.width;
      } else if (orca.vx < 0 && orca.x + orca.width > p.x + pw(p) && orca.x < p.x + pw(p)) {
        orca.x = p.x + pw(p);
      }
    }
  }

  #resolveVertical(orca, platforms, previousBottom) {
    for (const p of platforms) {
      if (orca.x + orca.width <= p.x || orca.x >= p.x + pw(p)) continue;
      if (isOneWay(p)) {
        if (this.dropTimer > 0 || orca.vy < 0) continue;
        if (previousBottom <= p.y + 2 && orca.y + orca.height >= p.y) {
          orca.y = p.y - orca.height;
          orca.vy = 0;
          orca.grounded = true;
        }
        continue;
      }
      if (orca.vy >= 0 && previousBottom <= p.y + 2 && orca.y + orca.height >= p.y) {
        orca.y = p.y - orca.height;
        orca.vy = 0;
        orca.grounded = true;
      } else if (orca.vy < 0 && orca.y <= p.y + ph(p) && orca.y + orca.height > p.y + ph(p)) {
        orca.y = p.y + ph(p);
        orca.vy = 0;
      }
    }
  }

  #overlapY(orca, p) {
    return orca.y + orca.height > p.y && orca.y < p.y + ph(p);
  }
}
