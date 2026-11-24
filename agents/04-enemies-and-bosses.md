# Agent 4 — Enemies, Combat, and Bosses
**Owns:** `src/enemies/`

Implement enemy spawning, patrols, boundary turns, platform collision, contact damage, projectile hit detection, defeat effects, and optional stomp defeat. Hard mode must spawn more enemies than Easy.

Create five visually distinct bosses, one per world, appearing after levels 3, 6, 9, 12, and 15. Each needs unique appearance, health bar, damage handling, attack patterns, projectiles, collision, defeat condition, defeat animation, and defeat event.

Hard boss health must be exactly twice Easy boss health. Support player projectile damage, enemy projectiles, player hit detection, power-up protection via shared interfaces, and boss health updates.

Do not own lives or power-up rules; emit damage events to progression.

Expose documented APIs equivalent to `spawnEnemies`, `updateEnemies`, `renderEnemies`, `spawnBoss`, `damageBoss`, `damageEnemy`, `updateBoss`, `isBossDefeated`, and `clearEnemies`.

Deliver source, docs, and tests covering all bosses, both difficulties, patrols, projectiles, collisions, and defeat.
