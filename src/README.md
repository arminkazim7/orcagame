# Orca Adventure — integrated development workspace

HTML5 Canvas and JavaScript ES modules. No runtime dependencies are required.

## Current playable implementation

The runtime now composes the orca's platform physics with a 15-level campaign, five world themes, enemy encounters, five boss fights, collectible power-ups, bonus lives, checkpoints, level progression, the Agent 6 UI, keyboard/touch input, and audio events.

A browser entry point is available at `demo/orca-adventure.html`. Serve the repository over HTTP (for example, `python -m http.server 8000` from the repository root) and open `http://localhost:8000/demo/orca-adventure.html`. The game uses ES modules, so opening the HTML directly as a `file://` URL is not supported by browsers that block module loading from local files.

## Setup and verification

Requires a modern browser and Node.js 20+. From this directory:

```sh
npm test
npm run check
```

The test suite is rooted in the repository-level `tests/` directory. The latest GitHub Actions run passed **186 tests with 0 failures**, and the runtime syntax checks passed. Coverage includes the composition root, world layouts, runtime level startup, UI, player, progression, audio, save/load, and engine modules. Browser playtesting and the final single-file release build are still release gates.

## Runtime API

`createGameRuntime({ canvas, uiRoot })` composes the runtime. Call `runtime.start()` to start its single animation loop and `runtime.startLevel(level)` to start an unlocked campaign level. The UI can also start levels through the world map.

The runtime exposes `player`, `progression`, `score`, `lives`, `powerUps`, `checkpoints`, `events`, `input`, `world`, `ui`, and `saves`. Register additional systems with `runtime.registerSystem({ update(dt, state, events, input), render(ctx, state, events, input) })`. The shared input API provides `isDown(action)`, `setControl(action, pressed)`, and `releaseAll()`.

Keyboard controls: arrows or A/D to move, Space/Up to jump, Down/S to drop through one-way platforms, X/F to shoot, and Escape to pause/resume. Touch controls are mounted during gameplay.

## Source map

- `src/worlds/` — campaign layouts and playable world lifecycle
- `src/player/` — orca, animation, physics, and projectiles
- `src/enemies/` — enemy AI, combat, bosses, and encounter events
- `src/progression/` — lives, score, checkpoints, power-ups, progression
- `src/ui/` — menus, map, HUD, recovery, save/load, and touch controls
- `src/audio/` — music and sound effects
- `src/save/` — portable save/load

See `architecture/INTERFACES.md` and `architecture/INTEGRATION_STATUS.md` for contracts and remaining release gates.
