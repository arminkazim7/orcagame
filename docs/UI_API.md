# Agent 6 — UI API

The UI layer is a DOM presentation adapter. It does not own physics, combat, collision, level state, progression rules, audio synthesis, or save validation. It consumes the Agent 0 runtime and forwards user intent through callbacks / manager APIs.

## Setup

```js
import { createGameRuntime } from './src/main.js';
const runtime = createGameRuntime({
  canvas: document.querySelector('#game'),
  uiRoot: document.querySelector('#game-ui'),
  onStartLevel: level => startLevelWorld(level),
  onInput: action => inputRouter(action)
});
runtime.ui.showMainMenu();
```

Include `src/ui/ui.css` in a bundled build or let `UIManager` install its stylesheet link relative to the ES module. No third-party runtime dependencies are used.

## Public API

- `showMainMenu()` — start, map, load, manual save, settings.
- `showCharacterSetup({name, colour, difficulty, characterType})` — player profile, palette and mode selection with a preview of the selected playable character.
- `showWorldMap()` — 15 level nodes on one connected route, five boss markers, permanent Hard Gold / Easy-only / available / locked status, and Orcalord indicator.
- `updateHUD(data)` — player, world, level, difficulty, lives, score, next score-life progress, deaths, power-up and optional boss health.
- `showVictory({level, animation, playerName})` — invokes `player.triggerVictoryAnimation()` on the live runtime player and displays the animation in a dedicated canvas preview.
- `showBossVictory({bossId, level, playerName, animation})` — invokes the player victory animation.
- `showFinalEnding({playerName})` — invokes `grand victory leap`.
- `showRecoveryScreen({difficulty})` — offers Easy/Hard selection using the permitted `all-lives-lost` difficulty boundary.
- `showPauseMenu()`, `showSettings()`, `showLoadSave()`, `showMobileControls()`, `mountMobileControls()`, `dispose()`.

`updateHUD` inserts/replaces a HUD in the UI root's `.orca-ui` shell. Call it when the runtime state changes. `bossHealth` is a percentage (0–100).

## Integration callbacks

- `onStartLevel(level)` is called after selecting an unlocked map node or Continue. The UI does not instantiate a level.
- `onInput(action)` receives `{type:'profile'|'startLevel'|'resume'|'recover'|'control', ...}`. Mobile controls report press and release separately.
- `onMainMenu()` is called when returning to the main menu.

The settings screen calls `AudioManager.setMusicEnabled` and `setSoundEnabled`. Save / Load uses the existing Agent 8 `downloadSave()` and `loadSave(File)` methods; load applies only after Agent 8 validation. `showVictory` uses Agent 2's real animation API, not a substitute text animation.

## Status / limitations

The world map and screens are rendered and unit-tested as DOM UI. The map uses configured route coordinates; world art, playable level transitions, keyboard input routing, and the complete browser shell remain integration work for the relevant agents. The mobile control strip emits input actions but intentionally does not implement movement or shooting mechanics. Browser visual acceptance and touch-device testing remain pending.
