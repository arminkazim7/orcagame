# Orca Adventure — integrated development workspace

HTML5 Canvas / JavaScript ES modules. No runtime dependencies are required.

## Current state
This is the Agent 0 integration workspace, not the finished game. It contains the finalized shared contract and preserved specialist modules from Agents 2, 5, 7 and 8, plus a composition root. Agents 1, 3, 4, 6 and 9 source deliverables are not present. The final game and `dist/orca-adventure.html` are therefore not yet available.

## Setup
Requires a modern browser and Node.js 20+ for tests. Run `npm test` from this directory. To compose the current modules in a browser app, import `createGameRuntime` from `src/main.js`, provide a canvas and optional `uiRoot`, call `runtime.unlockAudio()` from a user gesture, then `runtime.start()`. When a UI root is provided, the runtime mounts `UIManager`, routes keyboard and touch controls through `runtime.input`, and disposes the UI/listeners with `runtime.dispose()`.

## Runtime composition
`createGameRuntime()` constructs one event bus, one Orca, progression/life/score/checkpoint managers, SaveManager and AudioManager. Register world/enemy/gameplay systems with `runtime.registerSystem({ update(dt,state,events,input), render(ctx,state,events,input) })`. The shared input object exposes `isDown(action)`, `setControl(action, pressed)`, and `releaseAll()`. The runtime owns the only animation loop.

## Specialist source
- `src/player/` Agent 2
- `src/progression/` Agent 5
- `src/audio/` Agent 7
- `src/save/` Agent 8

See `architecture/INTERFACES.md` and `architecture/INTEGRATION_STATUS.md` before extending the project.
