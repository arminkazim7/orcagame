# Agent 1 — Game Engine
**Owns:** `src/engine/`

Build only the engine foundation; do not implement the player, levels, enemies, bosses, menus, or progression.

Implement Canvas initialization, responsive scaling, central `requestAnimationFrame` loop, delta time, rendering pipeline, camera scrolling, keyboard/touch input, collision utilities, entity lifecycle, pause/resume/restart, and scene transitions.

Files: `GameEngine.js`, `Renderer.js`, `Camera.js`, `Collision.js`, `InputManager.js`.

Requirements:
- Consistent world coordinates; camera never mutates entity world positions.
- Collision distinguishes solid and one-way platforms.
- Simultaneous input supported; touch does not block keyboard.
- Avoid physics jumps after tab suspension.
- Expose stable documented APIs: `start`, `pause`, `resume`, `restart`, `update(deltaTime)`, `render`, `setScene`, `getInput`, `getCamera`, `getCollisionSystem`.

Deliver complete source, API docs, tests, and a small test scene demonstrating scrolling, input, and collision. Do not create another game loop in a specialist module.
