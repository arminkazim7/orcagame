import { createLevel } from './levels.js';
import { LevelRenderer } from './LevelRenderer.js';
import { CombatResolver } from './CombatResolver.js';
import { EncounterSystem } from '../enemies/index.js';

const intersects = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x &&
  a.y < b.y + b.h && a.y + a.h > b.y;

/** Owns the active level lifecycle and composes player, enemies, bosses and progression. */
export class WorldSystem {
  constructor({ canvas, player, state, events, progression, score, lives, powerUps, checkpoints, profile = null, ui }) {
    this.canvas = canvas;
    this.player = player;
    this.state = state;
    this.events = events;
    this.progression = progression;
    this.score = score;
    this.lives = lives;
    this.powerUps = powerUps;
    this.checkpoints = checkpoints;
    this.profile = profile;
    this.ui = ui;
    this.level = null;
    this.cameraX = 0;
    this.cameraY = 0;
    this.completed = false;
    this.bossEncounterStarted = false;
    this.elapsed = 0;
    this.hudElapsed = 0;
    this.encounters = new EncounterSystem(events);
    this.renderer = new LevelRenderer();
    this.combat = new CombatResolver({ events, lives, state, player, ui, getLevel: () => this.level });
    this.playerCombatant = {
      getBounds: () => ({ x: player.x, y: player.y, w: player.width, h: player.height }),
      get x() { return player.x; },
      get y() { return player.y; },
      get vx() { return player.vx; },
      get vy() { return player.vy; },
      isInvulnerable: () => player.isInvulnerable,
      onDamaged: (amount, source) => player.takeDamage({ emitEvent: false, source })
    };
    this.unsubscribers = [
      events.on('enemy.defeated', () => this.score.addScore(250)),
      events.on('enemy.stomped', () => { this.player.vy = -300; this.player.grounded = false; }),
      events.on('boss.defeated', event => this.#completeLevel(this.level?.boss?.id ?? event?.bossId))
    ];

  }

  startLevel(number) {
    const level = createLevel(number);
    this.progression.setCurrentLevel(number);
    this.encounters.clearEnemies();
    this.level = level;
    this.completed = false;
    this.elapsed = 0;
    this.cameraX = 0;
    this.cameraY = 0;
    this.state.status = 'playing';
    this.state.gameplay.paused = false;
    this.state.gameplay.elapsedSeconds = 0;
    this.state.gameplay.cameraX = 0;
    this.checkpoints.clear();
    this.lives.levelStart = { ...level.start };
    this.player.sizeScale = 1;
    this.player.jumpScale = 1;
    this.player.activePowerUp = null;
    this.player.protectionHits = 0;
    this.player.physics.resetTransientState?.();
    this.player.x = level.start.x;
    this.player.y = level.start.y - (this.player.height - 43);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.grounded = false;
    this.player.alive = true;
    this.player.projectiles.clear();
    this.player.physics.gravity = level.gravity;
    this.player.physics.resetTransientState?.();
    this.player.setInvulnerable(900);
    this.events.emit('level.started', { level: number, world: level.world.id });
    this.encounters.spawnEnemies({
      level: number,
      difficulty: this.progression.difficulty,
      platforms: level.platforms.filter(platform => platform.oneWay)
    });
    this.ui?.showGameplay?.({ level: number, world: level.world.name });
    this.ui?.updateHUD?.({ level: number, world: level.world.name, difficulty: this.progression.difficulty });
    return level;
  }

  update(dt, state, events, input) {
    if (!this.level || this.completed || state.gameplay.paused) return;
    this.elapsed += dt;
    const level = this.level;
    this.player.update(dt, input, level.platforms, {
      projectileBounds: { left: 0, right: level.width }
    });
    this.player.x = Math.max(0, Math.min(level.width - this.player.width, this.player.x));
    this.cameraX = Math.max(0, Math.min(level.width - (this.canvas?.width ?? 960),
      this.player.x - (this.canvas?.width ?? 960) * 0.36));
    state.gameplay.cameraX = this.cameraX;
    this.cameraY = Math.max(0, Math.min(level.height - (this.canvas?.height ?? 540), this.player.y - (this.canvas?.height ?? 540) * 0.38));

    // The boss encounter begins only when the player reaches the arena boundary.
    // Until then the boss does not exist and cannot patrol or attack from off-screen.
    if (level.boss && !this.bossEncounterStarted &&
        this.player.x + this.player.width >= level.boss.arena.x) {
      this.encounters.spawnBoss({
        world: level.boss.world,
        difficulty: this.progression.difficulty,
        arena: level.boss.arena
      });
      this.bossEncounterStarted = true;
      this.events.emit('boss.started', { bossId: level.boss.id, world: level.boss.world });
    }

    const world = {
      player: this.playerCombatant,
      platforms: level.platforms,
      playerProjectiles: this.player.projectiles.items,
      gravity: level.gravity,
      bounds: { w: level.width, h: level.height }
    };
    this.encounters.updateEnemies(dt, world);
    if (level.boss) this.encounters.updateBoss(dt, world);

    // Enemies are solid obstacles: stop horizontal player movement at their sides.
    // Stomped/dead enemies and upward bounce motion are intentionally not blocked.
    for (const enemy of this.encounters.getEnemiesForCollision()) {
      if (enemy.dead || !intersects(this.playerCombatant.getBounds(), { x: enemy.x, y: enemy.y, w: enemy.w, h: enemy.h })) continue;
      if (this.player.vy < 0) continue;
      const playerRight = this.player.x + this.player.width;
      const enemyRight = enemy.x + enemy.w;
      const centerPlayer = this.player.x + this.player.width / 2;
      const centerEnemy = enemy.x + enemy.w / 2;
      if (this.player.vx >= 0 && centerPlayer <= centerEnemy) this.player.x = enemy.x - this.player.width;
      else if (this.player.vx <= 0 && centerPlayer >= centerEnemy) this.player.x = enemyRight;
      else if (playerRight > enemy.x && this.player.x < enemyRight) this.player.x = centerPlayer < centerEnemy ? enemy.x - this.player.width : enemyRight;
      this.player.vx = 0;
    }


    for (const item of level.collectibles) {
      if (item.collected) continue;
      const bounds = { x: item.x, y: item.y, w: 30, h: 30 };
      if (!intersects(this.playerCombatant.getBounds(), bounds)) continue;
      item.collected = true;
      if (item.type === 'badge') {
        const badges = this.profile?.badges ?? [];
        if (!badges.includes(item.badgeId)) { badges.push(item.badgeId); this.events.emit('badge.collected', { level: level.number, badgeId: item.badgeId }); }
      } else if (item.type === 'powerup') this.powerUps.collectPowerUp(item.powerUp);
      else if (item.type === 'life') this.lives.collectBonusLife(item);
      else if (item.type === 'checkpoint') this.checkpoints.activateCheckpoint({ id: item.id, x: item.x, y: item.y - this.player.height, level: level.number });
    }

    const boss = level.boss && this.bossEncounterStarted ? this.encounters.getBoss(level.boss.world) : null;
    const exit = level.exit;
    const atExit = intersects(this.playerCombatant.getBounds(), exit);
    if (atExit && (!level.boss || boss?.defeatEventSent)) this.#completeLevel(level.boss?.id ?? null);

    this.hudElapsed += dt;
    if (this.hudElapsed >= 0.25) {
      this.hudElapsed = 0;
      this.ui?.updateHUD?.({
        level: level.number, world: level.world.name,
        difficulty: this.progression.difficulty,
        bossHealth: boss && !boss.defeated ? boss.health / boss.maxHealth * 100 : null
      });
    }
  }

  #completeLevel(bossId = null) {
    if (this.completed || !this.level) return false;
    this.completed = true;
    const result = this.progression.completeLevel({
      level: this.level.number,
      difficulty: this.progression.difficulty,
      score: this.score.getScore(),
      time: this.elapsed,
      bossId
    });
    this.state.status = 'victory';
    if (result.newlyUnlocked.length) this.progression.setCurrentLevel(result.newlyUnlocked[0]);
    this.events.emit('level.completed', result);
    if (this.level.number === 15) this.ui?.showFinalEnding?.({ playerName: this.player.name });
    else if (bossId) this.ui?.showBossVictory?.({ level: this.level.number, bossId, playerName: this.player.name });
    else this.ui?.showVictory?.({ level: this.level.number, playerName: this.player.name });
    return result;
  }

