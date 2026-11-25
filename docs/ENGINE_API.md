# Engine API (`src/engine/`)

The engine owns the **only** game loop. Specialist modules (player, levels, enemies, bosses, menus, progression) never create their own `requestAnimationFrame`/`setInterval`; they subclass `Scene`/`Entity` and are driven by the engine.

```js
import { GameEngine, Scene, Entity } from './src/engine/index.js';

const engine = new GameEngine({ canvas: '#game', width: 960, height: 540 });
engine.setScene(new MyScene());
engine.start();
```

## Conventions

| Concept | Rule |
|---|---|
| **World space** | Where every entity lives. Y grows downward. Units are logical pixels. |
| **Screen space** | Logical canvas pixels, `0..width` × `0..height` (default 960×540). Used for HUD, menus, touch buttons. |
| **Camera** | Read-only view into world space. Has **no API that writes to an entity**; it only reads a follow target. Shake affects the render offset only, never `camera.x/y`. |
| **Time** | Seconds. `update(dt)` receives a fixed `dt` (default 1/60) or a clamped variable `dt`. |
| **Rects** | `{ x, y, width, height }`, top-left origin, world coordinates. |

## Running it

```
npm test                         # 106 headless tests (node:test, no dependencies)
python3 -m http.server 8080      # then open http://localhost:8080/src/engine/demo/
```
Demo controls: arrows/WASD move · Space/Z jump · Down+Jump drop through a one-way platform · P/Esc pause · R restart · T fade to a second scene. Touch buttons appear after the first touch.

---

## `GameEngine`

### Constructor options
| Option | Default | Notes |
|---|---|---|
| `canvas` | created | Element, CSS selector, or omitted (a canvas is appended to `body`). |
| `width`, `height` | 960, 540 | Logical resolution. |
| `backgroundColor` | `'#000'` | `null` = transparent clear. |
| `fixedTimeStep` | `1/60` | Seconds per simulation step. `0` = one variable step per frame. |
| `maxFrameTime` | `0.25` | Longest real frame time ever simulated. **Prevents jumps after tab suspension.** |
| `maxSubSteps` | `5` | Fixed steps per rendered frame; excess time is dropped (no spiral of death). |
| `pauseOnHidden` | `true` | Auto-pause when the tab is hidden; auto-resume (only if it auto-paused). |
| `showTouchControls` | `'auto'` | `'auto'` shows buttons after the first touch; `true`/`false` force. |
| `bindings` | `DEFAULT_BINDINGS` | Action → `KeyboardEvent.code[]`. |
| `pixelArt`, `integerScaling`, `maxPixelRatio` | `false`, `false`, `2` | Passed to `Renderer`. |

### Methods
| Method | Description |
|---|---|
| `start()` | Start the loop. Idempotent while running/paused. |
| `pause()` | Stop updating; **rendering continues** so overlays can draw. Calls `scene.onPause()`. |
| `resume()` | Continue. Time spent paused is discarded: no catch-up, no jump. Calls `scene.onResume()`. |
| `togglePause()` | Convenience. |
| `restart()` | `onExit` → destroy entities → reset camera/collisions/timers → `onEnter` again with the original data. Also leaves the paused state. Deferred to end of step if called from `update`. |
| `stop()` | Cancel the loop, detach all listeners. `start()` works again afterwards. |
| `update(deltaTime)` | Run **one simulation step**: transition → `scene.update(dt)` → `camera.update(dt)` → clear step input edges → deferred scene changes. Called by the loop; safe to call manually in tests/tools. |
| `render(alpha = 1)` | Draw through the renderer pipeline. `alpha` ∈ [0,1) is the fixed-step interpolation factor. |
| `tick(timestampMs)` | One loop iteration (what the rAF callback calls). Handy for deterministic tests. |
| `setScene(scene, { data, transition })` | See *Scenes & transitions*. |
| `getInput()` / `getCamera()` / `getCollisionSystem()` / `getRenderer()` / `getScene()` | Accessors (stable). |
| `getState()` | `'idle' \| 'running' \| 'paused' \| 'stopped'`. |
| `isTransitioning()` | True during a fade. |
| `getStats()` | `{ fps, frame, updates, elapsed }`. |
| `on(event, fn)` / `off(event, fn)` | `on` returns an unsubscribe function. |

### Events
`start`, `pause`, `resume`, `restart`, `stop`, `resize`, `scenechange` (`{from, to}`), `frame` (`dt`).
`frame` fires once per rendered frame **even while paused**, before updates. Use it with `input.wasPressedThisFrame()` for engine-level hotkeys and pause menus.

