# Orca Adventure Integration Status

**Contract:** 1.0.0 · **Build status:** Not release-ready · **Last reviewed:** 2026-11-24

| Module | Owner | Source available | Combined tests passing | Integrated into runtime | Browser acceptance | Status / gap |
|---|---|---:|---:|---:|---:|---|
| Architecture / composition root | Agent 0 | Yes | Yes | Partial | No | Shared config/state/event bus, manager composition and single RAF scheduler exist; full game shell absent. |
| Game engine / collision / input | Agent 1 | Yes | Yes | Partial | No | Engine, camera, collision and input modules exist; the composition root still uses its own single RAF scheduler. Keyboard and UI touch actions now feed shared runtime input, but engine camera/collision are not yet composed into gameplay. |
| Player and physics | Agent 2 | Yes | 13/13 included | Yes (player instance + event bus) | No | Source copied unchanged; platform/world integration pending. |
| Worlds and levels | Agent 3 | No | No | No | No | No `src/worlds/` implementation or playable level definitions; config contains world grouping only. This remains a P0 gameplay blocker. |
| Enemies and bosses | Agent 4 | Yes | Yes | No | No | Enemy and five boss implementations exist under `src/enemies/`, but they use a separate module event bus and are not wired into the composition root or playable level lifecycle. |
| Progression and power-ups | Agent 5 | Yes | 27/27 included | Yes (manager composition) | No | Runtime configured for 15 levels; world/collectible triggers still absent. |
| UI and world map | Agent 6 | Yes | Yes | Yes (optional `uiRoot`) | No | UIManager is attached by `createGameRuntime({ uiRoot, onStartLevel, onMainMenu, onInput })`; keyboard and touch controls share runtime input. Browser acceptance remains pending. |
| Audio | Agent 7 | Yes | 7/7 included | Partial | No | AudioManager composed and event listeners wired; browser playback not verified. |
| Save and Load | Agent 8 | Yes | 11/11 included | Partial | No | SaveManager composed; round-trip tested against live managers; UI file picker/download controls not wired. |
| QA and acceptance | Agent 9 | No | No | No | No | No end-to-end/browser acceptance suite delivered. |

## Integration notes / resolved compatibility
- Specialist source is preserved without rewriting module internals.
- Runtime explicitly constructs Agent 5 progression with 15 levels (the standalone manager default is 25).
- Agent 2 uses numeric facing; Agent 8 requires a string facing value in the portable gameplay snapshot. Agent 0 adapts `-1/1` to `left/right` for save data and back on restore.
- Agent 8 uses a hex `player.colour`; Agent 2 uses named palettes. Agent 0 provides a profile adapter mapping the five supported palette IDs to stable hex values.
- Bonus Life uses the dedicated `bonusLife.collected` event and the Agent 7 `bonusLife` sound; normal power-ups use `powerup.collected`.
- Save/load round-trip against the live composed managers is covered by an integration test. World/enemy state is not yet present because those modules have not been delivered.

## Combined automated verification
Run `npm test` and `npm run check` from `src/`. The package scripts now point to the actual root-level `tests/` directory and source entry files. The previous recorded result of **62 passed, 0 failed** predates the latest integration changes and must be re-run before release.

## P0 integration update (2026-11-24)
- UI adapter is now optionally constructed by the composition root and disposed with it.
- Runtime exposes a shared action-state input object to registered systems; keyboard input and UI touch controls update that state.
- `registerSystem` passes the shared input object as a fourth argument to `update` and `render` hooks.
- `src/package.json` test/check scripts now resolve the actual repository paths.
- Remaining P0 blockers: no playable `src/worlds/` implementation, no end-to-end world/enemy/boss/progression integration, and no browser-tested game entry/build. These are not marked fixed by the UI wiring.

## Release gate
Do not mark complete until all five worlds / fifteen playable levels, five functional bosses, character setup, Easy/Hard rules, Orcalord cheat, combat, collectibles, checkpoint/recovery, victory animations, original gameplay + five boss tracks, world map, JSON Save/Load UI, keyboard/mobile input, single-file bundle, and browser acceptance tests have passed.
