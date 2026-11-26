/** Owns the policy for turning combat damage into life loss and recovery. */
export class CombatResolver {
  constructor({ events, lives, state, player, ui, getLevel }) {
    this.lives = lives;
    this.state = state;
    this.player = player;
    this.ui = ui;
    this.getLevel = getLevel;
    this.unsubscribe = events.on('player.damaged', event => this.resolveDamage(event));
  }

  resolveDamage(event = {}) {
    const level = this.getLevel();
    const result = this.lives.loseLife({ amount: event.amount, reason: 'enemy-hit', levelStart: level?.start });
    if (!result.recovered) return result;
    this.state.gameplay.paused = true;
    this.player.setInvulnerable(1500); // WorldSystem's recovery listener positions the player on solid ground.
    this.ui?.showRecoveryScreen?.();
    return result;
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
