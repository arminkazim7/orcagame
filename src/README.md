# Orca Adventure — Integrated Application

The production application lives in this directory and uses HTML5 Canvas with JavaScript ES modules. No runtime third-party dependencies are required.

## Run locally

From the repository root, start a local HTTP server (ES modules must not be opened via `file://`):

```powershell
py -m http.server 8000
```

Or on macOS/Linux:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/demo/orca-adventure.html`.

## Verify and build

Run these commands from `src/`:

```sh
npm test
npm run check
npm run build
```

Tests are stored in the repository-level `tests/` directory. The standalone HTML build is written to `../dist/orca-adventure.html` (the repository-level `dist/` directory); CI uploads the build artifact. Check the Actions run corresponding to the latest `main` commit. Browser playtesting is a separate release gate and is not implied by passing automated tests.

## Current feature map

- `main.js`, `game-state.js`, `game-config.js` — runtime composition and shared configuration
- `player/` — Orca, Raccoon and Octopus player rendering, physics, animation and projectiles
- `worlds/` — 15-level campaign and world lifecycle
- `enemies/` — enemy and boss encounters
- `progression/` — score, lives, checkpoints, power-ups and unlocks
- `ui/` — menus, character selection, map, HUD, recovery and victory screens
- `audio/` — synthesized music and sound effects
- `save/` — portable JSON save/load
- `engine/` — reusable engine modules; not all of these standalone modules are the active campaign runtime path

See `../architecture/INTEGRATION_STATUS.md` for current integration boundaries and known acceptance gaps, and `../docs/` for API references.
