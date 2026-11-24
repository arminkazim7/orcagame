import test from 'node:test';
import assert from 'node:assert/strict';
import { PowerUpManager, LifeManager, ScoreManager, CheckpointManager, ProgressionManager } from '../src/progression/index.js';

class Events {
  listeners = new Map(); emitted = [];
  on(name, fn) { const a = this.listeners.get(name) ?? []; a.push(fn); this.listeners.set(name, a); }
  emit(name, data) { this.emitted.push({ name, data }); for (const fn of this.listeners.get(name) ?? []) fn(data); }
}
function playerMock() {
  return { x: 0, y: 0, vx: 0, vy: 0, grounded: true, sizeScale: 1, jumpScale: 1, protectionHits: 0,
    applyPowerUp(type) { const p = { 'sea-berry': [1.4,1], 'golden-krill': [1.8,1.35], 'bubble-shell': [1,1] }[type]; this.activePowerUp = type; this.setSize(p[0]); this.setJumpStrength(p[1]); this.protectionHits = 1; },
    setSize(n) { this.sizeScale = n; }, setJumpStrength(n) { this.jumpScale = n; }, clearPowerUp() { this.activePowerUp = null; this.protectionHits = 0; this.setSize(1); this.setJumpStrength(1); },
    recover() { this.clearPowerUp(); this.vx = this.vy = 0; this.alive = true; }
  };
}

