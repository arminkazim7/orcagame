/** Lives, bonus-life pickups, death recovery, and persistent death count. */
export class LifeManager {
  constructor({ player = null, powerUps = null, checkpoints = null, events = null, lives = 3, deathCount = 0, levelStart = { x: 80, y: 300 }, state = null } = {}) {
    this.player = player; this.powerUps = powerUps; this.checkpoints = checkpoints; this.events = events;
    this.startingLives = 3; this.lives = Math.max(0, Math.floor(lives)); this.deathCount = Math.max(0, Math.floor(deathCount));
    this.levelStart = { x: Number(levelStart.x), y: Number(levelStart.y) };
    if (state) this.deserialize(state);
  }
  #emit(name, data) { this.events?.emit?.(name, data); }
  getLives() { return this.lives; }
  grantLife(amount = 1, source = 'bonus') {
    const count = Math.max(0, Math.floor(Number(amount) || 0));
    if (!count) return this.lives;
    this.lives += count;
    this.#emit('life.gained', { amount: count, source, lives: this.lives });
    return this.lives;
  }
  collectBonusLife(item = {}) {
    if (item.collected) return { collected: false, lives: this.lives };
    item.collected = true;
    this.grantLife(1, 'bonus-life-pickup');
    this.#emit('bonusLife.collected', { id: item.id ?? null, lives: this.lives });
    return { collected: true, amount: 1, lives: this.lives };
  }
  loseLife(options = {}) {
    if (this.lives <= 0) return { lost: false, recovered: false, lives: 0 };
    this.lives -= 1;
    this.#emit('life.lost', { lives: this.lives, reason: options.reason ?? 'damage' });
    if (this.lives > 0) return { lost: true, recovered: false, lives: this.lives };
    return { lost: true, ...this.recoverPlayer(options) };
  }
  recoverPlayer({ levelStart = this.levelStart } = {}) {
    this.deathCount += 1;
    this.powerUps?.clearPowerUp?.('all-lives-lost');
    const respawn = this.checkpoints?.getRespawnPosition?.(levelStart) ?? { ...levelStart, checkpoint: false };
    if (this.player) {
      this.player.recover?.();
      this.player.x = respawn.x; this.player.y = respawn.y;
      this.player.vx = 0; this.player.vy = 0; this.player.grounded = false;
      this.player.setSize?.(1); this.player.setJumpStrength?.(1);
    }
    this.lives = this.startingLives;
    const result = { recovered: true, lives: this.lives, deathCount: this.deathCount, respawn };
    this.#emit('player.recovered', result);
    return result;
  }
  serialize() { return { lives: this.lives, deathCount: this.deathCount, startingLives: this.startingLives, levelStart: { ...this.levelStart } }; }
  deserialize(data = {}) { this.lives = Math.max(0, Math.floor(Number(data.lives ?? 3) || 0)); this.deathCount = Math.max(0, Math.floor(Number(data.deathCount) || 0)); if (data.levelStart) this.levelStart = { x: Number(data.levelStart.x), y: Number(data.levelStart.y) }; return this.serialize(); }
}
