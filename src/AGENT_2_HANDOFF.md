# Agent 2 Handoff — Player and Physics

**Owned files:** `src/player/Orca.js`, `OrcaPhysics.js`, `OrcaAnimation.js`, `Projectiles.js`, and `index.js`.

## Delivered

- Left/right A/D and arrow movement; Space/Up/W jump; X/F fire; Down+Jump one-way drop-through.
- Gravity, fall cap, acceleration, ground/air control, solid platform side/head/landing collision, one-way upward passage and landing.
- Canvas-drawn black/white orca anatomy: body, white underside, eye patch/eye, dorsal fin, paired pectoral fins, tail peduncle and flukes. No legs.
- Idle/swim/jump/fall animation poses and name/color customization.
- World-space projectiles, directional firing, cooldown and bounds cleanup.
- Damage, knockback, temporary invulnerability, one-hit power-up protection and progression-facing activation hooks.
- Independent size/jump controls and all 15 named victory moves with distinct motion/effects.
- Event emission for audio, UI, progression and combat integration.
- API docs, isolated scene and automated tests.

## Integration

1. Construct `new Orca({ events })` after the event bus and engine services exist.
2. In the engine's single update loop call `orca.update(dt, engine.getInput(), currentPlatforms)`.
3. In the render pass call `orca.render(ctx, camera.getX())` (or the engine's equivalent camera world offset).
4. Use the shared platform data with `{x,y,width,height,oneWay}` or `{x,y,w,h,oneWay}`. `isOneWay: true` and `type: 'oneWay'` are also recognized.
5. Wire `player.jump` to the jump sound. `player.dropThrough` is intentionally separate and does not emit jump.
6. On progression-approved collection call `orca.applyPowerUp('sea-berry' | 'golden-krill' | 'bubble-shell')`. Consume progression state on `player.protectionConsumed`.
7. On recovery after all lives are lost call `orca.recover()`.
8. Trigger a move with `orca.triggerVictoryAnimation(name)`; the start event includes `playerName` for the victory UI. Play fanfare through Agent 7's audio integration, respecting the audio setting.
9. Combat checks `orca.projectiles.items`; when a projectile hits, set `alive = false`.

## Verification

`npm test` — 13 tests pass. The module is standalone and has not yet been merged against an Agent 1 engine implementation; the shared interface contract is still marked as a proposal in the supplied architecture pack.
