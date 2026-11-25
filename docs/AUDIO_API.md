# Orca Adventure audio module (Agent 7)

All audio is original, synthesized at runtime with the Web Audio API. No copyrighted music, copied effects, external audio files, or third-party dependencies are used.

## Files

- `src/audio/AudioManager.js` — synthesizer, music scheduler, sound effects, settings, and lifecycle.
- `src/audio/index.js` — module exports.
- `tests/audio/AudioManager.test.mjs` — automated API and behavior tests.

## Quick integration

```js
import { AudioManager } from './audio/AudioManager.js';

export const audio = new AudioManager({ musicEnabled: true, soundEnabled: true });

// Call once from a real user gesture (Start button / first pointer or key action).
startButton.addEventListener('click', async () => {
  await audio.unlockAudio();
  audio.playMusic();
});

// Event bus wiring (adapt event names to the finalized Agent 0 contract).
events.on('player.jump', () => audio.playSound('jump'));
events.on('player.shoot', () => audio.playSound('shoot'));
events.on('enemy.defeated', () => audio.playSound('enemyDefeat'));
events.on('powerup.collected', () => audio.playSound('powerUp'));
events.on('bonusLife.collected', () => audio.playSound('bonusLife'));
events.on('player.damaged', () => audio.playSound('playerDamage'));
events.on('checkpoint.activated', () => audio.playSound('checkpoint'));
events.on('boss.started', ({ bossId }) => audio.playBossMusic(bossId));
events.on('boss.damaged', () => audio.playSound('bossDamage'));
events.on('boss.defeated', () => {
  audio.stopMusic();
  audio.playSound('bossDefeat');
  audio.playVictoryFanfare();
});
events.on('level.completed', () => {
  audio.playSound('levelComplete');
  audio.playVictoryFanfare();
  // The level-complete event should be emitted once per level completion.
});

// Settings and lifecycle.
audio.setMusicEnabled(gameState.settings.musicEnabled);
audio.setSoundEnabled(gameState.settings.soundEnabled);
// On pause: await audio.pauseAudio(); On unpause: await audio.resumeAudio();
// On application teardown: await audio.dispose();
```

## Public API

| Method | Behavior |
|---|---|
| `playMusic()` | Starts/restarts looping gameplay music. |
| `stopMusic()` | Stops the active music scheduler and clears pending music. |
| `playBossMusic(bossId)` | Replaces normal music with one of five looping boss themes. IDs containing 1–5 map to `boss-1` … `boss-5`; unknown IDs fall back to boss 1. |
| `playSound(soundId)` | Plays a named synthesized effect; returns `false` if disabled, locked, paused, or unknown. |
| `playVictoryFanfare()` | Plays a short original completion fanfare. |
| `setMusicEnabled(enabled)` | Toggles music independently from effects. |
| `setSoundEnabled(enabled)` | Toggles effects independently from music. |
| `pauseAudio()` / `resumeAudio()` | Suspends and resumes audio; active music resumes from the beginning of its loop. |
| `unlockAudio()` | Must be called from a user gesture to satisfy browser activation restrictions. |
| `setMasterVolume(0…1)` | Sets overall output level. |
| `dispose()` | Stops scheduling and closes the audio context. |

### Sound IDs

`jump`, `shoot`, `enemyDefeat`, `powerUp`, `bonusLife`, `playerDamage`, `checkpoint`, `bossDamage`, `bossDefeat`, `levelComplete`, `victory`.

### Boss music

Five distinct themes are defined: `boss-1`, `boss-2`, `boss-3`, `boss-4`, and `boss-5`. Calling `playBossMusic` stops the previous scheduler before starting the new theme. A boss theme loops until `stopMusic`, another track request, or audio pause. On boss defeat, the integration layer should stop the boss theme and play the boss-defeat/fanfare sequence, then call `playMusic()` when regular gameplay resumes.

## Browser constraints

Browsers may block audio until a user gesture. The module does not try to bypass that policy: call `unlockAudio()` from Start or another direct interaction. Music requests made before unlock are retained as a single pending request. Repeated track requests replace the old scheduler, avoiding duplicate music loops. Music and SFX have separate gain nodes and settings.

## Integration note

The shared event names are defined in `architecture/INTERFACES.md`. Bonus Life is a separate `bonusLife.collected` event, not a `powerup.collected` subtype. The integrated runtime is the authoritative example of event wiring.
