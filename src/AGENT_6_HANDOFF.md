# Agent 6 Handoff — UI, World Map, and Screens

**Owner:** `src/ui/` · **Contract:** Agent 0 interface 1.0.0

## Delivered
- `src/ui/UIManager.js`, `src/ui/index.js`, `src/ui/ui.css`
- `docs/UI_API.md`
- `tests/ui/ui.test.mjs` (14 tests)
- `test-scene/agent6-ui.html`

## Runtime integration
Agent 0 `createGameRuntime()` now accepts `uiRoot`, `onStartLevel`, `onMainMenu`, and `onInput`. With `uiRoot`, the runtime constructs `runtime.ui` and disposes it with the runtime.

The UI consumes the shared runtime's player, progression, life, score, power-up, save, and audio managers. It does not implement gameplay mechanics. Level selection calls `ProgressionManager.setCurrentLevel()` and forwards the level to `onStartLevel`. The host game must load the level/world and connect keyboard/mobile intents to Agent 1 input routing.

## Public methods
See `docs/UI_API.md`. Main methods requested by the brief are implemented, as are settings, load screen and mobile-control helpers.

## Acceptance / limitations
- DOM screens and 15-level connected map are covered by unit tests.
- The map displays five boss markers, Hard Gold / Easy-only / available / locked statuses, and Orcalord unlock state.
- Character setup preview uses a temporary instance of Agent 2's actual `Orca` renderer.
- Level, boss and final victory screens trigger Agent 2's real `player.triggerVictoryAnimation()` API.
- Settings call Agent 7's audio toggles; Save/Load calls Agent 8's manual JSON methods.
- Touch buttons emit press/release events for left, right, jump, shoot and drop-through. The host must map these to the central input system.
- UI test suite: 14/14 passing. Full combined project suite: 76/76 passing. Syntax checks pass.
- Browser visual, screen-reader, keyboard-routing and physical mobile-device acceptance are not yet complete. The assembled game still lacks Agents 1, 3, 4 and 9 deliverables.
