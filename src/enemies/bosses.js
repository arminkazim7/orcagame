import { bossHealthFor } from './difficulty.js';
import { createProjectile, createParticle } from './entities.js';

/**
 * Five visually distinct bosses, one per world.
 * `easyHealth` is the Easy-mode max HP; Hard is exactly double (enforced in spawnBoss).
 * `pattern` names the unique attack routine handled by runBossPattern().
 */
export const BOSS_DEFS = {
  1: {
    world: 1, name: 'Ember Colossus', shape: 'brute',
    color: '#b03a2e', accent: '#e67e22', eyeColor: '#ffd166',
    w: 96, h: 92, easyHealth: 32,
    walkSpeed: 40, attackInterval: 2.2,
    pattern: 'fire-lob',           // lobs arcing fireballs toward the player
    projectile: { kind: 'lob', color: '#ff7043', damage: 2, gravity: 900, speed: 260 },
  },
  2: {
    world: 2, name: 'Frost Sentinel', shape: 'crystal',
    color: '#2874a6', accent: '#aed6f1', eyeColor: '#eaf6ff',
    w: 84, h: 100, easyHealth: 42,
    walkSpeed: 30, attackInterval: 2.6,
    pattern: 'ice-spread',         // 5-way shard spread, slow glide
    projectile: { kind: 'straight', color: '#9fd8ff', damage: 1, gravity: 0, speed: 320 },
  },
  3: {
    world: 3, name: 'Storm Serpent', shape: 'serpent',
    color: '#117864', accent: '#f7dc6f', eyeColor: '#fff176',
    w: 110, h: 54, easyHealth: 52,
    walkSpeed: 55, attackInterval: 3.0,
    pattern: 'dash-charge',        // telegraphs, then dashes across the arena dropping bolts
    projectile: { kind: 'straight', color: '#fff59d', damage: 1, gravity: 300, speed: 340 },
  },
  4: {
    world: 4, name: 'Gloom Warden', shape: 'warden',
    color: '#5b2c6f', accent: '#d2b4de', eyeColor: '#ebdef0',
    w: 90, h: 104, easyHealth: 62,
    walkSpeed: 35, attackInterval: 2.4,
    pattern: 'radial-summon',      // radial bursts; periodically summons a minion enemy
    projectile: { kind: 'radial', color: '#bb8fce', damage: 1, gravity: 0, speed: 240 },
  },
  5: {
    world: 5, name: 'Void Sovereign', shape: 'sovereign',
    color: '#1c2833', accent: '#a569bd', eyeColor: '#d7bde2',
    w: 100, h: 110, easyHealth: 76,
    walkSpeed: 45, attackInterval: 2.0,
    pattern: 'teleport-barrage',   // teleports around the arena, then ring barrages
    projectile: { kind: 'radial', color: '#c39bd3', damage: 2, gravity: 0, speed: 280 },
  },
};

export const DEFEAT_ANIMATION_DURATION = 1.4; // seconds

export function createBoss(world, difficultyKey, arena) {
  const def = BOSS_DEFS[world];
  if (!def) throw new Error(`No boss defined for world ${world}. Valid worlds: 1-5.`);
  const maxHealth = bossHealthFor(def.easyHealth, difficultyKey); // hard === easy * 2 exactly
  return {
    id: `boss-w${world}`,
    def, world, arena,
    x: arena.x + arena.w / 2 - def.w / 2,
    y: arena.y - def.h,          // stands on arena floor
    vx: 0, vy: 0,
    dir: -1,
    w: def.w, h: def.h,
    health: maxHealth,
    maxHealth,
    attackTimer: def.attackInterval * 0.6,
    dashState: null,             // used by dash pattern
    teleportCooldown: 0,
    minionsSpawned: 0,
    phase: 1,                    // flips to 2 at <=50% health (faster/more aggressive)
    defeated: false,
    defeatTimer: 0,              // runs the defeat animation
    hitFlash: 0,
    difficultyKey,
  };
}

