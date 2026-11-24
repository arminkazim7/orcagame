/** Synchronous shared event bus. Listeners are invoked in registration order. */
export class EventBus {
  #listeners = new Map();
  on(type, callback) {
    if (typeof type !== 'string' || typeof callback !== 'function') throw new TypeError('Event type and callback are required');
    const list = this.#listeners.get(type) ?? new Set(); list.add(callback); this.#listeners.set(type, list);
    return () => this.off(type, callback);
  }
  once(type, callback) {
    const off = this.on(type, payload => { off(); callback(payload); }); return off;
  }
  off(type, callback) { const list = this.#listeners.get(type); if (!list) return false; const removed = list.delete(callback); if (!list.size) this.#listeners.delete(type); return removed; }
  emit(type, payload) { const list = this.#listeners.get(type); if (!list) return 0; for (const callback of [...list]) callback(payload); return list.size; }
  clear(type) { if (type === undefined) this.#listeners.clear(); else this.#listeners.delete(type); }
  listenerCount(type) { return this.#listeners.get(type)?.size ?? 0; }
}
export const events = new EventBus();
