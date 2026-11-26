# Authored campaign layouts

All fifteen campaign levels are authored independently in `src/worlds/level-data.js`.
Each entry defines world-space platform segments, hazards, decorations, enemy spawn
points and pickup coordinates. `src/worlds/levels.js` validates the requested campaign
number and turns that data into the runtime level object; it does not generate layouts
from route templates or apply level-number offsets.

The five world themes are also authored in `level-data.js` and consumed by
`LevelRenderer`:

- Coral Coast — coral and reef terrain
- Sunken Ruins — stone, columns and temple details
- Deep Sea Trench — basalt and luminous crystals
- Kelp Forest — roots, kelp and flowers
- Arctic Ice Shelf — ice formations and snow details

Terrain is made from separated solid floor sections and one-way platforms. The spaces
between floor sections are intentional fall hazards: falling below the playable world
costs a life and respawns at the active checkpoint or level start. Spikes and vents are
authored per level and apply damage through the shared combat event bus.

Enemy spawn points refer to authored coordinates and platform indices. The encounter
system retains difficulty-based enemy counts and type selection, but no longer chooses
locations by round-robin platform count when authored spawn data is available.

When adding a level, add a new numbered entry to `AUTHORED_LEVELS` with its own
platforms, hazards, decorations, spawn points and pickups. Keep stable IDs unique
within the level and ensure each spawn point's platform index points to a platform in
that entry's `platforms` array.
