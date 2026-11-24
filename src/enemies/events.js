/**
 * Minimal event bus used to notify progression (damage, defeats).
 * Agent 4 does NOT own lives/power-ups — it only emits events.
 */
export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  /** Subscribe. Returns an unsubscribe function. */
  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this._listeners.get(type)?.delete(fn);
  }

  emit(type, payload = {}) {
    const set = this._listeners.get(type);
    if (!set) return;
    for (const fn of set) fn({ type, ...payload });
  }

  clear() {
    this._listeners.clear();
  }
}

