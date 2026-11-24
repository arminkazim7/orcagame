# Agent 7 — Music and Sound
**Owns:** `src/audio/`

Create original synthesized 8-bit underwater audio. Do not use copyrighted game music, commercial music, or copied sound effects.

Implement looping gameplay music; music toggle; five distinct boss tracks; jump, shooting, enemy defeat, power-up collection, Bonus Life collection, player damage, checkpoint, boss damage/defeat, level completion, and final victory sounds.

Each boss track starts immediately at encounter start, replaces normal music, loops until boss defeat, then transitions to victory audio or regular music. Respect music settings. Jump sound plays whenever the orca jumps, including platform jumps. Level fanfare is short, original, clearly distinguishable from gameplay music, and plays at every regular level completion alongside victory animation.

Use Web Audio API or original embedded audio; no external dependencies. Handle browser audio activation restrictions, prevent duplicate overlapping tracks, support pause/resume, and separate music/sound controls.

Expose documented APIs equivalent to `playMusic`, `stopMusic`, `playBossMusic(bossId)`, `playSound(soundId)`, `playVictoryFanfare`, `setMusicEnabled`, `setSoundEnabled`, `pauseAudio`, and `resumeAudio`.

Deliver source, docs, and tests demonstrating all five boss tracks and transitions.
