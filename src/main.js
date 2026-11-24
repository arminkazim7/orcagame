import { GAME_CONFIG, BOSS_UNLOCKS } from './game-config.js';
import { createGameState } from './game-state.js';
import { EventBus } from './event-bus.js';
import { Orca } from './player/index.js';
import { PowerUpManager, LifeManager, ScoreManager, CheckpointManager, ProgressionManager } from './progression/index.js';
import { SaveManager } from './save/index.js';
import { AudioManager } from './audio/index.js';
import { createUIManager } from './ui/index.js';

/** Compose specialist systems around one state/event bus and one animation loop. */
export function createGameRuntime({ canvas = null, uiRoot = null, profile = {}, audioEnabled = true, onStartLevel = null, onMainMenu = null, onInput = null } = {}) {
  const state = createGameState();
  const bus = new EventBus();
  const player = new Orca({ x: state.player.x, y: state.player.y, name: profile.name ?? state.player.name, color: profile.color ?? state.player.color, events: bus });
  const checkpoints = new CheckpointManager({ events: bus });
  const powerUps = new PowerUpManager({ player, events: bus });
  const lives = new LifeManager({ player, powerUps, checkpoints, events: bus, levelStart: { x: 80, y: 300 } });
  const score = new ScoreManager({ lives, events: bus });
  const progression = new ProgressionManager({ events: bus, totalLevels: GAME_CONFIG.progression.totalLevels, bossUnlocks: BOSS_UNLOCKS, orcalordRequiresAllHard: true });
  const paletteHex = { classic: '#101820', midnight: '#142d50', teal: '#075b62', rose: '#553448', gold: '#56451b' };
  const playerProfile = Object.defineProperties({}, {
    name: { enumerable: true, get: () => player.name, set: value => player.customize({ name: value }) },
    colour: { enumerable: true, get: () => paletteHex[player.color] ?? paletteHex.classic, set: value => { const match = Object.entries(paletteHex).find(([, hex]) => hex.toLowerCase() === String(value).toLowerCase()); player.customize({ color: match?.[0] ?? 'classic' }); } },
    cheatUnlocked: { enumerable: true, get: () => Boolean(state.progression.cheatUnlocked), set: value => { state.progression.cheatUnlocked = Boolean(value); } }
  });
  const audio = audioEnabled ? new AudioManager({ musicEnabled: state.settings.musicEnabled, soundEnabled: state.settings.soundEnabled }) : null;
  if (audio) {
    bus.on('player.jump', () => audio.playSound('jump'));
    bus.on('player.shoot', () => audio.playSound('shoot'));
    bus.on('enemy.defeated', () => audio.playSound('enemyDefeat'));
    bus.on('powerup.collected', () => audio.playSound('powerUp'));
    bus.on('bonusLife.collected', () => audio.playSound('bonusLife'));
    bus.on('player.damaged', () => audio.playSound('playerDamage'));
    bus.on('checkpoint.activated', () => audio.playSound('checkpoint'));
    bus.on('boss.started', ({ bossId }) => audio.playBossMusic(bossId));
    bus.on('boss.damaged', () => audio.playSound('bossDamage'));
    bus.on('boss.defeated', () => { audio.stopMusic(); audio.playSound('bossDefeat'); audio.playVictoryFanfare(); });
    bus.on('level.completed', () => { audio.playSound('levelComplete'); audio.playVictoryFanfare(); });
  }
  const saves = new SaveManager({ player, progression, lives, score, powerUps, checkpoints, profile: playerProfile,
    totalLevels: GAME_CONFIG.progression.totalLevels,
    getGameplayState: () => ({ elapsedSeconds: state.gameplay.elapsedSeconds, cameraX: state.gameplay.cameraX, paused: state.gameplay.paused, player: { x: player.x, y: player.y, vx: player.vx, vy: player.vy, grounded: player.grounded, facing: player.facing < 0 ? 'left' : 'right', animationState: player.animationState } }),
    setGameplayState: snapshot => { state.gameplay = { ...state.gameplay, elapsedSeconds: snapshot.elapsedSeconds ?? state.gameplay.elapsedSeconds, cameraX: snapshot.cameraX ?? state.gameplay.cameraX, paused: snapshot.paused ?? state.gameplay.paused }; if (snapshot.player?.facing) player.facing = snapshot.player.facing === 'left' ? -1 : 1; } 
  });
  bus.on('score.changed', ({ score: value }) => { state.player.score = value; });
  bus.on('life.gained', ({ lives: value }) => { state.player.lives = value; });
  bus.on('life.lost', ({ lives: value }) => { state.player.lives = value; });
  bus.on('player.recovered', ({ lives: value, deathCount }) => { state.player.lives = value; state.player.deathCount = deathCount; });
  bus.on('checkpoint.activated', checkpoint => { state.checkpoint = checkpoint; });
  bus.on('difficulty.changed', ({ difficulty }) => { state.progression.difficulty = difficulty; });
  bus.on('level.completed', result => { state.progression.currentLevel = Math.min(GAME_CONFIG.progression.totalLevels, result.level + 1); });
  let raf = null, previous = null, running = false;
  const systems = [];
  const controls = { left: false, right: false, jump: false, down: false, shoot: false, dropThrough: false };
  const input = {
    ...controls,
    isDown(action) { return Boolean(controls[action]); },
    setControl(action, pressed) {
      if (!Object.hasOwn(controls, action)) return false;
      controls[action] = Boolean(pressed);
      if (action === 'dropThrough') { controls.down = Boolean(pressed); controls.jump = Boolean(pressed); }
      return true;
    },
    releaseAll() { for (const action of Object.keys(controls)) controls[action] = false; }
  };
  const handleUIInput = action => {
    if (action?.type === 'control') input.setControl(action.control, action.pressed);
    if (action?.type === 'resume' || action?.type === 'recover') state.gameplay.paused = false;
    onInput?.(action);
  };
  const runtime = { get player() { return player; }, get state() { return state; }, get progression() { return progression; }, get score() { return score; }, get lives() { return lives; }, get powerUps() { return powerUps; }, get saves() { return saves; }, get audio() { return audio; } };
  const ui = uiRoot ? createUIManager({ root: uiRoot, runtime, onStartLevel, onMainMenu, onInput: handleUIInput }) : null;
  ui?.showMainMenu();
  const keyActions = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', ArrowDown: 'down', KeyS: 'down', KeyX: 'shoot', KeyF: 'shoot' };
  const keyTarget = typeof window !== 'undefined' ? window : null;
  const onKeyDown = event => { const action = keyActions[event.code]; if (!action || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return; input.setControl(action, true); if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.code)) event.preventDefault(); };
  const onKeyUp = event => { const action = keyActions[event.code]; if (action) input.setControl(action, false); };
  keyTarget?.addEventListener('keydown', onKeyDown);
  keyTarget?.addEventListener('keyup', onKeyUp);
  function frame(timestamp) {
    if (!running) return;
    const dt = previous === null ? 0 : Math.min((timestamp - previous) / 1000, 1 / 15); previous = timestamp;
    if (!state.gameplay.paused) {
      state.gameplay.elapsedSeconds += dt;
      for (const system of systems) system.update?.(dt, state, bus, input);
    }
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const system of systems) system.render?.(ctx, state, bus, input);
      if (!systems.some(s => s.render)) player.render(ctx, state.gameplay.cameraX);
    }
    raf = requestAnimationFrame(frame);
  }
  return {
    config: GAME_CONFIG, state, events: bus, player, checkpoints, powerUps, lives, score, progression, saves, audio, ui, input,
    registerSystem(system) { if (!system || typeof system !== 'object') throw new TypeError('System must be an object'); systems.push(system); return () => { const i = systems.indexOf(system); if (i >= 0) systems.splice(i,1); }; },
    start() { if (running || typeof requestAnimationFrame !== 'function') return false; running = true; previous = null; raf = requestAnimationFrame(frame); return true; },
    stop() { running = false; if (raf !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = null; previous = null; input.releaseAll(); },
    async unlockAudio() { return audio?.unlockAudio(); },
    dispose() { this.stop(); keyTarget?.removeEventListener('keydown', onKeyDown); keyTarget?.removeEventListener('keyup', onKeyUp); ui?.dispose?.(); audio?.dispose?.(); bus.clear(); }
  };
}
