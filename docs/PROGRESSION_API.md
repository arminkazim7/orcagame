# Agent 5 — Progression API

All managers are ES modules under `src/progression/`. They own only their domain state; the score manager talks to the life manager through `grantLife`, while the life manager talks to the power-up, checkpoint and player adapters. No manager creates a game loop or uses timers.

## Initialization

```js
import {
  PowerUpManager, LifeManager, ScoreManager,
  CheckpointManager, ProgressionManager
} from './src/progression/index.js';

const checkpoints = new CheckpointManager({ events });
const powerUps = new PowerUpManager({ player: orca, events });
const lives = new LifeManager({ player: orca, powerUps, checkpoints, events,
  levelStart: { x: 80, y: 300 } });
const score = new ScoreManager({ lives, events });
const progression = new ProgressionManager({ events, totalLevels: 25,
  bossUnlocks: { 5: ['kelp-guardian'], 10: ['ice-leviathan'] } });
```

Pass the Agent 2 `Orca` instance as `player`. Its `applyPowerUp`, `clearPowerUp`, `recover`, `setSize`, and `setJumpStrength` methods are used directly. `PowerUpManager` listens for `player.protectionConsumed` on the supplied event bus so Agent 2's native damage path also consumes the progression-owned shield slot. Ensure the same event bus instance is passed to the player and manager.

## Power-ups

- `collectPowerUp(type)` — accepts `sea-berry`, `golden-krill`, `bubble-shell` plus short/space aliases. Replaces any active item and applies the player effect immediately.
- `applyPowerUp()` — reapplies the saved active item to the player after load/reinitialization.
- `consumeProtection()` — consumes the one hit, clears the active slot and resets player size/jump to normal. Returns `false` if no protection is available.
- `getActivePowerUp()` — returns a serializable definition or `null`.
- `clearPowerUp(reason)` — explicit clear, used for all-lives-lost recovery.
- `serialize()` / `deserialize(state)` — preserve the single active item and remaining protection. There is no timer or level-transition expiration.

Effects: Sea Berry size 1.4/jump 1; Golden Krill size 1.8/jump 1.35; Bubble Shell size 1/jump 1. Each grants exactly one protected hit.

## Lives and Bonus Life

- `getLives()` — current count; new game starts at 3.
- `grantLife(amount, source)` — internal/general life grant; Bonus Life uses exactly one.
- `collectBonusLife(item)` — marks a collectible object as collected and grants one life. A second call with that same object returns `{ collected: false }`. This is separate from score milestones and does not inspect difficulty.
- `loseLife(options)` — subtracts one life. Above zero, no recovery occurs. At zero, calls `recoverPlayer`.
- `recoverPlayer({ levelStart })` — increments persistent death count, clears power-up, restores player normal size/jump, moves to checkpoint or level start, clears velocity/projectiles through `player.recover()`, restores three lives and emits `player.recovered`. Score and progression are independent and remain unchanged.
- `serialize()` / `deserialize(state)` — stores lives, death count and level-start coordinates.

## Score

- `addScore(points)` — adds a finite non-negative score amount. Every crossed 10,000-point boundary grants exactly one life, including when a single award crosses multiple boundaries. Awarded thresholds are recorded to prevent duplicate grants after loading.
- `getScore()` — total score.
- `getMilestoneProgress()` — `{ score, nextThreshold, remaining, progress, threshold }` for the HUD.
- `serialize()` / `deserialize(state)` — stores score, next threshold and already-awarded thresholds.

## Checkpoints

- `activateCheckpoint({ id, x, y, level })` — records a world-space respawn position and emits `checkpoint.activated`.
- `getRespawnPosition(levelStart)` — returns the checkpoint if one exists, otherwise the supplied level start.
- `serialize()` / `deserialize(state)` — stores the active checkpoint. Camera offsets must not be included.

## Progression

- `completeLevel({ level, difficulty, score, time, bossId })` — records Easy or Hard completion, increments per-mode completion count, tracks best score/time, unlocks the next level, awards permanent Gold for Hard completion, applies configured boss unlocks and emits `level.completed`.
- `setDifficulty(value, { reason })` — accepts `easy` or `hard`; reason must be `level-complete` or `all-lives-lost` (or `initialization` during setup). Difficulty cannot be changed mid-level.
- `setCurrentLevel(level)` — moves only to an unlocked level.
- `unlockAllLevels()` — unlocks all configured levels and returns the newly unlocked level numbers.
- `unlockBoss(bossId)` / `defeatBoss(bossId)` — explicit boss unlock and defeat tracking.
- `getProgressionState()` — serializable full state: unlocked/completed levels, separate Easy/Hard records, permanent Gold, boss unlocks/defeats and Orcalord unlock.
- `serialize()` / `deserialize(state)` — save/load all progression data.

Boss unlock milestones are configuration, not hard-coded assumptions: supply `{ levelNumber: bossId | [bossIds] }` as `bossUnlocks`. Orcalord unlocks permanently after Hard completion of every configured level by default. Set `orcalordRequiresAllHard: false` to use final-level Hard completion as the gate instead.

## Event contract

Emitted events include `powerup.collected`, `powerup.applied`, `powerup.consumed`, `powerup.cleared`, `bonusLife.collected`, `life.gained`, `life.lost`, `life.scoreMilestone`, `score.changed`, `checkpoint.activated`, `player.recovered`, `difficulty.changed`, `level.goldEarned`, `boss.unlocked`, `boss.defeated`, `orcalord.unlocked`, `levels.unlockedAll`, and `level.completed`.

## Save integration

```js
const save = {
  powerUps: powerUps.serialize(),
  lives: lives.serialize(),
  score: score.serialize(),
  checkpoint: checkpoints.serialize(),
  progression: progression.serialize()
};
// JSON.stringify(save) is safe; restore the player before calling powerUps.deserialize.
```

For load order, construct the player and event bus first, then checkpoint/power-up/life/score/progression managers. Restore checkpoint and progression, restore lives and score, then restore power-ups so the player receives the correct visual/physics state.
