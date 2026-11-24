import { GAME_CONFIG } from '../game-config.js';
import { Orca } from '../player/index.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLOUR_HEX = { classic:'#101820', midnight:'#142d50', teal:'#075b62', rose:'#553448', gold:'#56451b' };
const VICTORY_BY_LEVEL = ['tail slap','barrel roll','leap/splash','treasure chest spin','bubble-ring trick','tail flip','spiral swim','somersault','big tail splash','kelp weave','spinning dash','jump through bubbles','ice arch slide','double flip','grand victory leap'];

/** DOM-only UI adapter. It owns presentation and input forwarding, never gameplay simulation. */
export class UIManager {
  constructor({ root, runtime, onStartLevel = null, onMainMenu = null, onInput = null } = {}) {
    if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('UIManager requires a DOM root element');
    if (!runtime) throw new TypeError('UIManager requires the composed game runtime');
    this.root = root; this.runtime = runtime; this.onStartLevel = onStartLevel; this.onMainMenu = onMainMenu; this.onInput = onInput;
    this.input = { left:false, right:false, jump:false, shoot:false, dropThrough:false };
    this.screen = 'menu'; this._click = e => this.#handleClick(e); this._change = e => this.#handleChange(e); this._pointerDown = e => this.#handlePointer(e, true); this._pointerUp = e => this.#handlePointer(e, false);
    root.addEventListener('click', this._click); root.addEventListener('change', this._change);
    root.addEventListener('pointerdown', this._pointerDown); root.addEventListener('pointerup', this._pointerUp); root.addEventListener('pointercancel', this._pointerUp); root.addEventListener('lostpointercapture', this._pointerUp);
    this.#installStyles();
  }