  serializeState() {
    if (!this.level) return null;
    return {
      level: this.level.number,
      elapsed: this.elapsed,
      cameraX: this.cameraX,
      completed: this.completed,
      collectibles: this.level.collectibles.map(item => ({ id: item.id, collected: Boolean(item.collected) })),
      encounter: this.encounters.serializeEncounter()
    };
  }

  validateSnapshot(snapshot) {
    if (snapshot == null) return true;
    if (!snapshot || !Number.isInteger(snapshot.level) || snapshot.level < 1 || snapshot.level > 15 ||
        !Number.isFinite(snapshot.elapsed) || snapshot.elapsed < 0 ||
        !Number.isFinite(snapshot.cameraX) || snapshot.cameraX < 0 ||
        typeof snapshot.completed !== 'boolean' || !Array.isArray(snapshot.collectibles) ||
        !snapshot.encounter || typeof snapshot.encounter !== 'object') {
      throw new TypeError('Invalid saved world state');
    }
    const expected = createLevel(snapshot.level);
    const expectedItems = new Map(expected.collectibles.map(item => [item.id, item]));
    if (snapshot.collectibles.length !== expected.collectibles.length ||
        snapshot.collectibles.some(item => !item || !expectedItems.has(item.id) || typeof item.collected !== 'boolean') ||
        new Set(snapshot.collectibles.map(item => item.id)).size !== snapshot.collectibles.length) {
      throw new TypeError('Saved collectibles do not match the active level');
    }
    this.encounters.validateEncounterSnapshot(snapshot.encounter);
    const bosses = snapshot.encounter.bosses;
    if (bosses.length > 1 || bosses.some(boss => !expected.boss || boss.world !== expected.boss.world) ||
        (bosses.length > 0 && snapshot.encounter.activeBossWorld !== bosses[0].world) ||
        (snapshot.encounter.activeBossWorld != null && snapshot.encounter.activeBossWorld !== expected.boss?.world)) {
      throw new TypeError('Saved boss encounter does not match the active level');
    }
    return true;
  }

