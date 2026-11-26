/**
 * Instance-scoped enemy/boss encounter simulation using the shared app event bus.
 */
import { getDifficulty, enemyCountFor, DIFFICULTIES } from './difficulty.js';
import { createEnemy, createProjectile, createParticle } from './entities.js';
import { BOSS_DEFS, createBoss, runBossPattern, DEFEAT_ANIMATION_DURATION } from './bosses.js';

export { DIFFICULTIES, BOSS_DEFS };

export class EncounterSystem {
  constructor(bus, options = {}) {
    if (!bus || typeof bus.on !== 'function' || typeof bus.emit !== 'function') throw new TypeError('EncounterSystem requires a shared EventBus');
    const nextId = () => state.nextId++;
// Module state
// ---------------------------------------------------------------------------
const state = {
  events: bus,
  enemies: [],
  projectiles: [],
  particles: [],
  bosses: new Map(),        // world -> boss
  activeBossWorld: null,
  stompEnabled: true,       // "optional stomp defeat"
  rng: options.rng ?? Math.random,
  contactGrace: options.contactGrace ?? 0.6,
  nextId: 1,
};


/** Configure this encounter instance. */
function configure({ stompEnabled, rng, contactGrace } = {}) {
  if (stompEnabled !== undefined) state.stompEnabled = !!stompEnabled;
  if (rng) state.rng = rng;
  if (contactGrace !== undefined) state.contactGrace = contactGrace;
}

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

/**
 * Spawn enemies for a level. Hard mode always spawns more than Easy.
 * @param {{level:number, difficulty:'easy'|'hard', platforms:Array<{x,y,w,h}>, rng?:Function}} opts
 * @returns {Array} the spawned enemies
 */
function spawnEnemies({ level, difficulty = 'easy', platforms = [], rng = state.rng }) {
  if (!platforms.length) return [];
  const count = enemyCountFor(level, difficulty);
  const spawned = [];

  for (let i = 0; i < count; i++) {
    const plat = platforms[i % platforms.length];
    // Mix of types varies with level so early levels stay gentle.
    const roll = rng();
    let type = 'walker';
    if (level >= 4 && roll < 0.25) type = 'shooter';
    else if (level >= 2 && roll < 0.5) type = 'flyer';

    const margin = 20;
    const spanW = Math.max(plat.w - margin * 2, 10);
    const x = plat.x + margin + rng() * spanW;

    const e = createEnemy(type, x, type === 'flyer' ? plat.y - 120 : plat.y - 28,
      { level, difficulty, platform: plat, rng, idFactory: nextId });
    spawned.push(e);
  }
  state.enemies.push(...spawned);
  return spawned;
}

/** Patrol + boundary turn + gravity/platform collision for one enemy. */
function updateEnemyMovement(e, dt, world) {
  if (e.type === 'flyer') {
    e.t += dt;
    e.x += e.dir * e.speed * dt;
    e.y += Math.sin(e.t * e.hoverFreq) * e.hoverAmp * dt * 8;
    if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
    if (e.x + e.w >= e.patrolMax) { e.x = e.patrolMax - e.w; e.dir = -1; }
    return;
  }

  // Walkers & shooters: gravity + land on platform tops.
  e.vy += (world.gravity ?? 1200) * dt;
  e.y += e.vy * dt;
  for (const p of world.platforms) {
    const overlapping = e.x + e.w > p.x && e.x < p.x + p.w;
    const crossingTop = e.vy >= 0 && e.y + e.h >= p.y && e.y + e.h - e.vy * dt <= p.y + 4;
    if (overlapping && crossingTop) {
      e.y = p.y - e.h;
      e.vy = 0;
      // Boundary turn: reverse when reaching the edge of the platform we stand on.
      if (e.x <= e.patrolMin) { e.x = e.patrolMin; e.dir = 1; }
      if (e.x + e.w >= e.patrolMax) { e.x = e.patrolMax - e.w; e.dir = -1; }
      break;
    }
  }
  e.x += e.dir * e.speed * dt;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Advance enemies: movement, contact damage (with power-up protection via the
 * shared interface), stomp defeat, and player-projectile hit detection.
 * @param {number} dt seconds
 * @param {object} world { player, platforms, playerProjectiles?, gravity?, bounds? }
 */
function updateEnemies(dt, world) {
  const { player } = world;
  const playerBounds = typeof player.getBounds === 'function' ? player.getBounds() : player;

  for (const e of state.enemies) {
    if (e.dead) continue;
    updateEnemyMovement(e, dt, world);
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    e.touchCooldown = Math.max(0, e.touchCooldown - dt);

    // --- Contact damage & stomp ---
    if (e.touchCooldown <= 0 && overlaps(e, playerBounds)) {
      const falling = typeof player.vy === 'number' && player.vy > 0;
      if (state.stompEnabled && falling && playerBounds.y + playerBounds.h - e.y < e.h * 0.5) {
        stompEnemy(e, player); // optional stomp defeat; does not own player bounce physics
      } else if (!(typeof player.isInvulnerable === 'function' && player.isInvulnerable())) {
        // Power-up protection honored through the shared interface.
        e.touchCooldown = state.contactGrace;
        emitPlayerDamage(world, getDifficulty(e.difficultyKey || 'easy').contactDamage, { source: 'contact', enemyType: e.type });
      }
    }

    // --- Shooter attack: fire an enemy projectile at the player ---
    if (e.type === 'shooter') {
      e.fireTimer -= dt;
      const pcx = playerBounds.x + playerBounds.w / 2;
      const dist = Math.abs(pcx - (e.x + e.w / 2));
      if (e.fireTimer <= 0 && dist < e.range) {
        e.fireTimer = e.fireCooldown;
        const dir = Math.sign(pcx - e.x) || 1;
        const d = getDifficulty(e.difficultyKey || 'easy');
        state.projectiles.push(createProjectile(e.x + e.w / 2, e.y + 8, dir * d.projectileSpeed, -40,
          { owner: 'enemy', damage: 1, color: '#8ef08e', idFactory: nextId }));
      }
    }
  }

  // --- Player projectiles vs enemies ---
  const playerProjectiles = world.playerProjectiles || [];
  for (const proj of playerProjectiles) {
    if (proj.consumed) continue;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const box = { x: e.x, y: e.y, w: e.w, h: e.h };
      const pb = { x: proj.x - proj.radius, y: proj.y - proj.radius, w: proj.radius * 2, h: proj.radius * 2 };
      if (overlaps(box, pb)) {
        proj.consumed = true;
        damageEnemy(e, proj.damage, { source: 'player-projectile' });
        break;
      }
    }
  }

  updateProjectiles(dt, world);
  updateParticles(dt);
}

/** Defeat by stomp. Emits 'enemy:stomped' so the player controller can bounce. */
function stompEnemy(e, player) {
  e.hp = 0;
  defeatEnemy(e, { cause: 'stomp' });
  state.events.emit('enemy.stomped', { enemyId: e.id, enemyType: e.type });
}

/** Apply damage to an enemy; handles defeat effects + event. Exposed per spec. */
function damageEnemy(enemy, amount, meta = {}) {
  if (!enemy || enemy.dead) return false;
  enemy.hp -= amount;
  enemy.hitFlash = 0.12;
  if (enemy.hp <= 0) {
    defeatEnemy(enemy, meta);
    return true;
  }
  state.events.emit('enemy.damaged', { enemyId: enemy.id, amount, ...meta });
  return false;
}

function defeatEnemy(e, meta = {}) {
  if (e.dead) return;
  e.dead = true;
  for (let i = 0; i < 10; i++) {
    state.particles.push(createParticle(e.x + e.w / 2, e.y + e.h / 2, e.palette, state.rng));
  }
  state.events.emit('enemy.defeated', { enemyId: e.id, enemyType: e.type, x: e.x, y: e.y, ...meta });
}

function emitPlayerDamage(world, amount, meta) {
  const applied = typeof world.player.onDamaged === 'function'
    ? world.player.onDamaged(amount, meta.source) === true
    : false;
  // Report only successful damage; invulnerability and protection must not cost lives.
  if (applied) state.events.emit('player.damaged', { amount, ...meta, applied: true });
}

// ---------------------------------------------------------------------------
// Bosses
// ---------------------------------------------------------------------------

/**
 * Spawn the boss for a world (bosses belong to worlds 1-5, met after levels 3, 6, 9, 12, 15).
 * Hard boss health is exactly twice Easy boss health (guaranteed).
 * @param {{world:number, difficulty:'easy'|'hard', arena:{x,y,w,h}}} opts
 */
function spawnBoss({ world, difficulty = 'easy', arena }) {
  if (!BOSS_DEFS[world]) throw new Error(`spawnBoss: no boss for world ${world} (valid: 1-5).`);
  const boss = createBoss(world, difficulty, arena);
  state.bosses.set(world, boss);
  state.activeBossWorld = world;
  return boss;
}

function resolveBoss(target) {
  if (typeof target === 'number') return state.bosses.get(target) || null;
  if (target && typeof target === 'object' && target.def) return state.bosses.get(target.world) || target;
  if (state.activeBossWorld != null) return state.bosses.get(state.activeBossWorld) || null;
  return null;
}

/** Apply damage to a boss. Accepts a boss object, a world number, or nothing (active boss). */
function damageBoss(target, amount, meta = {}) {
  const boss = resolveBoss(target);
  if (!boss || boss.defeated) return false;
  boss.health = Math.max(0, boss.health - amount);
  boss.hitFlash = 0.12;
  if (boss.health <= boss.maxHealth / 2) boss.phase = 2;
  state.events.emit('boss.damaged', { bossId: boss.id, world: boss.world, health: boss.health, maxHealth: boss.maxHealth, ...meta });

  if (boss.health <= 0) {
    boss.defeated = true;
    boss.defeatTimer = DEFEAT_ANIMATION_DURATION;
    boss.vx = 0;
    // 'boss:defeating' = animation starts; 'boss:defeated' fires when the animation finishes.
    state.events.emit('boss.defeating', { bossId: boss.id, world: boss.world });
    for (let i = 0; i < 24; i++) {
      state.particles.push(createParticle(boss.x + boss.w / 2, boss.y + boss.h / 2, boss.def.accent, state.rng));
    }
    return true;
  }
  return false;
}

/**
 * Advance the active/specified boss: movement, attack pattern, defeat animation.
 * @param {number} dt
 * @param {object} world { player, platforms, gravity?, bounds }
 */
function updateBoss(dt, world) {
  const boss = state.activeBossWorld != null ? state.bosses.get(state.activeBossWorld) : null;
  if (!boss) return;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt);

  if (boss.defeated) {
    // Defeat animation: shake, sink and fade out; then emit the final event.
    boss.defeatTimer -= dt;
    boss.y += 30 * dt;
    boss.x += Math.sin(boss.defeatTimer * 40) * 2;
    if (boss.defeatTimer <= 0 && !boss.defeatEventSent) {
      boss.defeatEventSent = true;
      state.events.emit('boss.defeated', { bossId: boss.id, world: boss.world });
    }
    return;
  }

  // Patrol back and forth across the arena; dash overrides patrol velocity.
  const { arena } = boss;
  const patrolling = !boss.dashState;
  if (patrolling) {
    boss.x += boss.def.walkSpeed * boss.dir * dt;
    if (boss.x <= arena.x + 8) boss.dir = 1;
    if (boss.x + boss.w >= arena.x + arena.w - 8) boss.dir = -1;
  } else if (boss.dashState?.phase === 'dashing') {
    boss.dashState.timer -= dt;
    boss.x += boss.vx * dt;
    boss.x = Math.max(arena.x + 8, Math.min(boss.x, arena.x + arena.w - boss.w - 8));
    if (boss.dashState.timer <= 0) { boss.vx = 0; boss.dashState = null; }
  } else if (boss.dashState?.phase === 'telegraph') {
    boss.dashState.timer -= dt;
  }

  runBossPattern(boss, dt, {
    fireProjectile: (x, y, vx, vy, opts) => state.projectiles.push(createProjectile(x, y, vx, vy, opts)),
    spawnMinion: (type, x, y) => {
      const e = createEnemy(type, x, y, { difficulty: boss.difficultyKey, platform: null, rng: state.rng, idFactory: nextId });
      e.patrolMin = arena.x; e.patrolMax = arena.x + arena.w - e.w;
      state.enemies.push(e);
    },
    playerBounds: typeof world.player.getBounds === 'function' ? world.player.getBounds() : world.player,
    rng: state.rng,
  });

  // Boss is damaged by player projectiles.
  const playerProjectiles = world.playerProjectiles || [];
  for (const proj of playerProjectiles) {
    if (proj.consumed) continue;
    const pb = { x: proj.x - proj.radius, y: proj.y - proj.radius, w: proj.radius * 2, h: proj.radius * 2 };
    if (overlaps(boss, pb)) {
      proj.consumed = true;
      damageBoss(boss, proj.damage, { source: 'player-projectile' });
    }
  }
}

/** True once the boss for the given world (or the active boss) has 0 HP. */
function isBossDefeated(world = state.activeBossWorld) {
  const boss = state.bosses.get(world);
  return !!boss && boss.health <= 0;
}

/** Get the boss object (for rendering the health bar or custom logic). */
function getBoss(world = state.activeBossWorld) {
  return state.bosses.get(world) || null;
}

// ---------------------------------------------------------------------------
// Projectiles & particles
// ---------------------------------------------------------------------------

function updateProjectiles(dt, world) {
  const playerBounds = typeof world.player.getBounds === 'function' ? world.player.getBounds() : world.player;
  const bounds = world.bounds || { w: Infinity, h: Infinity };

  for (const p of state.projectiles) {
    if (p.consumed) continue;
    p.vy += (p.gravity || 0) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.ttl -= dt;
    if (p.ttl <= 0 || p.x < -50 || p.x > bounds.w + 50 || p.y > bounds.h + 50) p.consumed = true;

    // Enemy projectiles hit the player (respecting power-up protection).
    if (p.owner === 'enemy' && !p.consumed) {
      const pb = { x: p.x - p.radius, y: p.y - p.radius, w: p.radius * 2, h: p.radius * 2 };
      if (overlaps(playerBounds, pb) && !(typeof world.player.isInvulnerable === 'function' && world.player.isInvulnerable())) {
        p.consumed = true;
        emitPlayerDamage(world, p.damage, { source: 'enemy-projectile' });
      }
    }
  }
  state.projectiles = state.projectiles.filter(p => !p.consumed);
}

function updateParticles(dt) {
  for (const pt of state.particles) {
    pt.vy += 500 * dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);
}

// ---------------------------------------------------------------------------
// Rendering (canvas 2d)
// ---------------------------------------------------------------------------

/** Render enemies, projectiles, particles, and the boss + its health bar. */
function renderEnemies(g, camera = { x: 0, y: 0 }) {
  if (!g) return;

  // Particles
  for (const pt of state.particles) {
    g.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    g.fillStyle = pt.color;
    g.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  g.globalAlpha = 1;

  // Projectiles
  for (const p of state.projectiles) {
    g.fillStyle = p.color;
    g.beginPath();
    g.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    g.fill();
  }

  // Enemies
  for (const e of state.enemies) {
    if (e.dead) continue;
    g.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.palette;
    g.fillRect(e.x, e.y, e.w, e.h);
    // eyes face travel direction
    g.fillStyle = '#fff';
    const ex = e.dir > 0 ? e.x + e.w - 10 : e.x + 4;
    g.fillRect(ex, e.y + 5, 3, 6);
    g.fillRect(ex + (e.dir > 0 ? 4 : -6), e.y + 5, 3, 6);
  }

  // Boss
  const boss = getBoss();
  if (boss) {
    const alpha = boss.defeated ? Math.max(0, boss.defeatTimer / DEFEAT_ANIMATION_DURATION) : 1;
    g.globalAlpha = alpha;
    g.save();
    g.translate(boss.x + boss.w / 2, boss.y + boss.h / 2);
    g.fillStyle = boss.hitFlash > 0 ? '#fff' : boss.def.color;
    g.strokeStyle = boss.def.accent;
    g.lineWidth = 4;
    const hw = boss.w / 2, hh = boss.h / 2;
    switch (boss.def.shape) {
      case 'brute':    g.fillRect(-hw, -hh, boss.w, boss.h); g.strokeRect(-hw, -hh, boss.w, boss.h); break;
      case 'crystal':  g.beginPath(); g.moveTo(0, -hh); g.lineTo(hw, 0); g.lineTo(0, hh); g.lineTo(-hw, 0); g.closePath(); g.fill(); g.stroke(); break;
      case 'serpent':  g.beginPath(); g.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break;
      case 'warden':   g.fillRect(-hw * 0.7, -hh, boss.w * 0.7, boss.h); g.beginPath(); g.arc(0, -hh, hw * 0.45, 0, Math.PI, true); g.fill(); g.stroke(); break;
      case 'sovereign':g.beginPath(); g.moveTo(0, -hh); g.lineTo(hw, hh * 0.4); g.lineTo(hw * 0.5, hh); g.lineTo(-hw * 0.5, hh); g.lineTo(-hw, hh * 0.4); g.closePath(); g.fill(); g.stroke(); break;
    }
    // eyes
    g.fillStyle = boss.def.eyeColor;
    g.fillRect(-boss.w * 0.18, -hh * 0.4, 8, 14);
    g.fillRect(boss.w * 0.08, -hh * 0.4, 8, 14);
    g.restore();

    // Health bar (top of screen, centered)
    const bw = 320, bh = 18;
    const bx = (g.canvas?.width ?? 800) / 2 - bw / 2;
    const by = 24;
    g.globalAlpha = 1;
    g.fillStyle = '#222';
    g.fillRect(bx + (camera?.x ?? 0) - 2, by + (camera?.y ?? 0) - 2, bw + 4, bh + 4);
    g.fillStyle = '#444';
    g.fillRect(bx + (camera?.x ?? 0), by + (camera?.y ?? 0), bw, bh);
    g.fillStyle = boss.def.accent;
    g.fillRect(bx + (camera?.x ?? 0), by + (camera?.y ?? 0), bw * Math.max(0, boss.health / boss.maxHealth), bh);
    g.fillStyle = '#fff';
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'center';
    g.fillText(`${boss.def.name} — World ${boss.world}`, bx + (camera?.x ?? 0) + bw / 2, by + (camera?.y ?? 0) + 13);
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/** Remove all enemies, projectiles, particles, and bosses (e.g. on level restart). */
function clearEnemies() {
  state.enemies = [];
  state.projectiles = [];
  state.particles = [];
  state.bosses.clear();
  state.activeBossWorld = null;
}

/**
 * Capture the active encounter as plain JSON data for portable saves.
 * Static boss definitions are referenced by world number and reattached on restore.
 */
function serializeEncounter() {
  const plain = value => JSON.parse(JSON.stringify(value));
  return {
    enemies: plain(state.enemies),
    projectiles: plain(state.projectiles),
    particles: plain(state.particles),
    bosses: [...state.bosses.values()].map(boss => {
      const { def, ...snapshot } = boss;
      return plain(snapshot);
    }),
    activeBossWorld: state.activeBossWorld
  };
}

/** Restore a previously validated encounter snapshot after the target level is spawned. */
function restoreEncounter(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.enemies) || !Array.isArray(snapshot.projectiles) ||
      !Array.isArray(snapshot.particles) || !Array.isArray(snapshot.bosses)) {
    throw new TypeError('Invalid encounter snapshot');
  }
  if (snapshot.enemies.length > 250 || snapshot.projectiles.length > 500 ||
      snapshot.particles.length > 1000 || snapshot.bosses.length > 1) {
    throw new RangeError('Encounter snapshot exceeds entity limits');
  }
  const finite = value => Number.isFinite(value);
  for (const enemy of snapshot.enemies) {
    if (!enemy || !['walker','flyer','shooter'].includes(enemy.type) ||
        !['x','y','vx','vy','w','h','hp','speed','dir'].every(key => finite(enemy[key]))) {
      throw new TypeError('Encounter contains an invalid enemy');
    }
  }
  for (const projectile of snapshot.projectiles) {
    if (!projectile || !['x','y','vx','vy','radius','ttl','damage'].every(key => finite(projectile[key])) ||
        !['player','enemy'].includes(projectile.owner)) throw new TypeError('Encounter contains an invalid projectile');
  }
  for (const boss of snapshot.bosses) {
    if (!boss || !Number.isInteger(boss.world) || !BOSS_DEFS[boss.world] ||
        !['x','y','vx','vy','health','maxHealth','attackTimer','defeatTimer'].every(key => finite(boss[key]))) {
      throw new TypeError('Encounter contains an invalid boss');
    }
  }
  state.enemies = JSON.parse(JSON.stringify(snapshot.enemies));
  state.projectiles = JSON.parse(JSON.stringify(snapshot.projectiles));
  state.particles = JSON.parse(JSON.stringify(snapshot.particles));
  state.bosses = new Map(snapshot.bosses.map(snapshotBoss => [
    snapshotBoss.world,
    { ...JSON.parse(JSON.stringify(snapshotBoss)), def: BOSS_DEFS[snapshotBoss.world] }
  ]));
  state.activeBossWorld = snapshot.activeBossWorld ?? null;
  const ids = [...state.enemies, ...state.projectiles].map(entity => entity.id).filter(Number.isInteger);
  state.nextId = Math.max(state.nextId, 1, ...ids.map(id => id + 1));
  return true;
}

/** Read-only enemy list used by world collision resolution. */
function getEnemiesForCollision() { return state.enemies; }

function getEnemiesForCollision() { return state.enemies; }


    Object.assign(this, { configure, spawnEnemies, updateEnemies, damageEnemy, spawnBoss, damageBoss, updateBoss, isBossDefeated, getBoss, renderEnemies, clearEnemies, serializeEncounter, restoreEncounter, getEnemiesForCollision });
  }
}