/** Runs the boss's unique attack pattern. `api` provides fire/spawn/rng/player access. */
export function runBossPattern(boss, dt, api) {
  const { def } = boss;
  const { fireProjectile, spawnMinion, rng } = api;
  const speedScale = boss.phase === 2 ? 0.65 : 1;   // phase 2 attacks more often
  const px = api.playerBounds.x + api.playerBounds.w / 2;
  const py = api.playerBounds.y + api.playerBounds.h / 2;
  const cx = boss.x + boss.w / 2;
  const cy = boss.y + boss.h / 2;

  boss.attackTimer -= dt;
  if (boss.attackTimer > 0) return;
  boss.attackTimer = def.attackInterval * speedScale;

  const p = def.projectile;
  switch (def.pattern) {
    case 'fire-lob': {
      // Two arcing fireballs aimed at the player's position.
      for (let i = 0; i < (boss.phase === 2 ? 3 : 2); i++) {
        const dx = px - cx + (i - 1) * 40;
        const dy = py - cy;
        fireProjectile(cx, boss.y, dx * 0.6, -Math.abs(dy) * 0.5 - 140,
          { owner: 'enemy', damage: p.damage, gravity: p.gravity, color: p.color, radius: 7, ttl: 6 });
      }
      break;
    }
    case 'ice-spread': {
      // 5-way fan of ice shards toward the player.
      const baseAngle = Math.atan2(py - cy, px - cx);
      for (let i = -2; i <= 2; i++) {
        const a = baseAngle + i * 0.22;
        fireProjectile(cx, cy, Math.cos(a) * p.speed, Math.sin(a) * p.speed,
          { owner: 'enemy', damage: p.damage, color: p.color, gravity: 0, ttl: 5 });
      }
      break;
    }
    case 'dash-charge': {
      // Alternate: bolt volley, then a fast horizontal dash across the arena.
      if (!boss.dashState) {
        fireProjectile(cx, cy, Math.sign(px - cx) * p.speed, 0,
          { owner: 'enemy', damage: p.damage, color: p.color, gravity: p.gravity, ttl: 5 });
        boss.dashState = { phase: 'telegraph', timer: 0.5 };
      } else if (boss.dashState.phase === 'telegraph') {
        boss.vx = Math.sign(px - cx || 1) * 420;
        boss.dashState = { phase: 'dashing', timer: 0.7 };
        fireProjectile(boss.x + boss.w / 2, boss.y + boss.h, 0, p.speed * 0.5,
          { owner: 'enemy', damage: 1, color: p.color, gravity: p.gravity, ttl: 4 });
      } else {
        boss.vx = 0;
        boss.dashState = null;
      }
      break;
    }
    case 'radial-summon': {
      // Radial burst; every third attack summons a minion instead.
      if (boss.minionsSpawned < 3 && (boss.attackCount = (boss.attackCount || 0) + 1) % 3 === 0) {
        spawnMinion('walker', boss.x + (rng() < 0.5 ? -60 : boss.w + 34), boss.y - 24);
        boss.minionsSpawned++;
      } else {
        const n = boss.phase === 2 ? 10 : 8;
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n + rng() * 0.2;
          fireProjectile(cx, cy, Math.cos(a) * p.speed, Math.sin(a) * p.speed,
            { owner: 'enemy', damage: p.damage, color: p.color, gravity: 0, ttl: 5 });
        }
      }
      break;
    }
    case 'teleport-barrage': {
      // Teleport near the player, then fire a ring; twice in phase 2.
      const hops = boss.phase === 2 ? 2 : 1;
      for (let h = 0; h < hops; h++) {
        const tx = Math.min(Math.max(px - boss.w / 2, boss.arena.x + 10), boss.arena.x + boss.arena.w - boss.w - 10);
        boss.x = tx;
        const n = 12;
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * 2 * i) / n + h * 0.26;
          fireProjectile(boss.x + boss.w / 2, boss.y + boss.h / 2, Math.cos(a) * p.speed, Math.sin(a) * p.speed,
            { owner: 'enemy', damage: p.damage, color: p.color, gravity: 0, ttl: 5 });
        }
      }
      break;
    }
    default:
      throw new Error(`Unknown boss pattern "${def.pattern}"`);
  }
}

