/** Owns the policy for turning combat damage into life loss and recovery. */
export class CombatResolver {
  constructor({ events, lives, state, player, getUi = () => null, getLevel }) {
    this.lives = lives;
    this.state = state;
    this.player = player;
    // Resolve the UI lazily: the composition root assigns it after the world is built.
    this.getUi = getUi;
    this.getLevel = getLevel;
    this.unsubscribe = events.on('player.damaged', event => this.resolveDamage(event));
  }

  resolveDamage(event = {}) {
    const level = this.getLevel();
    const result = this.lives.loseLife({ amount: event.amount, reason: 'enemy-hit', levelStart: level?.start });
    if (!result.recovered) return result;
    this.state.gameplay.paused = true;
    this.player.setInvulnerable(1500); // WorldSystem's recovery listener positions the player on solid ground.
    this.getUi()?.showRecoveryScreen?.();
    return result;
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
