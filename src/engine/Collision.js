/**
 * Collision — AABB utilities plus a CollisionSystem that resolves movement against
 * solid and one-way platforms.
 *
 * Colliders are plain rects: `{ x, y, width, height }` in WORLD coordinates. They are stored by
 * reference, so an entity (or a moving platform) can register itself and its live position is
 * used on every query. Remove colliders when their owner is destroyed.
 *
 * Collider kinds
 *   - solid:   blocks movement from every direction.
 *   - one-way: blocks only a body that is moving DOWN and whose bottom edge was at or above the
 *              platform's top edge before the move. Sideways and upward movement pass through,
 *              and a body can be told to ignore them to drop through.
 */

/** Tolerance that keeps a body resting exactly on a surface from being "inside" it. */
const EPS = 1e-4;

// ---- stateless helpers ---------------------------------------------------------------------

/** Strict AABB overlap: rects that merely touch do NOT overlap. */
export function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** Inclusive point-in-rect test. */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

/**
 * Minimum translation vector that moves `a` out of `b`, or null if they do not overlap.
 * Returns `{ x, y }` where exactly one component is non-zero.
 */
export function getPenetration(a, b) {
  if (!rectsOverlap(a, b)) return null;
  const pushRight = b.x + b.width - a.x;
  const pushLeft = a.x + a.width - b.x;
  const pushDown = b.y + b.height - a.y;
  const pushUp = a.y + a.height - b.y;
  const px = pushRight < pushLeft ? pushRight : -pushLeft;
  const py = pushDown < pushUp ? pushDown : -pushUp;
  return Math.abs(px) <= Math.abs(py) ? { x: px, y: 0 } : { x: 0, y: py };
}

/** Circles are `{ x, y, radius }` (x/y = centre). */
export function circlesOverlap(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const r = a.radius + b.radius;
  return dx * dx + dy * dy < r * r;
}

