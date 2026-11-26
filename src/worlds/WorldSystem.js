import { createLevel } from './levels.js';
import {
  spawnEnemies, updateEnemies, renderEnemies, spawnBoss, updateBoss,
  getBoss, clearEnemies, serializeEncounter, restoreEncounter, events as enemyEvents, _getState as _getEnemyState
} from '../enemies/index.js';

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
      enemyEvents.on('enemy:defeated', event => {
        const { type: _type, ...payload } = event ?? {};
        this.events.emit('enemy.defeated', payload);
        this.score.addScore(250);
      }),
      enemyEvents.on('enemy:stomped', event => { const { type: _type, ...payload } = event ?? {}; this.player.vy = -300; this.player.grounded = false; this.events.emit('enemy.stomped', payload); }),
      enemyEvents.on('player:damaged', event => { const { type: _type, ...payload } = event ?? {}; if (payload.applied) this.events.emit('player.damaged', payload); }),

      enemyEvents.on('boss:damaged', event => { const { type: _type, ...payload } = event ?? {}; this.events.emit('boss.damaged', { ...payload, bossId: this.level?.boss?.id ?? payload.bossId }); }),
      enemyEvents.on('boss:defeating', event => { const { type: _type, ...payload } = event ?? {}; this.events.emit('boss.defeating', { ...payload, bossId: this.level?.boss?.id ?? payload.bossId }); }),
      enemyEvents.on('boss:defeated', event => {
        const { type: _type, ...payload } = event ?? {};
        const bossId = this.level?.boss?.id ?? payload.bossId;
        this.events.emit('boss.defeated', { ...payload, bossId });
        this.#completeLevel(bossId);
      })
    ];
    this.unsubscribers.push(this.events.on('player.damaged', event => {
      const result = this.lives.loseLife({ amount: event?.amount, reason: 'enemy-hit', levelStart: this.level?.start });
      if (result.recovered) {
        this.state.gameplay.paused = true;
        this.player.setInvulnerable(1500);
        this.player.x = result.respawn.x;
        this.player.y = result.respawn.y;
        this.ui?.showRecoveryScreen?.();
      }
    }));
  }

  startLevel(number) {
    const level = createLevel(number);
    this.progression.setCurrentLevel(number);
    clearEnemies();
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
    this.player.x = level.start.x;
    this.player.y = level.start.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.grounded = false;
    this.player.alive = true;
    this.player.projectiles.clear();
    this.player.physics.gravity = level.gravity;
    this.player.setInvulnerable(900);
    this.events.emit('level.started', { level: number, world: level.world.id });
    spawnEnemies({
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
      spawnBoss({
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
    updateEnemies(dt, world);
    if (level.boss) updateBoss(dt, world);

    // Enemies are solid obstacles: stop horizontal player movement at their sides.
    // Stomped/dead enemies and upward bounce motion are intentionally not blocked.
    for (const enemy of _getEnemyState().enemies) {
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

    const boss = level.boss && this.bossEncounterStarted ? getBoss(level.boss.world) : null;
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
      encounter: serializeEncounter()
    };
  }

  restoreState(snapshot) {
    if (snapshot == null) return false;
    if (!Number.isInteger(snapshot.level) || snapshot.level < 1 || snapshot.level > 15 ||
        !Number.isFinite(snapshot.elapsed) || snapshot.elapsed < 0 ||
        !Number.isFinite(snapshot.cameraX) || snapshot.cameraX < 0 ||
        typeof snapshot.completed !== 'boolean' || !Array.isArray(snapshot.collectibles) ||
        !snapshot.encounter || typeof snapshot.encounter !== 'object') {
      throw new TypeError('Invalid saved world state');
    }
    const savedLevelStart = this.lives?.levelStart ? { ...this.lives.levelStart } : null;
    const savedCheckpoint = this.checkpoints?.serialize?.() ?? null;
    this.startLevel(snapshot.level);
    if (savedLevelStart && this.lives) this.lives.levelStart = savedLevelStart;
    if (savedCheckpoint !== null) this.checkpoints?.deserialize?.(savedCheckpoint);
    this.elapsed = snapshot.elapsed;
    this.cameraX = Math.max(0, Math.min(this.level.width - (this.canvas?.width ?? 960), snapshot.cameraX));
    this.state.gameplay.cameraX = this.cameraX;
    this.state.gameplay.elapsedSeconds = snapshot.elapsed;
    this.completed = snapshot.completed;
    const collected = new Map(snapshot.collectibles.map(item => [item.id, item.collected]));
    for (const item of this.level.collectibles) {
      if (collected.has(item.id)) item.collected = collected.get(item.id) === true;
    }
    restoreEncounter(snapshot.encounter);
    this.bossEncounterStarted = Boolean(this.level.boss && snapshot.encounter.bosses.some(boss => boss.world === this.level.boss.world));
    if (snapshot.encounter.bosses.length && !this.bossEncounterStarted) {
      throw new TypeError('Saved boss encounter does not match the active level');
    }
    if (this.bossEncounterStarted) {
      this.events.emit('boss.started', { bossId: this.level.boss.id, world: this.level.boss.world, restored: true });
    }
    return true;
  }

  render(ctx) {
    if (!this.level) {
      ctx.fillStyle = '#063b58';
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      this.player.render(ctx, 0);
      return;
    }
    const level = this.level;
    const [top, bottom] = level.background;
    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Underwater light shafts and bubbles provide depth without obscuring play.
    for (let i = 0; i < 12; i++) {
      const x = ((i * 173 - this.cameraX * 0.18 - this.cameraY * 0.08) % (ctx.canvas.width + 100) + ctx.canvas.width + 100) % (ctx.canvas.width + 100);
      ctx.fillStyle = 'rgba(210,245,255,0.045)';
      ctx.fillRect(x, 0, 22, ctx.canvas.height);
      ctx.strokeStyle = 'rgba(210,245,255,0.22)';
      ctx.beginPath();
      ctx.arc(x + 38, 75 + (i * 31) % 330, 3 + i % 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);
    for (const platform of level.platforms) {
      if (platform.id === 'seafloor') {
        ctx.fillStyle = '#143d48';
        ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
        ctx.fillStyle = '#4eb7a1';
        ctx.fillRect(platform.x, platform.y, platform.w, 8);
      } else {
        ctx.fillStyle = '#236f70';
        ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
        ctx.fillStyle = '#70d8c2';
        ctx.fillRect(platform.x, platform.y, platform.w, 5);
      }
    }
    ctx.fillStyle = '#e9d58a';
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.fillStyle = '#174f61';
    ctx.fillRect(level.exit.x + 10, level.exit.y + 10, level.exit.w - 20, level.exit.h - 10);
    for (const item of level.collectibles) {
      if (item.collected) continue;
      const cx=item.x+15, cy=item.y+15; ctx.save(); ctx.translate(cx,cy);
      if(item.type==='badge'){const palette=['#ff8a5b','#64d9c2','#a18bff','#ffdb68','#6cc8ff'];ctx.fillStyle=palette[(item.badgeId-1)%palette.length];ctx.strokeStyle='#fff5c6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(11,-7);ctx.lineTo(9,8);ctx.lineTo(0,13);ctx.lineTo(-9,8);ctx.lineTo(-11,-7);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#07344b';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(item.badgeId),0,0);}
      else if(item.type==='powerup'&&item.powerUp==='sea-berry'){ctx.fillStyle='#f04e86';ctx.strokeStyle='#ffd4e3';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(0,2,10,12,-.25,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#65d77c';ctx.beginPath();ctx.ellipse(2,-11,5,3,-.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-3,-1,2,0,Math.PI*2);ctx.fill();}
      else if(item.type==='powerup'&&item.powerUp==='golden-krill'){ctx.fillStyle='#ffc83d';ctx.strokeStyle='#fff0a8';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-5,-7);ctx.lineTo(0,-4);ctx.lineTo(5,-7);ctx.lineTo(10,0);ctx.lineTo(5,7);ctx.lineTo(0,4);ctx.lineTo(-5,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.fillRect(-3,-2,2,2);ctx.fillRect(3,-2,2,2);}
      else if(item.type==='powerup'&&item.powerUp==='bubble-shell'){ctx.fillStyle='#55dcff';ctx.strokeStyle='#e2fbff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle='#087baf';ctx.lineWidth=2;for(let k=-2;k<=2;k++){ctx.beginPath();ctx.arc(k*4,0,7,.15*Math.PI,.85*Math.PI);ctx.stroke();}ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-4,-5,3,0,Math.PI*2);ctx.fill();}
      else if(item.type==='life'){ctx.fillStyle='#ffe36b';ctx.strokeStyle='#fff5bc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(11,0);ctx.lineTo(0,12);ctx.lineTo(-11,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#fff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('+',0,0);}
      else{ctx.fillStyle='#fff';ctx.strokeStyle='#75f4d2';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#087baf';ctx.fillRect(-3,-7,6,14);}ctx.restore();
    }
    this.player.render(ctx);
    renderEnemies(ctx, { x: this.cameraX, y: this.cameraY });
    ctx.restore();
  }

  stop() {
    this.state.status = 'menu';
    this.state.gameplay.paused = true;
    this.level = null;
    clearEnemies();
  }

  dispose() {
    for (const unsubscribe of this.unsubscribers) unsubscribe?.();
    clearEnemies();
  }
}