  #installStyles() {
    if (typeof document === 'undefined' || document.getElementById('orca-ui-styles') || document.querySelector('style[data-orca-inline-styles]')) return;
    const link = document.createElement('link'); link.id = 'orca-ui-styles'; link.rel = 'stylesheet'; link.href = new URL('./ui.css', import.meta.url).href; document.head.append(link);
  }
  #shell(title, body, subtitle='') {
    this.screen = title.toLowerCase().replace(/[^a-z]+/g,'-');
    this.root.innerHTML = `<section class="orca-ui" aria-live="polite"><header class="orca-top"><div class="orca-mark">◈ ORCA ADVENTURE</div><div class="orca-sub">${esc(subtitle)}</div></header><main class="orca-panel"><h1>${esc(title)}</h1>${body}</main><footer class="orca-foot">THE DEEP IS CALLING <span>◆ ◆ ◆</span></footer></section>`;
    return this.root;
  }
  #button(label, action, extra='') { return `<button type="button" class="orca-btn ${extra}" data-action="${esc(action)}">${esc(label)}</button>`; }
  #state() { return this.runtime.progression.getProgressionState(); }
  showMainMenu() {
    return this.#shell('Orca Adventure', `<p class="orca-lead">A pixel-deep journey across five underwater worlds.</p><div class="orca-actions">${this.#button('Start Adventure','setup','primary')}${this.#button('World Map','map')}${this.#button('Load Save','load')}${this.#button('Save Game','save')}${this.#button('Settings','settings')}</div><p class="orca-hint">Keyboard: arrows / A-D · Space: jump · X: shoot · S: drop through</p>`,'MAIN MENU');
  }
  showCharacterSetup({ name = this.runtime.player.name, colour = this.runtime.player.color, difficulty = this.#state().difficulty } = {}) {
    const colors = GAME_CONFIG.playerColours.map(c => `<option value="${c}" ${c===colour?'selected':''}>${c[0].toUpperCase()+c.slice(1)}</option>`).join('');
    const result = this.#shell('Choose Your Orca', `<div class="orca-setup"><div class="orca-preview"><canvas data-preview width="240" height="150" aria-label="Orca character preview"></canvas><strong>YOUR DEEP-SEA PARTNER</strong></div><form data-form="setup" class="orca-form"><label>Player name<input name="name" maxlength="24" required value="${esc(name)}"></label><label>Colour<select name="colour">${colors}</select></label><label>Difficulty<select name="difficulty"><option value="easy" ${difficulty==='easy'?'selected':''}>Easy</option><option value="hard" ${difficulty==='hard'?'selected':''}>Hard</option></select></label><div class="orca-actions">${this.#button('Continue','begin','primary')}${this.#button('Back','menu')}</div></form></div>`,'CHARACTER SETUP');
    this.#drawPreview(result.querySelector('[data-preview]'), colour); return result;
  }
  #drawPreview(canvas, colour='classic') { if(!canvas)return; const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#0a5970'; ctx.fillRect(0,0,canvas.width,canvas.height); for(let i=0;i<8;i++){ctx.fillStyle='rgba(180,245,255,.22)';ctx.fillRect((i*37+13)%230,(i*23+8)%140,3,3);} const preview=new Orca({x:87,y:55,name:'Preview',color:colour}); preview.render(ctx,0); }
  showWorldMap() {
    const p = this.#state(); const completed = p.completedLevels ?? {}; const unlocked = new Set(p.unlockedLevels ?? [1]); const gold = new Set(p.goldLevels ?? []);
    let route = '', nodes = '';
    const coords = Array.from({length:15},(_,i)=>({x:55+(i%3)*135+(Math.floor(i/3)%2?24:0),y:55+Math.floor(i/3)*88}));
    route = coords.map((c,i)=>i?`L ${c.x} ${c.y}`:`M ${c.x} ${c.y}`).join(' ');
    const worlds = GAME_CONFIG.worlds;
    worlds.forEach((world, wi) => {
      nodes += `<div class="orca-world-label" style="--world-row:${wi}">${esc(world.name)}</div>`;
      world.levels.forEach(level => {
        const c=coords[level-1], done=completed[level] ?? completed[String(level)] ?? {}, status=gold.has(level)||done.hard?'gold':done.easy?'green':unlocked.has(level)?'available':'locked';
        nodes += `<button type="button" class="map-node ${status}" style="left:${c.x/510*100}%;top:${c.y/490*100}%" data-action="level" data-level="${level}" ${status==='locked'?'disabled':''} aria-label="Level ${level}, ${status}"><b>${String(level).padStart(2,'0')}</b></button>`;
      });
      const bossLevel=world.levels[2], c=coords[bossLevel-1], bossId=world.bossId, bossOpen=(p.unlockedBosses??[]).includes(bossId), bossDone=(p.defeatedBosses??[]).includes(bossId);
      nodes += `<span class="map-boss ${bossDone?'defeated':bossOpen?'open':'locked'}" style="left:${Math.min(94,c.x/510*100+9)}%;top:${c.y/490*100+2}%" title="${esc(bossId)}">♛</span>`;
    });
    const legend = `<div class="map-legend"><span><i class="gold"></i> Hard complete</span><span><i class="green"></i> Easy complete</span><span><i class="available"></i> Available</span><span><i class="locked"></i> Locked</span></div>`;
    const cheat = p.orcalordUnlocked ? `<p class="orca-cheat">ORCALORD ACCESS UNLOCKED</p>` : '';
    return this.#shell('World Map', `<p class="orca-lead">Follow the connected route through all five worlds.</p><div class="orca-map"><svg viewBox="0 0 510 490" preserveAspectRatio="none" aria-hidden="true"><path d="${route}"/></svg>${nodes}</div>${legend}${cheat}<div class="orca-actions">${this.#button('Return','menu')}</div>`,'15 LEVELS · 5 BOSSES');
  }
  updateHUD(data = {}) {
    const state = this.runtime.state, prog = this.#state(), milestone = this.runtime.score.getMilestoneProgress();
    const level = data.level ?? prog.currentLevel, world = data.world ?? GAME_CONFIG.worlds.find(w=>w.levels.includes(level))?.name ?? 'Unknown';
    const active = this.runtime.powerUps.getActivePowerUp();
    const fields = [ ['PLAYER',data.playerName??this.runtime.player.name],['WORLD',world],['LEVEL',`${level}/15`],['MODE',(data.difficulty??prog.difficulty).toUpperCase()],['LIVES',this.runtime.lives.getLives()],['SCORE',this.runtime.score.getScore().toLocaleString()],['NEXT LIFE',`${milestone.remaining.toLocaleString()} pts`],['DEATHS',this.runtime.lives.deathCount ?? state.player.deathCount ?? 0],['POWER-UP',active?.name??'None'],['BOSS',data.bossHealth==null?'—':`${Math.max(0,Math.round(data.bossHealth))}%`]];
    const bar = Math.max(0,Math.min(100,milestone.progress/milestone.threshold*100));
    this.root.querySelector('[data-hud]')?.remove();
    const html=fields.map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b>${k==='NEXT LIFE'?`<i style="--progress:${bar}%"></i>`:''}</div>`).join('');
    if (typeof document === 'undefined') return { className:'orca-hud', innerHTML:html, dataset:{hud:''} };
    const hud=document.createElement('aside'); hud.className='orca-hud'; hud.dataset.hud=''; hud.innerHTML=html;
    this.root.querySelector('.orca-ui')?.prepend(hud); return hud;
  }
  showGameplay({ level=1, world='' }={}) { const result=this.#shell('Dive in Progress', `<div class="orca-game-status" data-hud></div><div class="orca-actions">${this.#button('Pause','pause')}</div>`,'GAMEPLAY'); this.updateHUD({level,world}); this.mountMobileControls(); return result; }
  showPauseMenu() { this.runtime.state.gameplay.paused=true; this.runtime.audio?.pauseAudio?.(); return this.#shell('Paused', `<p class="orca-lead">The current dive is suspended.</p><div class="orca-actions">${this.#button('Resume','resume','primary')}${this.#button('World Map','map')}${this.#button('Settings','settings')}${this.#button('Save Game','save')}${this.#button('Main Menu','menu')}</div>`,'PAUSE'); }
  showSettings() { const a=this.runtime.audio; return this.#shell('Settings', `<div class="orca-form"><label class="orca-toggle">Music <input type="checkbox" name="music" ${a?.musicEnabled!==false?'checked':''}></label><label class="orca-toggle">Sound effects <input type="checkbox" name="sound" ${a?.soundEnabled!==false?'checked':''}></label><div class="orca-actions">${this.#button('Back','menu')}</div></div>`,'AUDIO & ACCESSIBILITY'); }
  showVictory({ level=this.#state().currentLevel, animation=null, playerName=this.runtime.player.name }={}) { const chosen=animation??VICTORY_BY_LEVEL[(level-1)%VICTORY_BY_LEVEL.length]; this.runtime.player.triggerVictoryAnimation(chosen); return this.#shell('Level Complete', `<p class="orca-lead">${esc(playerName)} cleared level ${level}.</p><p class="orca-animation">Animation running: <strong>${esc(chosen)}</strong></p><div class="orca-actions">${this.#button('World Map','map')}${this.#button('Continue','continue','primary')}</div>`,'VICTORY'); }
  showBossVictory({ bossId='boss', level=this.#state().currentLevel, playerName=this.runtime.player.name, animation=null }={}) { const chosen=animation??VICTORY_BY_LEVEL[(level-1)%15]; this.runtime.player.triggerVictoryAnimation(chosen); const root=this.#shell('Boss Defeated', `<p class="orca-lead">${esc(playerName)} defeated ${esc(bossId)}.</p><p class="orca-animation">Animation running: <strong>${esc(chosen)}</strong></p>${this.#button('World Map','map')}`,'BOSS VICTORY'); return root; }
  showFinalEnding({ playerName=this.runtime.player.name }={}) { this.runtime.player.triggerVictoryAnimation('grand victory leap',4); return this.#shell('Guardian of the Abyss', `<p class="orca-lead">${esc(playerName)}, the five worlds are safe. Your journey becomes legend.</p><div class="orca-actions">${this.#button('World Map','map')}${this.#button('Main Menu','menu')}</div>`,'THE FINAL ENDING'); }
  showRecoveryScreen({ difficulty=this.#state().difficulty }={}) { return this.#shell('Back to the Current', `<p class="orca-lead">Your orca has recovered. Your score and progress are preserved.</p><div class="orca-form"><label>Difficulty<select name="recoveryDifficulty"><option value="easy" ${difficulty==='easy'?'selected':''}>Easy</option><option value="hard" ${difficulty==='hard'?'selected':''}>Hard</option></select></label>${this.#button('Resume Dive','recover','primary')}${this.#button('World Map','map')}</div>`,'RECOVERY'); }
  showLoadSave() { return this.#shell('Load Save', `<div class="orca-form"><label>Choose JSON save<input type="file" accept="application/json,.json" data-save-file></label><p class="orca-hint" data-save-message>Choose a save file to validate and load it.</p>${this.#button('Back','menu')}</div>`,'PORTABLE SAVE'); }
  showMobileControls() { return `<nav class="orca-mobile-controls" aria-label="Touch controls">${[['left','◀'],['right','▶'],['jump','JUMP'],['shoot','SHOOT'],['dropThrough','DROP']].map(([k,l])=>`<button type="button" data-control="${k}">${l}</button>`).join('')}</nav>`; }
  #handleClick(e) {
    const b=e.target.closest('[data-action]'); if(!b) return; const a=b.dataset.action;
    if(a==='menu'){this.runtime.state.gameplay.paused=false;this.onMainMenu?.();this.showMainMenu();}
    else if(a==='setup') this.showCharacterSetup();
    else if(a==='map') this.showWorldMap();
    else if(a==='settings') this.showSettings();
    else if(a==='load') this.showLoadSave();
    else if(a==='save'){try{this.runtime.saves.downloadSave();}catch(error){this.#shell('Save Failed',`<p class="orca-lead">${esc(error.message)}</p>${this.#button('Back','menu')}`,'SAVE ERROR');}}
    else if(a==='pause') this.showPauseMenu();
    else if(a==='resume'){this.runtime.state.gameplay.paused=false;this.runtime.audio?.resumeAudio?.();this.onInput?.({type:'resume'});}
    else if(a==='begin') this.#submitSetup();
    else if(a==='level'){const level=Number(b.dataset.level);this.runtime.progression.setCurrentLevel(level);this.onStartLevel?.(level);this.onInput?.({type:'startLevel',level});}
    else if(a==='continue'){const level=this.#state().currentLevel;this.onStartLevel?.(level);}
    else if(a==='recover'){const d=this.root.querySelector('[name="recoveryDifficulty"]')?.value;if(d!==this.#state().difficulty)this.runtime.progression.setDifficulty(d,{reason:'all-lives-lost'});this.runtime.state.gameplay.paused=false;this.onInput?.({type:'recover'});}
    else if(a==='boss-celebrate') this.runtime.player.triggerVictoryAnimation(b.dataset.animation??'grand victory leap');
  }
  #submitSetup(){const f=this.root.querySelector('[data-form="setup"]');if(!f?.reportValidity())return;const fd=new FormData(f), name=String(fd.get('name')).trim(), colour=String(fd.get('colour')), difficulty=String(fd.get('difficulty'));this.runtime.player.customize({name,color:colour});if(difficulty!==this.#state().difficulty)this.runtime.progression.setDifficulty(difficulty,{reason:'initialization'});this.runtime.state.player.name=name;this.runtime.state.player.color=colour;this.onInput?.({type:'profile',name,colour,difficulty});this.showWorldMap();}
  #handleChange(e){if(e.target.name==='colour')this.#drawPreview(this.root.querySelector('[data-preview]'),e.target.value);if(e.target.name==='music')this.runtime.audio?.setMusicEnabled(e.target.checked);if(e.target.name==='sound')this.runtime.audio?.setSoundEnabled(e.target.checked);if(e.target.matches('[data-save-file]'))this.#loadFile(e.target.files?.[0]);}
  async #loadFile(file){if(!file)return;const message=this.root.querySelector('[data-save-message]');try{const result=await this.runtime.saves.loadSave(file);if(!result?.loaded)throw new Error(result?.errors?.join('; ')??'Save could not be loaded');if(this.runtime.world?.level){if(this.runtime.state.gameplay.paused)this.showPauseMenu();else this.showGameplay({level:this.runtime.world.level.number,world:this.runtime.world.level.world.name});}else this.showWorldMap();}catch(error){if(message)message.textContent=`Save rejected: ${error.message}`;}}
  #handlePointer(e,down){const button=e.target.closest?.('[data-control]');if(down){if(!button)return;e.preventDefault();const key=button.dataset.control;this._activeControl={key,button,pointerId:e.pointerId};button.setPointerCapture?.(e.pointerId);this.input[key]=true;button.classList.add('pressed');this.onInput?.({type:'control',control:key,pressed:true});return;}if(!this._activeControl)return;const active=this._activeControl;this._activeControl=null;this.input[active.key]=false;active.button.classList.remove('pressed');this.onInput?.({type:'control',control:active.key,pressed:false});}
  mountMobileControls(){this.root.insertAdjacentHTML('beforeend',this.showMobileControls());return this.root.querySelector('.orca-mobile-controls');}
  dispose(){this.root.removeEventListener('click',this._click);this.root.removeEventListener('change',this._change);this.root.removeEventListener('pointerdown',this._pointerDown);this.root.removeEventListener('pointerup',this._pointerUp);this.root.removeEventListener('pointercancel',this._pointerUp);this.root.removeEventListener('lostpointercapture',this._pointerUp);this.root.replaceChildren();}
}

export const createUIManager = options => new UIManager(options);
