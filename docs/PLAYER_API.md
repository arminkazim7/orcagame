# Agent 2 — Player API

## Module contents

- `Orca.js` — playable orca entity, customization, damage, power-up hooks, shooting, and event emission.
- `OrcaPhysics.js` — deterministic movement, gravity, jump and platform collision.
- `OrcaAnimation.js` — character-specific idle/swim/jump/fall motion profiles and 15 named victory moves.
- `Projectiles.js` — world-space projectile lifecycle and rendering.

Import from `src/player/index.js`:

```js
import { Orca, VICTORY_ANIMATIONS } from './src/player/index.js';
const orca = new Orca({ x: 100, y: 300, name: 'Orca', color: 'classic', characterType: 'orca', events });
```

## Engine lifecycle contract

The engine owns the only animation loop. Call `orca.update(deltaTime, input, platforms, options)` once from the engine update phase and `orca.render(ctx, cameraX)` from its render phase. `deltaTime` is seconds. Player coordinates and projectiles are world-space; `cameraX` is used only during rendering and never mutates world positions.

`input` may be the shared input manager (`isDown(key)` or `isKeyDown(key)`) or a plain object whose keys are `ArrowLeft`, `KeyA`, `ArrowRight`, `KeyD`, `Space`, `ArrowUp`, `KeyW`, `ArrowDown`, `KeyS`, `KeyX`, and `KeyF`. If the engine exposes `getInput()`, pass that result directly.

Platforms use `{ x, y, width, height, oneWay }`. `oneWay: true` permits upward passage and landing from above. Solid platforms block horizontal movement, upward passage, and downward passage. Down+Jump drops through only a one-way platform. Drop-through emits `player.dropThrough`, not `player.jump`.

## Public methods

| Method | Purpose |
|---|---|
| `update(dt, input, platforms, options?)` | Advance physics, shooting, projectiles, and animation. |
| `render(ctx, cameraX?)` | Draw the anatomically correct orca and projectiles. |
| `shoot()` | Fire one projectile in the current facing direction. |
| `customize({ name?, color?, characterType? })` | Set display name and palette (`classic`, `midnight`, `teal`, `rose`, `gold`). |
| `setSize(scale)` | Set absolute size multiplier; clamped to 0.65–2.25. |
| `setJumpStrength(multiplier)` | Set jump velocity multiplier; clamped to 0.5–2.5. |
| `applyPowerUp(type)` | Apply one progression-selected power-up and replace any previous one. |
| `clearPowerUp()` | Remove active power-up effects. |
| `takeDamage(options?)` | Consume one protection hit or register damage; returns `true` only when damage was applied. |
| `setInvulnerable(milliseconds)` | Set temporary invulnerability. |
| `triggerVictoryAnimation(name, duration?)` | Start a named victory animation; returns its canonical name. |
| `getVictoryAnimationName()` | Return active victory animation name or `null`. |
| `recover()` | Clear power-up, reset motion/projectiles, and grant brief recovery invulnerability. |

### Power-up hooks

Progression owns collection, persistence, and consumption decisions. It calls `applyPowerUp` when activation is authorized and handles `player.protectionConsumed` when the one-hit protection is used.

- Sea Berry: size ×1.4, one-hit protection.
- Golden Krill: size ×1.8, jump strength ×1.35, one-hit protection.
- Bubble Shell: unchanged size/jump, one-hit protection.

Only one power-up is active; applying another replaces the previous one. `recover()` clears it on all-lives recovery. The player module does not manage score, lives, level persistence, or collection.

### Events emitted

`player.jump`, `player.dropThrough`, `player.shoot`, `player.customized`, `player.sizeChanged`, `player.jumpStrengthChanged`, `player.powerUpApplied`, `player.powerUpCleared`, `player.protectionConsumed`, `player.damaged`, `player.recovered`, `player.victoryAnimationStarted`, and `player.victoryAnimationComplete`.

Events are sent to `options.events.emit(name, payload)` and/or `options.onEvent(name, payload)`.

## Victory animation catalog

`VICTORY_ANIMATIONS` exports these exact names: tail slap; barrel roll; leap/splash; treasure chest spin; bubble-ring trick; tail flip; spiral swim; somersault; big tail splash; kelp weave; spinning dash; jump through bubbles; ice arch slide; double flip; grand victory leap.

Each move has its own motion profile and visible effect layer. All poses preserve the orca body, dorsal fin, tail flukes, pectoral fins, underside, and eye patches. The `player.victoryAnimationStarted` event includes the name and player display name; completion emits `player.victoryAnimationComplete`.

## Integration notes

- The module does not import or instantiate the engine, renderer, camera, progression, audio, or DOM.
- Pass the engine's collision platform list into `update`; collision is resolved internally as a fallback for the engine's shared platform shape.
- Connect `player.jump` to the audio manager's jump sound. Do not emit it for drop-through.
- Connect `player.victoryAnimationStarted` to the victory UI and completion fanfare; respect audio settings in the audio module.
- Enemy/combat code can inspect `orca.projectiles.items`, mark a hit projectile's `alive = false`, and remove it on the next update.


## Playable characters

- `orca`: streamlined orca with tail fluke and pectoral-fin swim motion.
- `raccoon`: grey-brown raccoon with face mask, ears, ringed bushy tail, and animated paws.
- `octopus`: purple octopus with mantle, expressive eyes, and eight animated tentacles.

Character IDs are `orca`, `raccoon`, and `octopus`. Choose one in the character setup menu; the selection is included in portable saves. Character animations reuse shared physics and the runtime's single animation loop.
