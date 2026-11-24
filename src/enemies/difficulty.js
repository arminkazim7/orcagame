/** Difficulty presets. Hard boss health MUST be exactly twice Easy. */
export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    enemyCountMultiplier: 1.0,
    bossHealthMultiplier: 1,       // exact — enforced by bossHealthFor below
    enemySpeed: 55,
    flyerSpeed: 45,
    projectileSpeed: 230,
    fireRateScale: 1.0,
    contactDamage: 1,
  },
  hard: {
    key: 'hard',
    enemyCountMultiplier: 1.5,     // Hard always spawns MORE enemies than Easy
    bossHealthMultiplier: 2,       // exactly twice Easy boss health (spec requirement)
    enemySpeed: 80,
    flyerSpeed: 65,
    projectileSpeed: 300,
    fireRateScale: 0.7,            // faster attacks (lower cooldown)
    contactDamage: 2,
  },
};

export function getDifficulty(key) {
  const d = DIFFICULTIES[key];
  if (!d) throw new Error(`Unknown difficulty "${key}". Use "easy" or "hard".`);
  return d;
}

/**
 * Base enemy count grows with level. Returns count for a difficulty;
 * hard is guaranteed strictly greater than easy.
 */
export function enemyCountFor(level, difficultyKey) {
  const d = getDifficulty(difficultyKey);
  const base = 4 + Math.floor(level / 3);
  const count = Math.round(base * d.enemyCountMultiplier);
  return difficultyKey === 'hard' ? Math.max(count, base + 1) : count;
}

/** Guards the spec rule: hard boss HP === easy boss HP * 2 exactly. */
export function bossHealthFor(baseEasyHealth, difficultyKey) {
  const d = getDifficulty(difficultyKey);
  return d.key === 'hard' ? baseEasyHealth * 2 : baseEasyHealth;
}


