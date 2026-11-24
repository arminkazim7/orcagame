import test from 'node:test';
import assert from 'node:assert/strict';
import { UIManager } from '../../src/ui/UIManager.js';
import { createGameRuntime } from '../../src/main.js';

class FakeRoot {
  constructor(){this.innerHTML='';this.listeners={};this.children=[];}
  addEventListener(n,fn){this.listeners[n]=fn;}
  removeEventListener(n){delete this.listeners[n];}
  replaceChildren(){this.innerHTML='';this.children=[];}
  querySelector(){return null;}
  insertAdjacentHTML(_where,html){this.innerHTML+=html;}
}
function fixture(){const root=new FakeRoot();const runtime=createGameRuntime({audioEnabled:false});const ui=new UIManager({root,runtime});return {root,runtime,ui};}

test('main menu exposes adventure, map, save/load and settings actions',()=>{const {root,ui}=fixture();ui.showMainMenu();for(const x of ['Start Adventure','World Map','Load Save','Save Game','Settings'])assert.ok(root.innerHTML.includes(x));});
test('character setup renders name, palette, difficulty and orca preview canvas',()=>{const {root,ui}=fixture();ui.showCharacterSetup();for(const x of ['name="name"','name="colour"','name="difficulty"','data-preview'])assert.ok(root.innerHTML.includes(x));});
test('world map renders all fifteen level nodes and five boss markers',()=>{const {root,ui}=fixture();ui.showWorldMap();assert.equal((root.innerHTML.match(/class="map-node/g)||[]).length,15);assert.equal((root.innerHTML.match(/class="map-boss/g)||[]).length,5);});
test('world map distinguishes Hard Gold, Easy-only, available and locked',()=>{const {root,runtime,ui}=fixture();runtime.progression.completeLevel({level:1,difficulty:'hard'});runtime.progression.completeLevel({level:2,difficulty:'easy'});ui.showWorldMap();assert.match(root.innerHTML,/map-node gold/);assert.match(root.innerHTML,/map-node green/);assert.match(root.innerHTML,/map-node available/);assert.match(root.innerHTML,/map-node locked/);});
test('world map preserves Gold even when an Easy completion also exists',()=>{const {root,runtime,ui}=fixture();runtime.progression.completeLevel({level:1,difficulty:'hard'});runtime.progression.completeLevel({level:1,difficulty:'easy'});ui.showWorldMap();assert.match(root.innerHTML,/map-node gold/);});
test('HUD includes all required player and progression fields',()=>{const {root,ui}=fixture();ui.showMainMenu();const hud=ui.updateHUD({bossHealth:72});for(const x of ['PLAYER','WORLD','LEVEL','MODE','LIVES','SCORE','NEXT LIFE','DEATHS','POWER-UP','BOSS'])assert.ok(hud.innerHTML.includes(x));});
test('level victory invokes the actual player animation API',()=>{const {runtime,ui}=fixture();let called=null;runtime.player.triggerVictoryAnimation=n=>(called=n,n);ui.showVictory({level:3,playerName:'Mako'});assert.equal(called,'leap/splash');});
test('boss victory and final ending invoke player animations',()=>{const {runtime,ui}=fixture();const calls=[];runtime.player.triggerVictoryAnimation=n=>calls.push(n);ui.showBossVictory({level:4,bossId:'kelp-guardian'});ui.showFinalEnding();assert.deepEqual(calls,['treasure chest spin','grand victory leap']);});
test('recovery screen offers difficulty selection without owning recovery mechanics',()=>{const {root,ui}=fixture();ui.showRecoveryScreen();assert.ok(root.innerHTML.includes('recoveryDifficulty'));assert.ok(root.innerHTML.includes('Resume Dive'));});
test('settings expose audio toggles',()=>{const {root,ui}=fixture();ui.showSettings();assert.ok(root.innerHTML.includes('name="music"'));assert.ok(root.innerHTML.includes('name="sound"'));});
test('mobile controls expose all five required control actions',()=>{const {root,ui}=fixture();ui.showMainMenu();ui.mountMobileControls();for(const key of ['left','right','jump','shoot','dropThrough'])assert.ok(root.innerHTML.includes(`data-control="${key}"`));});
test('UI disposal unregisters event listeners',()=>{const {root,ui}=fixture();ui.dispose();assert.deepEqual(root.listeners,{});});
test('pause menu pauses the shared runtime state and audio scheduler',()=>{const {runtime,ui}=fixture();ui.showPauseMenu();assert.equal(runtime.state.gameplay.paused,true);});
test('UI is attachable from the Agent 0 composition root',()=>{const root=new FakeRoot();const runtime=createGameRuntime({uiRoot:root,audioEnabled:false});assert.ok(runtime.ui instanceof UIManager);runtime.ui.showMainMenu();assert.ok(root.innerHTML.includes('Orca Adventure'));runtime.dispose();});

test('mobile controls support simultaneous pointers and release each action independently',()=>{
  const {root,runtime,ui}=fixture();
  const actions=[];
  ui.onInput=action=>actions.push(action);
  const button=control=>({dataset:{control},classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);}},setPointerCapture(){}});
  const left=button('left'), jump=button('jump');
  const down=(pointerId,target)=>root.listeners.pointerdown({pointerId,target:{closest:()=>target},preventDefault(){}});
  const up=pointerId=>root.listeners.pointerup({pointerId});
  down(1,left);down(2,jump);
  assert.equal(runtime.input.isDown('left'),true);
  assert.equal(runtime.input.isDown('jump'),true);
  up(1);
  assert.equal(runtime.input.isDown('left'),false);
  assert.equal(runtime.input.isDown('jump'),true);
  up(2);
  assert.equal(runtime.input.isDown('jump'),false);
  assert.deepEqual(actions.map(a=>[a.control,a.pressed]),[['left',true],['jump',true],['left',false],['jump',false]]);
  runtime.dispose();
});
