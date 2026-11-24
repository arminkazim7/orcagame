# Agent 2 — Orca Character and Physics
**Owns:** `src/player/`

Build the playable orca: left/right movement, swimming/running animation, jumping, gravity, falling, solid-platform collision, one-way landing and upward passage, Down+Jump drop-through, shooting, projectile support, name and colour customization, size and jump-strength changes, damage/invulnerability, and victory animations.

The orca must visibly read as an orca: black/white body, dorsal fin, tail flukes, pectoral fins, underside and eye patches. Do not give it legs.

Controls: Left/A, Right/D, Space/Up/W, X/F shoot, Down+Jump drop through one-way platforms.

Power-up hooks: Sea Berry enlarges and protects against one hit; Golden Krill makes the orca giant, increases jump height and protects against one hit; Bubble Shell protects against one hit without changing size. Progression decides activation and consumption.

Implement actual visible animations for all 15: tail slap, barrel roll, leap/splash, treasure chest spin, bubble-ring trick, tail flip, spiral swim, somersault, big tail splash, kelp weave, spinning dash, jump through bubbles, ice arch slide, double flip, grand victory leap.

Expose documented methods to trigger a named victory animation and adjust size/jump properties. Deliver source, docs, tests, and an isolated test scene.