### Loop order (per rendered frame)
1. Measure `dt`; clamp to `maxFrameTime`.
2. Emit `frame`.
3. If running: run N fixed `update(fixedTimeStep)` steps (0…`maxSubSteps`). If paused: discard step-level input edges.
4. `render(alpha)`.
5. Clear frame-level input edges.

### Scenes & transitions
```js
engine.setScene(next);                                   // immediate
engine.setScene(next, { transition: true });             // 0.4 s black fade
engine.setScene(next, { transition: { duration: 0.6, color: '#fff' }, data: { level: 3 } });
```
- The **first** scene is always entered immediately.
- During fade-out the outgoing scene is frozen; at full cover the swap happens (`onExit` → entities destroyed → camera/collision reset → `onEnter(engine, data)`); the incoming scene runs during fade-in.
- Calling `setScene` while fading out retargets the pending scene. Calling it from inside `update` takes effect after that step.
- On every scene change the engine **clears the collision system and resets the camera** (position, bounds, target, zoom, shake). Re-register colliders and set bounds in `onEnter`.

---

## `Scene` and `Entity` (exported from `GameEngine.js`)

### `Scene` hooks
| Hook | When |
|---|---|
| `onEnter(engine, data)` | Build the scene: add entities, set camera bounds/follow, register colliders. `this.engine` is already set. |
| `onExit()` | Leaving or restarting. Entities are destroyed right after. |
| `onPause()` / `onResume()` | Engine paused/resumed. |
| `update(dt)` | Default updates entities. **Call `super.update(dt)`** when overriding. |
| `renderBackground(renderer, alpha)` | Screen space, before the world. |
| `renderWorld(renderer, camera, alpha)` | World space (camera transform applied). Default: sorted, culled entity draw. |
| `renderUI(renderer, alpha)` | Screen space, after the world. Default: entities' `renderUI`. |

`scene.add(entity)`, `scene.remove(entity)`, `scene.getByTag(tag)`, `scene.entities` (read-only).
**Adds/removes during `update` are deferred to the end of the step**, so they are always safe inside an entity's `update`. Outside an update they apply immediately.

### `Entity` (optional base class)
Fields: `x, y, width, height, layer, zIndex, tag, active, visible, cullable, scene, destroyed`.

Lifecycle: `init(scene)` once → `update(dt, scene)` each step → `destroy()` once. `kill()` requests removal (safe mid-update).
Drawing: `render(ctx, renderer, alpha)` in world space; `renderUI(ctx, renderer, alpha)` in screen space.
Draw order is `layer`, then `zIndex`, then insertion order. Entities with a size are culled to the camera view (+`scene.cullMargin`); set `cullable = false` for backgrounds. Duck-typed objects work too, since the engine only calls hooks that exist.

---

## `Camera`
| Member | Description |
|---|---|
| `x, y` | World position of the view's top-left. |
| `width, height` | Visible world size (`viewport / zoom`). |
| `zoom` / `setZoom(z)` | Keeps the view centred. |
| `setBounds(x, y, w, h)` / `clearBounds()` | View never leaves the rect; a world smaller than the view is centred. |
| `follow(target, opts)` / `unfollow()` | `target` = `{x, y, width?, height?}` (centre followed; **read-only**). Options: `offsetX`, `offsetY`, `smoothing` (time constant in seconds, frame-rate independent; 0 = rigid), `deadzone: {width, height}`, `snap` (default true). |
| `centerOn(x, y)` / `snapTo(x, y)` | Position by view centre / top-left. |
| `worldToScreen(x, y, out?)` / `screenToWorld(x, y, out?)` | Coordinate conversion in logical pixels. |
| `isVisible(rect, margin = 0)` | World-rect visibility test. |
| `shake(intensity, duration)` | Render-only offset. |
| `update(dt)`, `reset()` | Engine calls these. |

## `CollisionSystem` (`engine.getCollisionSystem()`)
Colliders are plain rects registered **by reference**: moving a platform's `x/y` is picked up immediately. Remove them in `destroy()`.

| Method | Description |
|---|---|
| `addSolid(c)` / `addOneWay(c)` / `add(c)` / `remove(c)` / `clear()` | `add` picks the kind from `c.oneWay === true`. |
| `move(rect, dx, dy, opts)` | **Pure.** Returns the resolved position and contact flags. |
| `moveBody(body, dx, dy, opts)` | Same, then writes `body.x/y`. |
| `isGrounded(rect, opts)` | Collider under `rect` (or `null`). |
| `queryRect(rect, {solid, oneWay})` | Overlapping colliders. |

**Result of `move`:** `{ x, y, movedX, movedY, hitLeft, hitRight, hitTop, hitBottom, ground, colliders }`.
`hitBottom` means *landed during this move*. Apply gravity every step (even when standing) so it stays true while grounded; use `isGrounded` for a stationary probe.

