# Orca Adventure Integration Status

**Contract:** 1.0.0 · **Build status:** Not release-ready · **Last reviewed:** 2026-11-25

This file describes the integrated application in `src/`. Specialist prompts in `agents/` and older `src/AGENT_*_HANDOFF.md` files are historical planning records; they do not override the current source tree or this status.

| Area | Current implementation | Verification / remaining gap |
|---|---|---|
| Runtime / composition | `src/main.js` composes player, progression, audio, save, UI and campaign world systems under the application loop. | Automated tests and syntax/build checks run in CI. Browser acceptance remains outstanding. |
| Player / characters | Orca, Raccoon and Octopus rendering and character-specific animation; shared movement, combat hooks and victory moves. | Automated tests cover player behavior; verify animation appearance and character movement in browser. |
| Worlds / levels | 15 campaign levels across five themed worlds; world lifecycle, camera, collectibles, exits and HUD. | Automated tests cover level layouts and runtime; visual level-by-level review remains outstanding. |
| Enemies / bosses | Enemy encounters, patrols, combat, five boss encounters and progression events. | Automated tests cover encounters; verify physical enemy/player collision and combat feel in browser. |
| Progression | Lives, score milestones, checkpoints, power-ups, difficulty records, unlocks and boss progression. | Automated unit/integration tests. |
| UI / map | Setup, character selection, map, HUD, pause, victory, recovery, save/load and touch controls. | DOM tests; browser visual, keyboard, accessibility and device acceptance outstanding. |
| Audio | Synthesized music/effects and boss track selection integrated with runtime events. | Automated audio tests; real-browser audio activation and playback remain unverified. |
| Save / load | Portable JSON save/load includes player and active world/encounter state. | Automated validation and round-trip tests; manual browser file-picker/download acceptance outstanding. |
| Build / delivery | Standalone HTML build and CI artifact workflow. | Verify latest workflow for current `main`; artifact build is not a substitute for browser acceptance. |
| QA | Node test suite and syntax/build checks. | No completed end-to-end browser acceptance report yet. |

## Current verification procedure

Run from `src/`:

```sh
npm test
npm run check
npm run build
```

Use the GitHub Actions run for the exact current `main` commit as the authoritative CI result. Do not copy old pass counts from specialist handoffs into current status reports.

## Architecture notes

- `architecture/INTERFACES.md` defines shared contracts, but implementation details in source are authoritative where the application has evolved.
- `src/main.js` and `src/worlds/WorldSystem.js` are the integrated runtime path. The standalone `src/engine/` modules are not necessarily the active campaign loop/camera/collision implementation.
- Agent briefs under `agents/` are work specifications, not a record of completed implementation.
- `docs/` describes public APIs; update it when signatures, defaults, paths, or behavior change.
- Handoff files under `src/` record earlier specialist snapshots. Treat them as historical unless explicitly refreshed against current source and tests.

## Release gates

Do not label the game release-ready until browser acceptance verifies movement and collision, enemy contact/stomp behavior, all victory animations, all worlds and bosses, keyboard/touch controls, audio, save/load, responsive layout, and no critical browser console errors.
