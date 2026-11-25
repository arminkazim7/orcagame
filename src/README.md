# Orca Adventure — integrated development workspace

HTML5 Canvas and JavaScript ES modules. No runtime dependencies are required.

## Current playable implementation

The runtime now composes the orca's platform physics with a 15-level campaign, five world themes, enemy encounters, five boss fights, collectible power-ups, bonus lives, checkpoints, level progression, the Agent 6 UI, keyboard/touch input, and audio events.

A browser entry point is available at `demo/orca-adventure.html`. **Start a local web server before opening the game**; do not open the HTML file directly using a `file://` URL, because the game uses JavaScript ES modules.

### Run the game locally

1. Install Python 3 if it is not already installed (or use another local HTTP server).
2. Open a terminal in the repository's root folder (the folder containing `demo/` and `src/`).
3. Start the server:

   **Windows**
   ```powershell
   py -m http.server 8000
   ```

   **macOS / Linux**
   ```bash
   python3 -m http.server 8000
   ```

   If `python3` is unavailable, try `python -m http.server 8000`.

4. Leave the terminal running. Open this address in your browser:

   **[http://localhost:8000/demo/orca-adventure.html](http://localhost:8000/demo/orca-adventure.html)**

5. To stop the server, return to the terminal and press **Ctrl+C**.

If port `8000` is already in use, start the server on another port (for example `8001`) and open the matching URL, such as `http://localhost:8001/demo/orca-adventure.html`.

## Setup and verification

Requires a modern browser and Node.js 20+. From this directory:

```sh
npm test
npm run check
npm install
npm run build
```

The test suite is rooted in the repository-level `tests/` directory. GitHub Actions runs the full Node test suite, runtime syntax checks, and standalone HTML build on each push. Check the repository Actions page for the result matching the latest commit; do not treat an earlier green run as verification of newer changes. Coverage includes the composition root, world layouts, runtime level startup, UI, player, progression, audio, save/load, and engine modules. The build writes a self-contained `dist/orca-adventure.html` with bundled JavaScript and inline CSS. GitHub Actions uploads it as the `orca-adventure-html` artifact. Browser playtesting is still a release gate.

## Runtime API

`createGameRuntime({ canvas, uiRoot })` composes the runtime. Call `runtime.start()` to start its single animation loop and `runtime.startLevel(level)` to start an unlocked campaign level. The UI can also start levels through the world map.

The runtime exposes `player`, `progression`, `score`, `lives`, `powerUps`, `checkpoints`, `events`, `input`, `world`, `ui`, and `saves`. Register additional systems with `runtime.registerSystem({ update(dt, state, events, input), render(ctx, state, events, input) })`. The shared input API provides `isDown(action)`, `setControl(action, pressed)`, and `releaseAll()`.

Keyboard controls: arrows or A/D to move, Space/Up to jump, Down/S to drop through one-way platforms, X/F to shoot, and Escape to pause/resume. Touch controls are mounted during gameplay.

Character selection: choose Orca, Raccoon, or Octopus from the Character dropdown during setup. Each character has a distinct rendered body and movement animation profile (orca tail/fin swim, raccoon tail-and-paw motion, octopus eight tentacle waves). The selected character is included in portable saves.

## Source map

- `src/worlds/` — campaign layouts and playable world lifecycle
- `src/player/` — orca, animation, physics, and projectiles
- `src/enemies/` — enemy AI, combat, bosses, and encounter events
- `src/progression/` — lives, score, checkpoints, power-ups, progression
- `src/ui/` — menus, map, HUD, recovery, save/load, and touch controls
- `src/audio/` — music and sound effects
- `src/save/` — portable save/load

See `architecture/INTERFACES.md` and `architecture/INTEGRATION_STATUS.md` for contracts and remaining release gates.
