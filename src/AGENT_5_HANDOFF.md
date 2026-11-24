# Agent 5 Handoff — Power-ups, Score, Lives, and Progression

**Owned:** `src/progression/`

## Delivered

- `PowerUpManager.js`: Sea Berry, Golden Krill and Bubble Shell; one active slot; replacement; one-hit protection; save/load; no timers; persists across levels.
- `LifeManager.js`: three starting lives, distinct one-life Bonus Life pickups, death count, all-lives-lost recovery, checkpoint/level-start respawn.
- `ScoreManager.js`: one extra life per 10,000-point milestone, one award per threshold, HUD progress API.
- `CheckpointManager.js`: world-coordinate checkpoint activation and serializable respawn anchor.
- `ProgressionManager.js`: next-level unlock, Easy/Hard records, permanent per-level Gold for Hard completions, configurable boss unlocks, boss defeat tracking, Orcalord unlock, unlock-all API.
- `docs/PROGRESSION_API.md`, 24 automated tests, and isolated browser test scene.

## Agent 2 integration

Pass the Agent 2 `Orca` instance to `PowerUpManager` and `LifeManager`. Use the same event bus for Orca and PowerUpManager. Collection calls `powerUps.collectPowerUp(item.type)`; do not separately call `orca.applyPowerUp` because the manager does it. The manager also observes `player.protectionConsumed` emitted by `Orca.takeDamage()` and clears its saved slot. When `lives.loseLife()` returns `recovered: true`, recovery is already applied to the player; do not call `orca.recover()` a second time.

## World/level integration

- On collectible overlap, call `lives.collectBonusLife(item)` for a Bonus Life; call `score.addScore(points)` for score pickups. They are distinct operations.
- On checkpoint overlap, call `checkpoints.activateCheckpoint({ id, x, y, level })` with world-space coordinates.
- Do not clear `PowerUpManager` on a level transition.
- On level completion, call `progression.completeLevel(...)` and only then allow a difficulty change.
- Configure boss unlock milestones through `bossUnlocks` when constructing `ProgressionManager`.

## Verification

`npm test` — 24 passed, 0 failed.

## Contract notes

The initial shared interface file in the supplied architecture pack is explicitly a proposal. This module uses the proposed event names and state concepts without mutating a global game-state object. The lead integrator should map serialized manager slices into the final save schema.
