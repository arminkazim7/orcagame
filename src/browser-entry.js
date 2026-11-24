import { createGameRuntime } from './main.js';

const canvas = document.querySelector('#game');
const uiRoot = document.querySelector('#ui-root');
if (!canvas || !uiRoot) throw new Error('Orca Adventure requires #game and #ui-root elements');

const game = createGameRuntime({ canvas, uiRoot });
game.start();

let audioUnlocked = false;
const unlockAudio = () => {
  if (audioUnlocked) return;
  audioUnlocked = true;
  game.unlockAudio();
};
uiRoot.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('pagehide', () => game.dispose(), { once: true });
window.orcaAdventure = game;
