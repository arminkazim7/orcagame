# Orca Adventure Shared Interface Contract

**Owner:** Agent 0 · **Contract version:** 1.0.0 · **State schema:** 1

## Runtime decisions
- HTML5 Canvas 2D, JavaScript ES modules, CSS; no runtime third-party dependencies.
- One `createGameRuntime()` composition root, one `EventBus`, one mutable `gameState` snapshot, and one requestAnimationFrame loop using delta time in seconds.
- World coordinates are pixels, origin at world top-left, positive X right / positive Y down. Camera offsets are render-only. Physics values use pixels and seconds.
- Systems register with the runtime and expose optional `update(dt, state, events)` and `render(ctx, state, events)` methods. No specialist may create a second loop.
- Stable level IDs are integers 1–15. World IDs: `coral-cove`, `kelp-forest`, `arctic-depths`, `sunken-ruins`, `abyssal-reach`. Boss IDs are defined in `game-config.js`.
- Difficulty IDs: `easy`, `hard`. Power-up IDs: `sea-berry`, `golden-krill`, `bubble-shell`.

## Ownership
- `game-state.js` creates the app snapshot. Domain managers remain authoritative for their own serializable state; sync to snapshot at integration boundaries, do not maintain duplicate manager instances.
- `event-bus.js` owns synchronous event dispatch. `on` returns an unsubscribe function; `off`, `once`, `emit`, `clear` are supported.
- Agent 2 owns player internals; Agent 5 owns progression; Agent 7 owns audio; Agent 8 owns save serialization. Agent 0 composes them, not rewrites them.
- Engine/world/enemy/UI modules must consume the runtime's player, event bus, coordinate system, and loop.

## Event contract v1
`player.jump`, `player.dropThrough`, `player.shoot`, `player.damaged`, `player.protectionConsumed`, `player.recovered`, `enemy.defeated`, `powerup.collected`, `powerup.applied`, `powerup.consumed`, `bonusLife.collected`, `checkpoint.activated`, `level.completed`, `boss.started`, `boss.damaged`, `boss.defeated`, `difficulty.changed`, `player.victoryAnimationStarted`, `player.victoryAnimationComplete`.

Event payloads are plain JSON-compatible objects (never wrapped in a redundant `{ type, ...payload }` envelope). Agent-local colon-style combat events must be normalized to the dotted shared IDs at the WorldSystem boundary. `player.damaged` is emitted only when Orca damage is actually applied (not while invulnerable or when protection absorbs the hit), and progression consumes it exactly once. Producers emit once per actual occurrence. `level.completed` includes `{ level, difficulty, score, newlyUnlocked, gold, ... }`; `boss.started` includes `{ bossId }`. Audio listens to the above exact IDs. Do not repurpose `powerup.collected` for Bonus Life; use `bonusLife.collected` and map it to the `bonusLife` audio effect.

## Initialization order
1. `EventBus` and shared state.
2. Player.
3. Checkpoint and power-up managers.
4. Life manager, score manager, progression manager.
5. Save manager and audio manager.
6. World, enemy, UI and input systems.
7. Start audio only after a user gesture; start the central loop once.

## Save contract
Use Agent 8 schema version 1. Load validates before mutation. The SaveManager receives the same live manager instances and callbacks for game-specific world/player snapshot fields. Never apply invalid state or silently migrate unknown versions.

## Single-file build
The release build must bundle ES modules, CSS, and assets into `dist/orca-adventure.html`; no runtime network fetches or external dependencies. Do not create a release build until the complete game and browser acceptance suite pass.
