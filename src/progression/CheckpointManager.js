/** Stores world-space respawn anchors; checkpoint coordinates are never camera-relative. */
export class CheckpointManager {
  constructor({ events = null, state = null } = {}) { this.events = events; this.checkpoint = null; if (state) this.deserialize(state); }
  #emit(name, data) { this.events?.emit?.(name, data); }
  activateCheckpoint(checkpoint) {
    if (!checkpoint || !Number.isFinite(Number(checkpoint.x)) || !Number.isFinite(Number(checkpoint.y))) throw new TypeError('Checkpoint requires finite world-space x and y');
    this.checkpoint = { id: checkpoint.id ?? `checkpoint-${Number(checkpoint.x)}-${Number(checkpoint.y)}`, x: Number(checkpoint.x), y: Number(checkpoint.y), level: checkpoint.level ?? null };
    this.#emit('checkpoint.activated', { ...this.checkpoint });
    return this.getRespawnPosition({ x: 0, y: 0 });
  }
  getRespawnPosition(levelStart = { x: 0, y: 0 }) {
    const point = this.checkpoint ?? levelStart;
    return { x: Number(point.x), y: Number(point.y), checkpoint: Boolean(this.checkpoint), id: this.checkpoint?.id ?? null };
  }
  clear() { this.checkpoint = null; }
  serialize() { return this.checkpoint ? { ...this.checkpoint } : null; }
  deserialize(data) { this.checkpoint = data && Number.isFinite(Number(data.x)) && Number.isFinite(Number(data.y)) ? { id: data.id ?? null, x: Number(data.x), y: Number(data.y), level: data.level ?? null } : null; return this.serialize(); }
}
