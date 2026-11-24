const DEFINITIONS = Object.freeze({
  'sea-berry': Object.freeze({ id: 'sea-berry', name: 'Sea Berry', size: 1.4, jump: 1, protectionHits: 1 }),
  'golden-krill': Object.freeze({ id: 'golden-krill', name: 'Golden Krill', size: 1.8, jump: 1.35, protectionHits: 1 }),
  'bubble-shell': Object.freeze({ id: 'bubble-shell', name: 'Bubble Shell', size: 1, jump: 1, protectionHits: 1 })
});
const ALIASES = Object.freeze({ berry: 'sea-berry', 'sea berry': 'sea-berry', krill: 'golden-krill', 'golden krill': 'golden-krill', bubble: 'bubble-shell', 'bubble shell': 'bubble-shell' });

/** Owns the single persistent, serializable power-up slot. No duration/timer exists. */
export class PowerUpManager {
  constructor({ player = null, events = null, state = null } = {}) {
    this.player = player;
    this.events = events;
    this.active = null;
    this.protectionHits = 0;
    if (state) this.deserialize(state);
    // Agent 2's Orca emits this when its own takeDamage() consumes the shield.
    this._protectionListener = (event) => {
      if (this.active && this.protectionHits > 0 && (!event?.powerUp || event.powerUp === DEFINITIONS[this.active].name)) {
        this.protectionHits = 0; this.active = null;
        this.#emit('powerup.consumed', { id: event?.powerUp ?? null, name: event?.powerUp ?? null });
      }
    };
    this.events?.on?.('player.protectionConsumed', this._protectionListener);
  }
  #emit(name, data) { this.events?.emit?.(name, data); }
  #id(type) { const key = String(type ?? '').trim().toLowerCase(); return DEFINITIONS[key] ? key : ALIASES[key]; }
  collectPowerUp(type) {
    const id = this.#id(type);
    if (!id) throw new RangeError(`Unknown power-up: ${type}`);
    const previous = this.active;
    this.active = id;
    this.protectionHits = 1;
    this.applyPowerUp();
    const result = this.getActivePowerUp();
    this.#emit('powerup.collected', { ...result, replaced: previous });
    return result;
  }
  applyPowerUp() {
    if (!this.active) { this.player?.clearPowerUp?.(); return null; }
    const effect = DEFINITIONS[this.active];
    if (this.player?.applyPowerUp) this.player.applyPowerUp(this.active);
    else if (this.player) {
      this.player.setSize?.(effect.size);
      this.player.setJumpStrength?.(effect.jump);
      this.player.activePowerUp = effect.name;
      this.player.protectionHits = this.protectionHits;
    }
    this.#emit('powerup.applied', { ...effect, protectionHits: this.protectionHits });
    return this.getActivePowerUp();
  }
  consumeProtection() {
    if (!this.active || this.protectionHits <= 0) return false;
    const consumed = this.active;
    this.protectionHits = 0;
    this.active = null;
    this.player?.clearPowerUp?.();
    this.#emit('powerup.consumed', { id: consumed, name: DEFINITIONS[consumed].name });
    return true;
  }
  clearPowerUp(reason = 'cleared') {
    const previous = this.active;
    this.active = null; this.protectionHits = 0;
    this.player?.clearPowerUp?.();
    if (previous) this.#emit('powerup.cleared', { id: previous, reason });
    return previous !== null;
  }
  getActivePowerUp() {
    if (!this.active) return null;
    return { ...DEFINITIONS[this.active], protectionHits: this.protectionHits };
  }
  serialize() { return { active: this.active, protectionHits: this.protectionHits }; }
  deserialize(data = {}) {
    const id = this.#id(data.active ?? data.id);
    if (!id) { this.active = null; this.protectionHits = 0; this.player?.clearPowerUp?.(); return null; }
    this.active = id;
    this.protectionHits = Math.max(0, Math.min(1, Number(data.protectionHits ?? 1) || 0));
    if (this.protectionHits === 0) this.active = null;
    this.applyPowerUp();
    return this.getActivePowerUp();
  }
}
export { DEFINITIONS as POWER_UPS };
