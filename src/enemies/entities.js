import { getDifficulty } from './difficulty.js';

let nextId = 1;

/** Shared combatant protection interface (duck-typed):
 *  players/power-ups implement: getBounds(), isInvulnerable(), onDamaged?(amount, source) */

export function createEnemy(type, x, y, { level = 1, difficulty = 'easy', platform = null, rng = Math.random, idFactory = () => 0 } = {}) {
  const d = getDifficulty(difficulty);
  const base = {
    id: idFactory(),
    type,
    x, y,
    vx: 0, vy: 0,
    dead: false,
    hitFlash: 0,
    touchCooldown: 0,
    t: rng() * Math.PI * 2,
    difficultyKey: difficulty,
    palette: { walker: '#7a4fd0', flyer: '#c94f9e', shooter: '#4fae5c' }[type] || '#888',
  };

  if (type === 'walker') {
    return Object.assign(base, {
      w: 26, h: 24, hp: 2, speed: d.enemySpeed, dir: rng() < 0.5 ? -1 : 1,
      patrolMin: platform ? platform.x : 0,
      patrolMax: platform ? platform.x + platform.w - 26 : Infinity,
    });
  }
  if (type === 'flyer') {
    return Object.assign(base, {
      w: 24, h: 20, hp: 2, speed: d.flyerSpeed, dir: rng() < 0.5 ? -1 : 1,
      hoverAmp: 14, hoverFreq: 2.2,
      patrolMin: platform ? platform.x - 40 : 0,
      patrolMax: platform ? platform.x + platform.w + 14 : Infinity,
    });
  }
  // shooter
  return Object.assign(base, {
    w: 24, h: 28, hp: 3, speed: d.enemySpeed * 0.4, dir: 1,
    fireCooldown: 1.6 * d.fireRateScale, fireTimer: 0.6 + rng(),
    range: 320,
    patrolMin: platform ? platform.x : 0,
    patrolMax: platform ? platform.x + platform.w - 24 : Infinity,
  });
}

export function createProjectile(x, y, vx, vy, { owner = 'enemy', damage = 1, radius = 5, gravity = 0, color = null, ttl = 4, idFactory = () => 0 } = {}) {
  return {
    id: idFactory(), x, y, vx, vy,
    owner, damage, radius, gravity, ttl,
    color: color || (owner === 'player' ? '#ffe066' : '#ff6b6b'),
  };
}

export function createParticle(x, y, color, rng = Math.random) {
  const a = rng() * Math.PI * 2;
  const s = 40 + rng() * 120;
  return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5 + rng() * 0.4, maxLife: 0.9, size: 2 + rng() * 3, color };
}



