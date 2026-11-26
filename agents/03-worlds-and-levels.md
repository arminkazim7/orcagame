# Agent 3 — Worlds, Terrain, and 15 Levels
**Owns:** `src/worlds/`

Build exactly 15 regular levels, three per world:
1–3 Coral Coast (boss ID `boss-w1`, Ember Colossus); 4–6 Sunken Ruins (boss ID `boss-w2`, Frost Sentinel); 7–9 Deep Sea Trench (boss ID `boss-w3`, Storm Serpent); 10–12 Kelp Forest (boss ID `boss-w4`, Gloom Warden); 13–15 Arctic Ice Shelf (boss ID `boss-w5`, Void Sovereign).

World identities must be unmistakable, not just different background colours:
- Coral Coast: tropical coral, sandy seabed, colourful plants.
- Sunken Ruins: ancient columns, temples, ruined walls, treasure.
- Deep Sea Trench: dark caves, glowing creatures, bioluminescence, rocks.
- Kelp Forest: dense twisting kelp, natural tunnels, plant-covered platforms.
- Arctic Ice Shelf: ice formations, frozen caves, glaciers, snow-covered platforms.

All 15 levels need substantial multi-section exploration and recognizable variation in platform arrangements, terrain, decoration, hazards, vertical/horizontal traversal, and scenery. Each level includes spawn, exit, solid and one-way platforms, enemy spawn points, collectibles, checkpoints, world-specific decoration, and hazards.

Boss transitions occur after levels 3, 6, 9, 12, and 15; bosses are separate encounters.

Expose documented APIs equivalent to `loadLevel`, `getLevel`, `getWorld`, `getLevelLength`, `getLevelSpawn`, `getLevelExit`, `getCheckpoints`, `getEnemySpawns`, and `getBossTransition`.

Coordinate platform schema with the engine agent. Deliver all level data, renderer/decorations, docs, tests, and previews for each world.
