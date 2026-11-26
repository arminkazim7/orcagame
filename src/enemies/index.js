/**
 * Per-runtime enemy and boss encounter simulation.
 * Emits dotted event names directly onto the shared application EventBus.
 */
import { getDifficulty, enemyCountFor } from './difficulty.js';
import { createEnemy, createProjectile, createParticle } from './entities.js';
import { BOSS_DEFS, createBoss, runBossPattern, DEFEAT_ANIMATION_DURATION } from './bosses.js';

export { DIFFICULTIES } from './difficulty.js';
export { BOSS_DEFS } from './bosses.js';

export class EncounterSystem {
  constructor(bus, options = {}) {
    if (!bus || typeof bus.emit !== 'function' || typeof bus.on !== 'function') {
      throw new TypeError('EncounterSystem requires the shared EventBus');
    }


Object.assign(this, { configure, spawnEnemies, updateEnemies, damageEnemy, spawnBoss, damageBoss, updateBoss, isBossDefeated, getBoss, renderEnemies, clearEnemies, serializeEncounter, restoreEncounter, getEnemiesForCollision });
}
}

