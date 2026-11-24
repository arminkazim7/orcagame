# Orca Adventure Integration Status

**Contract:** 1.0.0 · **Build status:** Not release-ready · **Last reviewed:** 2026-11-24

| Module | Owner | Source available | Combined tests passing | Integrated into runtime | Browser acceptance | Status / gap |
|---|---|---:|---:|---:|---:|---|
| Architecture / composition root | Agent 0 | Yes | 194/194 | Yes | No | Runtime now composes the world system, UI, shared input, progression, save/load and audio under one RAF loop. Browser acceptance remains pending. |
| Game engine / collision / input | Agent 1 | Yes | Engine tests included | Partial | No | Shared keyboard/touch input is used by the player physics. The campaign uses its own horizontal camera calculation; the standalone engine camera/collision modules are not yet composed. |
| Player and physics | Agent 2 | Yes | 194/194 suite | Yes | No | Orca physics, one-way platforms, projectiles, damage, recovery and victory animation are used by WorldSystem. |
| Worlds and levels | Agent 3 | Yes | 186/186 suite | Yes | No | Fifteen deterministic level layouts across five worlds are implemented in `src/worlds/`; WorldSystem handles the level lifecycle, camera, collectibles, exits and HUD. |
| Enemies and bosses | Agent 4 | Yes | 186/186 suite | Yes | No | WorldSystem spawns enemies and all five bosses, forwards combat events, handles projectile/stomp hits, boss health and boss victory progression. |
| Progression and power-ups | Agent 5 | Yes | 186/186 suite | Yes | No | Level completion, unlocks, Easy/Hard records, collectibles, bonus lives, checkpoint recovery and score rewards are wired to gameplay. |
| UI and world map | Agent 6 | Yes | 186/186 suite | Yes | No | Main menu, setup, map, gameplay HUD, pause/resume, victory, recovery, save/load and multi-pointer touch controls are connected; screen transitions announce and focus their headings. |
| Audio | Agent 7 | Yes | Audio unit tests included | Partial | No | AudioManager composed; campaign boss IDs map to five distinct tracks, level start/complete transitions select the correct track, and browser playback remains unverified. |
| Save and Load | Agent 8 | Yes | Save/load unit tests included | Yes | No | SaveManager and UI file picker/download controls are connected; portable saves now include active level, collectibles, enemies, projectiles, boss state, player position, and paused/completed state. |
| QA and acceptance | Agent 9 | No | No | No | No | No end-to-end/browser acceptance suite delivered. |

## Integration notes / resolved compatibility
- Specialist source is preserved without rewriting module internals.
- Runtime explicitly constructs Agent 5 progression with 15 levels (the standalone manager default is 25).
- Agent 2 uses numeric facing; Agent 8 requires a string facing value in the portable gameplay snapshot. Agent 0 adapts `-1/1` to `left/right` for save data and back on restore.
- Agent 8 uses a hex `player.colour`; Agent 2 uses named palettes. Agent 0 provides a profile adapter mapping the five supported palette IDs to stable hex values.
- Bonus Life uses the dedicated `bonusLife.collected` event and the Agent 7 `bonusLife` sound; normal power-ups use `powerup.collected`.
- Save/load round-trip against the live composed managers is covered by an integration test. World layouts and encounter state are serialized and restored in portable saves, with validation and rollback.

## Combined automated verification
Run `npm test` and `npm run check` from `src/`. The package scripts now point to the actual root-level `tests/` directory and source entry files. Run the latest GitHub Actions workflow after every source change; only the run for the current `main` commit is authoritative.

## P0 integration update (2026-11-24)
- PR #1 was merged into `main`; subsequent world/gameplay work is being committed directly to `main`.
- Added 15 campaign level layouts and a WorldSystem that composes player physics, camera tracking, enemies, bosses, collectibles, checkpoints, exits, scoring, lives, progression, HUD and victory flow.
- Bridged Agent 4 encounter events into the runtime event bus; added player damage handling and stomp bounce.
- Added a browser entry point at `demo/orca-adventure.html` and a transparent gameplay HUD overlay.
- Added campaign/runtime tests and expanded syntax checks. These tests have not yet been executed against the latest commits.
- Remaining release gates: real-browser acceptance across desktop and mobile layouts, screen-reader review with assistive technology, physical-device touch testing, and a decision on whether the standalone Agent 1 engine should replace the campaign's current loop/camera implementation.

## Release gate
Do not mark complete until all five worlds / fifteen playable levels, five functional bosses, character setup, Easy/Hard rules, Orcalord cheat, combat, collectibles, checkpoint/recovery, victory animations, original gameplay + five boss tracks, world map, JSON Save/Load UI, keyboard/mobile input, single-file bundle, and browser acceptance tests have passed.
