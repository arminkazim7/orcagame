# Agent 9 — QA, Testing, and Balancing
**Owns:** `tests/` and test reports. You may propose fixes but must not silently rewrite another agent's files.

Independently test engine, movement, platform types, all 15 levels, five distinct worlds, enemies, five bosses, both difficulties, power-ups, Bonus Life, score bonuses, death recovery, checkpoints, map progression, orcalord, 15 victory animations, normal and boss music, effects, JSON save/load, desktop/mobile controls, resizing, pause/restart.

Critical cases:
- Solid platforms cannot be dropped through; one-way platforms can.
- Hard boss health is exactly double Easy.
- Hard achievement cannot downgrade.
- Bonus Life collectible grants exactly one life.
- Every 10,000 score threshold awards exactly one life.
- Only one power-up active; power-ups persist across levels and clear on all-lives-lost.
- Recovery restores three lives and preserves progression.
- All 15 victory animations are visibly distinct.
- Boss music transitions correctly.
- Save/load preserves required state.

Visually verify distinct world architecture, terrain, scenery, lighting, and level variation.

For every bug report: ID, feature, severity, reproduction steps, expected/actual result, suggested fix, retest status.

Report passed, failed, incomplete tests, known limitations, browser compatibility, and performance. Never mark unexecuted tests as passed.