**Options:** `ignoreOneWay` (fall through all one-way platforms), `ignore` (iterable of specific colliders, e.g. only the platform you are dropping through), `maxStep` (sub-step size).

**Rules**
- X is resolved first (solids only), then Y.
- **Solid:** blocks every direction.
- **One-way:** blocks only when moving down *and* the body's bottom was at or above the platform top before the move. Sideways and upward movement pass through.
- Movement is sub-stepped (default `min(width, height) / 2`) so fast bodies cannot tunnel through thin colliders.
- Touching edges are not overlaps; a small epsilon prevents resting bodies from snagging on tile seams.
- Broad phase is a linear scan: fine for hundreds of colliders. Specialists with very large tile maps should register merged rects rather than one per tile.

Stateless helpers: `rectsOverlap`, `pointInRect`, `getPenetration`, `circlesOverlap`, `circleRectOverlap`.

## `InputManager` (`engine.getInput()`)
Keyboard and touch are **independent sources OR-ed per action**: using one never blocks the other, and any number of keys/touches can be held at once. Mouse is tracked for UI.

| Method | Description |
|---|---|
| `isDown(action)` | Held by keyboard **or** touch. |
| `wasPressed(action)` / `wasReleased(action)` | **Step-level** edge. Cleared after every simulation step. Use inside `update`. |
| `wasPressedThisFrame(a)` / `wasReleasedThisFrame(a)` | **Frame-level** edge. Cleared after each rendered frame. Use for UI, hotkeys, pause menus. |
| `getAxis(neg, pos)` | −1 / 0 / +1. |
| `isKeyDown(code)` | Raw `KeyboardEvent.code`. |
| `bind(action, codes)` / `unbind` / `getBindings()` | Remap keys. |
| `addTouchButton(action, rect, label?)` | On-screen button in **logical screen coordinates**; returns an id. Multi-touch and finger sliding between buttons are supported. |
| `removeTouchButton(id)` / `clearTouchButtons()` / `getTouchButtons()` | |
| `getTouches()` | `[{ id, x, y }]` in logical coordinates. |
| `getMouse()` | `{ x, y, down, pressed, released }` (edges are frame-level). |
| `releaseAll()` | Release everything (done automatically on window blur / hidden tab). |

Default bindings: `left` ←/A, `right` →/D, `up` ↑/W, `down` ↓/S, `jump` Space/Z, `action` X/J, `confirm` Enter, `pause` Esc/P. Games may add any action name (`input.bind('dash', ['ShiftLeft'])`).
Bound keys call `preventDefault` (no page scroll), except with Ctrl/Meta/Alt, and key events from text fields are ignored. Touch handlers are non-passive and block page scroll/zoom on the canvas.

## `Renderer` (`engine.getRenderer()`)
- Fits the logical resolution into the window with the aspect ratio preserved ("contain"), sets CSS size, and sizes the backing store with `devicePixelRatio` (capped by `maxPixelRatio`). Window `resize`/`orientationchange` are handled by the engine. Centre the canvas with page CSS (see `demo/index.html`).
- Pipeline: clear → `renderBackground` → world (camera transform) → `renderUI` → touch buttons → transition overlay.
- `clientToLogical(clientX, clientY)` for pointer mapping.
- Draw helpers (use in either space): `fillRect`, `strokeRect`, `circle`, `text`, `image`. The raw `ctx` is always available.
- `pixelSnapCamera` (default on) rounds the render offset to whole logical pixels to avoid tile seams. This affects drawing only, never camera or entity positions.

---

## Integration notes for other agents
1. **Never start another loop.** Put per-frame logic in `Entity.update(dt, scene)` / `Scene.update(dt)`.
2. Scenes own world setup: in `onEnter` call `camera.setBounds(...)`, `camera.follow(player, ...)`, and register colliders (the engine clears them on scene change).
3. Read input in `update` through **actions**, with `wasPressed` for jumps and `isDown` for movement. Use the `*ThisFrame` variants only in UI code.
4. For physics, call `collision.moveBody(entity, vx * dt, vy * dt)` once per step and react to `hitBottom/hitTop/hitLeft/hitRight`.
5. Menus: pause with `engine.pause()`; the engine keeps rendering and emitting `frame`, so a pause overlay in `renderUI` and a resume hotkey on `frame` both work.
6. `src/engine/demo/` is a throw-away test scene. `DemoBox` is **not** the player implementation.


## Campaign integration note

The integrated campaign entry point is `src/main.js` with its world lifecycle in `src/worlds/WorldSystem.js`. The standalone engine API documented above describes the reusable `src/engine/` subsystem; do not assume that every engine facility (including its camera and collision registry) is the active campaign implementation. Consult `architecture/INTEGRATION_STATUS.md` for current composition boundaries.
