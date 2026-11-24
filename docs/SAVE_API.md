# Agent 8 — Save/Load API

`src/save/SaveManager.js` exports `SaveManager`, `SAVE_VERSION`, and `DEFAULT_SAVE_LIMITS`.

## Construction

```js
import { SaveManager } from './src/save/index.js';

const saves = new SaveManager({
  player: orca,
  progression: progressionManager,
  lives: lifeManager,
  score: scoreManager,
  powerUps: powerUpManager,
  checkpoints: checkpointManager,
  profile: playerProfile, // mutable { name, colour, cheatUnlocked }
  getGameplayState: () => ({ world: worldManager.serialize() }),
  setGameplayState: state => worldManager.deserialize(state.world),
  totalLevels: 25
});
```

Manager dependencies are optional. The save service uses the managers' `serialize()` and `deserialize()` methods; it does not own their runtime state. Pass the same live manager instances used by the game.

## Public methods

- `getSaveVersion()` — returns the current schema version (`1`).
- `createSave(overrides?)` — returns a plain JSON-compatible object. `overrides.profile` can override profile fields; `overrides.gameplayState` can supply a complete gameplay snapshot.
- `validateSave(data)` — returns `{ valid, errors }`; does not mutate runtime state.
- `applySave(data)` — validates first, then applies state; returns `{ applied, version }` or `{ applied: false, errors }`.
- `loadSave(jsonTextOrFile)` — parses JSON text or a browser `File`, validates, and applies it. Returns `{ loaded, ... }`.
- `downloadSave(save?, filename?)` — downloads a validated JSON file. Defaults to a newly created save and `orca-adventure-save.json`.
- `pickAndLoadSave(options?)` — opens a browser file picker and loads the selected JSON file. Returns a cancellation result if the picker is dismissed.

`downloadSave` and `pickAndLoadSave` require a browser DOM. Parsing, validation, creation, and application can be tested in Node.

## Version 1 schema

The JSON includes `version`, `savedAt`, player `name` and hex `colour`, `difficulty`, `cheatUnlocked`, progression level unlocks/completions, Easy/Hard records, permanent Gold levels, boss unlock/defeat state, Orcalord unlock state, `score`, `lives`, `deathCount`, `activePowerUp`, `powerUpProtectionHits`, `checkpoint`, `nextBonusLifeThreshold`, `awardedBonusLifeThresholds`, and `gameplayState`.

`gameplayState.player` captures common position/physics fields (`x`, `y`, `vx`, `vy`, `grounded`, `facing`, `rotation`, `animationState`). Additional world/enemy/object state can be included through `getGameplayState` / `setGameplayState`.

## Validation and safety

- Only exact `SAVE_VERSION` is accepted. Future/older versions are rejected; no implicit migration is attempted.
- IDs, level ranges, score/life/death bounds, colour format, power-up IDs, milestone progression, Gold/completion rules, and boss progression are checked.
- A save is fully validated before manager mutation. Application failures trigger a best-effort rollback to captured manager/profile/player state.
- Invalid JSON, unsupported versions, unknown IDs, and inconsistent state return errors instead of throwing through the game loop.
- Manual JSON download and file-picker load are the primary persistence path. No local-storage dependency is used.

## Integration notes

1. Construct `SaveManager` after the progression/life/score/power-up/checkpoint managers.
2. Pass the live player profile object so loaded name/colour/cheat state updates the game profile.
3. Supply `getGameplayState` and `setGameplayState` for game-specific state not represented by the listed managers.
4. Wire a Save UI action to `downloadSave()` and a Load UI action to `pickAndLoadSave()`.
5. On load failure, show the returned `errors`; do not reset or partially initialize the game.

The recovery `levelStart` world coordinate is also persisted separately from the active checkpoint, so an all-lives-lost recovery after loading retains the correct fallback spawn point.
