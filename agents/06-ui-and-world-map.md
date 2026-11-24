# Agent 6 — UI, World Map, and Screens
**Owns:** `src/ui/`

Build character setup (name, colour, Easy/Hard, preview), world map, HUD, menus, settings, victory screens, recovery screen, and mobile controls.

World map displays all 15 levels and five bosses on a fixed connected route. Status colours: gold = Hard completed, green = Easy-only completed, grey = available/uncompleted, red = locked. Hard achievement cannot be downgraded. Support orcalord unlock.

HUD displays player name, world, level, difficulty, lives, score, progress to next score bonus, death counter, active power-up, and boss health.

Screens: main menu, setup, pause, map, settings, level completion, boss victory, final ending, and recovery with difficulty selection.

Provide music/sound toggles connected to audio module. Mobile controls: left, right, jump, shoot, drop-through. Victory screens show player name and trigger the actual animation from player module; do not substitute text for animation.

Create coherent responsive underwater pixel-art-inspired UI. Expose documented APIs equivalent to `showMainMenu`, `showCharacterSetup`, `showWorldMap`, `updateHUD`, `showVictory`, `showBossVictory`, `showFinalEnding`, `showRecoveryScreen`, and `showPauseMenu`.

Do not implement gameplay mechanics owned by other agents. Deliver source, styles, docs, and UI tests.