test('all three power-ups apply the specified player changes and one-hit protection', () => {
  for (const [id, size, jump] of [['sea-berry',1.4,1],['golden-krill',1.8,1.35],['bubble-shell',1,1]]) {
    const p = playerMock(), m = new PowerUpManager({ player:p });
    const got = m.collectPowerUp(id);
    assert.equal(got.id,id); assert.equal(p.sizeScale,size); assert.equal(p.jumpScale,jump); assert.equal(p.protectionHits,1);
  }
});
test('only one power-up is active; new pickup replaces prior power-up', () => {
  const p=playerMock(), m=new PowerUpManager({player:p});
  m.collectPowerUp('sea-berry'); const next=m.collectPowerUp('bubble-shell');
  assert.equal(next.id,'bubble-shell'); assert.equal(m.getActivePowerUp().id,'bubble-shell'); assert.equal(p.sizeScale,1);
});
test('power-up protection consumes once and returns player to normal properties', () => {
  const p=playerMock(), m=new PowerUpManager({player:p}); m.collectPowerUp('golden-krill');
  assert.equal(m.consumeProtection(),true); assert.equal(m.consumeProtection(),false);
  assert.equal(m.getActivePowerUp(),null); assert.equal(p.sizeScale,1); assert.equal(p.jumpScale,1);
});
test('power-up state serializes and restores without timers', () => {
  const p=playerMock(), m=new PowerUpManager({player:p}); m.collectPowerUp('sea-berry');
  const saved=JSON.parse(JSON.stringify(m.serialize())); const restored=new PowerUpManager({player:playerMock(),state:saved});
  assert.equal(restored.getActivePowerUp().id,'sea-berry'); assert.equal(restored.serialize().protectionHits,1);
});
test('power-up persists when levels change because level transitions do not clear manager state', () => {
  const m=new PowerUpManager({player:playerMock()}); m.collectPowerUp('golden-krill');
  for (let level=2; level<=5; level++) assert.equal(m.getActivePowerUp().id,'golden-krill');
});
test('Bonus Life collectible grants exactly one life and cannot be collected twice', () => {
  const l=new LifeManager({lives:3}), item={id:'bonus-1'};
  assert.deepEqual(l.collectBonusLife(item),{collected:true,amount:1,lives:4});
  assert.deepEqual(l.collectBonusLife(item),{collected:false,lives:4});
});
test('Bonus Life pickup is independent of difficulty', () => {
  for (const difficulty of ['easy','hard']) { const l=new LifeManager({lives:3}); assert.equal(l.collectBonusLife({difficulty}).lives,4); }
});
test('score grants one extra life at every 10,000 threshold, including multi-threshold awards', () => {
  const l=new LifeManager(), s=new ScoreManager({lives:l});
  assert.deepEqual(s.addScore(9999).awards,[]); assert.equal(l.getLives(),3);
  assert.deepEqual(s.addScore(1).awards,[10000]); assert.equal(l.getLives(),4);
  assert.deepEqual(s.addScore(20000).awards,[20000,30000]); assert.equal(l.getLives(),6);
});
test('milestone progress tracks remaining score to next threshold', () => {
  const s=new ScoreManager(); s.addScore(12345);
  assert.deepEqual(s.getMilestoneProgress(),{score:12345,nextThreshold:20000,remaining:7655,progress:2345,threshold:10000});
});
test('score milestone state round-trips without awarding an old threshold again', () => {
  const l=new LifeManager(), s=new ScoreManager({lives:l}); s.addScore(10000);
  const saved=JSON.parse(JSON.stringify(s.serialize())); const s2=new ScoreManager({lives:l,state:saved});
  s2.addScore(0); assert.equal(l.getLives(),4); s2.addScore(10000); assert.equal(l.getLives(),5);
});
test('starts with exactly three lives', () => { assert.equal(new LifeManager().getLives(),3); });
test('life loss above zero does not recover prematurely', () => {
  const l=new LifeManager(); assert.deepEqual(l.loseLife(),{lost:true,recovered:false,lives:2}); assert.equal(l.deathCount,0);
});
test('zero lives increments death count, clears power, restores three lives and respawns at checkpoint', () => {
  const p=playerMock(), events=new Events(), power=new PowerUpManager({player:p,events}), cp=new CheckpointManager({events});
  const l=new LifeManager({player:p,powerUps:power,checkpoints:cp,events});
  cp.activateCheckpoint({id:'reef-2',x:440,y:210,level:3}); power.collectPowerUp('golden-krill'); l.loseLife(); l.loseLife();
  const result=l.loseLife();
  assert.equal(result.recovered,true); assert.equal(result.lives,3); assert.equal(result.deathCount,1);
  assert.deepEqual([p.x,p.y],[440,210]); assert.equal(power.getActivePowerUp(),null); assert.equal(p.sizeScale,1); assert.equal(p.jumpScale,1);
});
test('zero-lives recovery falls back to level start when no checkpoint exists', () => {
  const p=playerMock(), l=new LifeManager({player:p,levelStart:{x:90,y:330}});
  l.loseLife(); l.loseLife(); const r=l.loseLife();
  assert.deepEqual([r.respawn.x,r.respawn.y],[90,330]); assert.equal(r.respawn.checkpoint,false);
});
test('recovery preserves score and progression because those managers are independent', () => {
  const p=playerMock(), l=new LifeManager({player:p}), s=new ScoreManager({lives:l}), g=new ProgressionManager({totalLevels:4});
  s.addScore(4321); g.completeLevel({level:1}); l.loseLife(); l.loseLife(); l.loseLife();
  assert.equal(s.getScore(),4321); assert.ok(g.unlockedLevels.includes(2)); assert.equal(l.deathCount,1);
});
test('checkpoint stores world coordinates and serializes', () => {
  const c=new CheckpointManager(); c.activateCheckpoint({id:'c1',x:1234,y:250,level:2});
  const restored=new CheckpointManager({state:JSON.parse(JSON.stringify(c.serialize()))});
  assert.deepEqual(restored.getRespawnPosition({x:1,y:1}),{x:1234,y:250,checkpoint:true,id:'c1'});
});
test('Easy and Hard completions maintain separate records and unlock next level', () => {
  const p=new ProgressionManager({totalLevels:5});
  p.completeLevel({level:1,difficulty:'easy',score:2000,time:80});
  p.completeLevel({level:1,difficulty:'hard',score:3000,time:70});
  const state=p.getProgressionState();
  assert.equal(state.records.easy[1].bestScore,2000); assert.equal(state.records.hard[1].bestScore,3000);
  assert.ok(state.unlockedLevels.includes(2)); assert.deepEqual(state.completedLevels[1],{easy:true,hard:true});
});
test('Hard completion grants permanent Gold; later Easy completion does not remove it', () => {
  const p=new ProgressionManager({totalLevels:3});
  p.completeLevel({level:1,difficulty:'hard'}); p.completeLevel({level:1,difficulty:'easy'});
  assert.deepEqual(p.goldLevels,[1]);
});
test('boss unlocks are granted by configured level milestones and defeat is tracked', () => {
  const p=new ProgressionManager({totalLevels:3,bossUnlocks:{2:['reef-guardian','abyss-king']}});
  p.completeLevel({level:2,difficulty:'easy'}); assert.deepEqual(p.unlockedBosses,['reef-guardian','abyss-king']);
  p.defeatBoss('reef-guardian'); assert.deepEqual(p.defeatedBosses,['reef-guardian']);
  assert.throws(()=>p.defeatBoss('locked-boss'));
});
test('orcalord unlocks permanently after every level has a Hard completion', () => {
  const p=new ProgressionManager({totalLevels:3});
  p.completeLevel({level:1,difficulty:'hard'}); p.completeLevel({level:2,difficulty:'hard'});
  assert.equal(p.orcalordUnlocked,false); p.completeLevel({level:3,difficulty:'hard'});
  assert.equal(p.orcalordUnlocked,true);
});
test('unlockAllLevels unlocks every configured level without altering completion records', () => {
  const p=new ProgressionManager({totalLevels:6}); p.completeLevel({level:1});
  assert.deepEqual(p.unlockAllLevels(),[3,4,5,6]); assert.deepEqual(p.unlockedLevels,[1,2,3,4,5,6]);
  assert.deepEqual(p.completedLevels[1],{easy:true,hard:false});
});
test('progression serialization retains records, gold, bosses and orcalord unlock', () => {
  const p=new ProgressionManager({totalLevels:2,bossUnlocks:{1:'boss-a'}});
  p.completeLevel({level:1,difficulty:'hard'}); p.completeLevel({level:2,difficulty:'hard'});
  const q=new ProgressionManager({state:JSON.parse(JSON.stringify(p.serialize()))});
  assert.deepEqual(q.goldLevels,[1,2]); assert.deepEqual(q.unlockedBosses,['boss-a']); assert.equal(q.orcalordUnlocked,true);
});
test('difficulty can only change at completion or all-lives-lost boundary', () => {
  const p=new ProgressionManager(); assert.throws(()=>p.setDifficulty('hard'));
  assert.equal(p.setDifficulty('hard',{reason:'level-complete'}),'hard');
  assert.equal(p.setDifficulty('easy',{reason:'all-lives-lost'}),'easy');
});
test('completion and collection emit integration events', () => {
  const e=new Events(), l=new LifeManager({events:e}), s=new ScoreManager({lives:l,events:e}), p=new ProgressionManager({events:e,totalLevels:2});
  l.collectBonusLife({id:'bonus'}); s.addScore(10000); p.completeLevel({level:1});
  const names=e.emitted.map(x=>x.name);
  for (const name of ['bonusLife.collected','life.scoreMilestone','score.changed','level.completed']) assert.ok(names.includes(name),name);
});

test('Agent 2 player.protectionConsumed event clears progression power-up slot', () => {
  const events=new Events(), p=playerMock(), manager=new PowerUpManager({player:p,events});
  manager.collectPowerUp('sea-berry');
  events.emit('player.protectionConsumed',{powerUp:'Sea Berry',remaining:0});
  assert.equal(manager.getActivePowerUp(),null);
});
test('locked levels cannot be selected before progression unlocks them', () => {
  const p=new ProgressionManager({totalLevels:3});
  assert.throws(()=>p.setCurrentLevel(2));
  p.completeLevel({level:1}); assert.equal(p.setCurrentLevel(2),2);
});
test('life state round-trips the persistent death count', () => {
  const p=playerMock(), l=new LifeManager({player:p});
  l.loseLife(); l.loseLife(); l.loseLife();
  const restored=new LifeManager({player:playerMock(),state:JSON.parse(JSON.stringify(l.serialize()))});
  assert.equal(restored.deathCount,1); assert.equal(restored.getLives(),3);
});