  restore(snapshot) {
    if (snapshot == null) {
      this.level = null;
      this.encounters.clearEnemies();
      this.completed = false;
      this.bossEncounterStarted = false;
      this.elapsed = 0;
      this.cameraX = 0;
      this.cameraY = 0;
      this.state.status = 'menu';
      this.state.gameplay.elapsedSeconds = 0;
      this.state.gameplay.cameraX = 0;
      return true;
    }
    this.validateSnapshot(snapshot);
    const level = createLevel(snapshot.level);
    const collected = new Map(snapshot.collectibles.map(item => [item.id, item.collected]));
    for (const item of level.collectibles) item.collected = collected.get(item.id);
    this.level = level;
    this.elapsed = snapshot.elapsed;
    this.cameraX = Math.max(0, Math.min(level.width - (this.canvas?.width ?? 960), snapshot.cameraX));
    this.cameraY = 0;
    this.completed = snapshot.completed;
    this.bossEncounterStarted = Boolean(level.boss && snapshot.encounter.bosses.some(boss => boss.world === level.boss.world));
    this.hudElapsed = 0;
    this.state.status = this.completed ? 'victory' : 'playing';
    this.state.gameplay.elapsedSeconds = this.elapsed;
    this.state.gameplay.cameraX = this.cameraX;
    this.state.gameplay.paused = false;
    this.player.physics.gravity = level.gravity;
    this.player.physics.resetTransientState?.();
    this.player.alive = true;
    this.player.invulnerabilityMs = 0;
    this.player.shootWasDown = false;
    this.player.projectiles?.clear?.();
    this.encounters.restoreEncounter(snapshot.encounter);
    return true;
  }

  restoreState(snapshot) { return this.restore(snapshot); }

  render(ctx) {
    this.renderer.render(this, ctx);
  }

  stop() {
    this.state.status = 'menu';
    this.state.gameplay.paused = true;
    this.level = null;
    this.encounters.clearEnemies();
  }

  dispose() {
    for (const unsubscribe of this.unsubscribers) unsubscribe?.();
    this.combat.dispose();
    this.encounters.clearEnemies();
  }
}
