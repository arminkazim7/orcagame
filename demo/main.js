import { GameEngine } from '../src/engine/index.js';
import { DemoScene, SecondScene } from './DemoScene.js';

const engine = new GameEngine({ canvas: '#game', width: 960, height: 540, backgroundColor: '#111' });
const input = engine.getInput();
input.bind('restart', ['KeyR']);
input.bind('switch', ['KeyT']);

let onSecond = false;
engine.setScene(new DemoScene());

// Engine-level hotkeys use frame-level edges on the engine's own 'frame' event:
// there is no second game loop, and they keep working while the game is paused.
engine.on('frame', () => {
  if (input.wasPressedThisFrame('pause')) engine.togglePause();
  if (input.wasPressedThisFrame('restart')) engine.restart();
  if (input.wasPressedThisFrame('switch') && !engine.isTransitioning()) {
    onSecond = !onSecond;
    engine.setScene(onSecond ? new SecondScene() : new DemoScene(), {
      transition: { duration: 0.5, color: '#000' },
      data: { label: 'Second scene' },
    });
  }
});

engine.start();
window.engine = engine; // handy for poking around in the console