export function circleRectOverlap(circle, rect) {
  const nx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const ny = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
  const dx = circle.x - nx;
  const dy = circle.y - ny;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

/** Overlap test with EPS tolerance on all sides (used by movement resolution). */
function overlaps(x, y, w, h, c) {
  return (
    x + w > c.x + EPS &&
    x < c.x + c.width - EPS &&
    y + h > c.y + EPS &&
    y < c.y + c.height - EPS
  );
}

function overlapsX(x, w, c) {
  return x + w > c.x + EPS && x < c.x + c.width - EPS;
}

// ---- CollisionSystem -----------------------------------------------------------------------

export class CollisionSystem {
  constructor() {
    /** @type {Array<{x:number,y:number,width:number,height:number}>} */
    this._solids = [];
    this._oneWay = [];
  }

  get solids() {
    return this._solids;
  }
  get oneWayPlatforms() {
    return this._oneWay;
  }

  /** Register a collider that blocks from all sides. Returns the collider. */
  addSolid(collider) {
    if (!this._solids.includes(collider)) this._solids.push(collider);
    return collider;
  }

  /** Register a one-way (jump-through) platform. Returns the collider. */
  addOneWay(collider) {
    if (!this._oneWay.includes(collider)) this._oneWay.push(collider);
    return collider;
  }

  /** Register a collider, choosing the kind from `collider.oneWay === true`. */
  add(collider) {
    return collider.oneWay === true ? this.addOneWay(collider) : this.addSolid(collider);
  }

  /** Unregister a collider of either kind. Returns true if it was registered. */
  remove(collider) {
    let removed = false;
    for (const list of [this._solids, this._oneWay]) {
      const i = list.indexOf(collider);
      if (i !== -1) {
        list.splice(i, 1);
        removed = true;
      }
    }
    return removed;
  }

  clear() {
    this._solids.length = 0;
    this._oneWay.length = 0;
  }

  /**
   * All registered colliders strictly overlapping `rect`.
   * @param {object} [filter]
   * @param {boolean} [filter.solid=true]
   * @param {boolean} [filter.oneWay=true]
   */
  queryRect(rect, { solid = true, oneWay = true } = {}) {
    const out = [];
    if (solid) for (const c of this._solids) if (rectsOverlap(rect, c)) out.push(c);
    if (oneWay) for (const c of this._oneWay) if (rectsOverlap(rect, c)) out.push(c);
    return out;
  }

  /**
   * Is there a surface directly beneath `rect`? Returns the collider or null.
   * One-way platforms count only if the rect's bottom is at or above their top.
   *
   * @param {object} [options]
   * @param {number} [options.distance=1]       Probe distance below the rect.
   * @param {boolean} [options.ignoreOneWay=false]
   * @param {Iterable<object>} [options.ignore]  Colliders to skip.
   */
  isGrounded(rect, { distance = 1, ignoreOneWay = false, ignore = null } = {}) {
    const skip = ignore ? new Set(ignore) : null;
    for (const s of this._solids) {
      if (skip && skip.has(s)) continue;
      if (overlaps(rect.x, rect.y + distance, rect.width, rect.height, s)) return s;
    }
    if (!ignoreOneWay) {
      const bottom = rect.y + rect.height;
      for (const p of this._oneWay) {
        if (skip && skip.has(p)) continue;
        if (overlapsX(rect.x, rect.width, p) && bottom <= p.y + EPS && bottom + distance > p.y + EPS) {
          return p;
        }
      }
    }
    return null;
  }

  /**
   * Move a rect by (dx, dy) and resolve collisions. Pure: does NOT modify `rect`.
   *
   * X is resolved first (solids only), then Y (solids, plus one-way platforms when moving down).
   * Movement is sub-stepped so fast bodies cannot tunnel through thin colliders.
   *
   * @param {{x:number,y:number,width:number,height:number}} rect
   * @param {number} dx
   * @param {number} dy
   * @param {object} [options]
   * @param {boolean} [options.ignoreOneWay=false]  Fall through all one-way platforms.
   * @param {Iterable<object>} [options.ignore]     Specific colliders to ignore.
   * @param {number} [options.maxStep]              Largest sub-step in world units.
   * @returns {{x:number,y:number,movedX:number,movedY:number,hitLeft:boolean,hitRight:boolean,
   *   hitTop:boolean,hitBottom:boolean,ground:object|null,colliders:object[]}}
   */
  move(rect, dx, dy, options = {}) {
    const { ignoreOneWay = false, ignore = null } = options;
    const skip = ignore ? new Set(ignore) : null;
    const w = rect.width;
    const h = rect.height;
    const maxStep = options.maxStep ?? Math.max(1, Math.min(w, h) / 2);

    let x = rect.x;
    let y = rect.y;
    const result = {
      x,
      y,
      movedX: 0,
      movedY: 0,
      hitLeft: false,
      hitRight: false,
      hitTop: false,
      hitBottom: false,
      ground: null,
      colliders: [],
    };
    const touch = (c) => {
      if (!result.colliders.includes(c)) result.colliders.push(c);
    };

    // --- X axis: solids only ---
    if (dx !== 0) {
      const n = Math.ceil(Math.abs(dx) / maxStep);
      const step = dx / n;
      for (let i = 0; i < n; i++) {
        x += step;
        let blocked = false;
        for (const s of this._solids) {
          if (skip && skip.has(s)) continue;
          if (!overlaps(x, y, w, h, s)) continue;
          if (step > 0) {
            x = s.x - w;
            result.hitRight = true;
          } else {
            x = s.x + s.width;
            result.hitLeft = true;
          }
          touch(s);
          blocked = true;
        }
        if (blocked) break;
      }
    }

    // --- Y axis: solids, plus one-way platforms when moving down ---
    if (dy !== 0) {
      const n = Math.ceil(Math.abs(dy) / maxStep);
      const step = dy / n;
      for (let i = 0; i < n; i++) {
        const prevBottom = y + h;
        y += step;
        let blocked = false;
        for (const s of this._solids) {
          if (skip && skip.has(s)) continue;
          if (!overlaps(x, y, w, h, s)) continue;
          if (step > 0) {
            y = s.y - h;
            result.hitBottom = true;
            result.ground = s;
          } else {
            y = s.y + s.height;
            result.hitTop = true;
          }
          touch(s);
          blocked = true;
        }
        if (step > 0 && !ignoreOneWay) {
          for (const p of this._oneWay) {
            if (skip && skip.has(p)) continue;
            if (overlapsX(x, w, p) && prevBottom <= p.y + EPS && y + h > p.y + EPS) {
              y = p.y - h;
              result.hitBottom = true;
              result.ground = p;
              touch(p);
              blocked = true;
            }
          }
        }
        if (blocked) break;
      }
    }

    result.x = x;
    result.y = y;
    result.movedX = x - rect.x;
    result.movedY = y - rect.y;
    return result;
  }

  /**
   * Like `move`, but writes the resolved position back to `body.x` / `body.y`.
   * (Writing an entity's own world position is fine; only the camera is forbidden from doing so.)
   */
  moveBody(body, dx, dy, options) {
    const result = this.move(body, dx, dy, options);
    body.x = result.x;
    body.y = result.y;
    return result;
  }
}
