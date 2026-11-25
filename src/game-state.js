import { GAME_CONFIG } from './game-config.js';
/** One authoritative mutable runtime state. Managers own their domain slices; this is the shared app snapshot. */
export function createGameState(overrides = {}) {
  return {
    version: GAME_CONFIG.stateVersion, status: 'menu',
    player: { name: 'Orca', color: 'classic', characterType: 'orca', x: 80, y: 300, width: 66, height: 43, vx: 0, vy: 0, lives: 3, score: 0, deathCount: 0, activePowerUp: null },
    progression: { currentLevel: 1, difficulty: 'easy', unlockedLevels: [1], completedLevels: {}, records: { easy: {}, hard: {} }, goldLevels: [], unlockedBosses: [], defeatedBosses: [], orcalordUnlocked: false, cheatUnlocked: false },
    checkpoint: null, bonusLife: { nextThreshold: 10000, awardedThresholds: [] },
    settings: { musicEnabled: true, soundEnabled: true },
    gameplay: { elapsedSeconds: 0, cameraX: 0, paused: false },
    ...overrides
  };
}
