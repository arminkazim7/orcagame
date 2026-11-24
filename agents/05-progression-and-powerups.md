# Agent 5 — Power-ups, Score, Lives, and Progression
**Owns:** `src/progression/`

Implement Sea Berry (large orca, one-hit protection), Golden Krill (giant orca, higher jump, one-hit protection), and Bubble Shell (one-hit protection). Only one power-up may be active; a new one replaces the old one. No timers. Power-ups persist between levels, are removed after all lives are lost, and must be serializable.

Create a distinct Bonus Life collectible that immediately grants exactly one life, works in both difficulties, and is separate from score bonuses.

Grant one score-based extra life at every 10,000-point threshold (10k, 20k, 30k, etc.); each threshold awards once. Track progress to the next threshold.

Start with three lives. On zero lives: increment persistent death count, clear power-up, restore normal size and three lives, respawn at checkpoint or level start, preserve score and progression, and allow continuation.

Implement checkpoints and progression: completed/unlocked levels, Easy/Hard records, permanent Gold for Hard completion, orcalord unlock, boss unlocks, completion events.

Expose documented APIs equivalent to `collectPowerUp`, `applyPowerUp`, `consumeProtection`, `getActivePowerUp`, `collectBonusLife`, `addScore`, `getLives`, `loseLife`, `recoverPlayer`, `activateCheckpoint`, `getRespawnPosition`, `completeLevel`, `unlockAllLevels`, and `getProgressionState`.

Deliver source, docs, and tests for every item, milestone, checkpoint, difficulty achievement, and recovery path.
