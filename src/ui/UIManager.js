import { GAME_CONFIG } from '../game-config.js';
import { Orca } from '../player/index.js';
import { BOSS_DEFS } from '../enemies/bosses.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const COLOUR_HEX = { classic:'#101820', midnight:'#142d50', teal:'#075b62', rose:'#553448', gold:'#56451b' };
const VICTORY_BY_LEVEL = ['tail slap','barrel roll','leap/splash','treasure chest spin','bubble-ring trick','tail flip','spiral swim','somersault','big tail splash','kelp weave','spinning dash','jump through bubbles','ice arch slide','double flip','grand victory leap'];

/** DOM-only UI adapter. It owns presentation and input forwarding, never gameplay simulation. */
export class UIManager {
  constructor({ root, runtime, onStartLevel = null, onMainMenu = null, onInput = null } = {}) {
    if (!root || typeof root.replaceChildren !== 'function') throw new TypeError('UIManager requires a DOM root element');
    if (!runtime) throw new TypeError('UIManager requires the composed game runtime');
    this.root = root; this.runtime = runtime; this.onStartLevel = onStartLevel; this.onMainMenu = onMainMenu; this.onInput = onInput;
    this.input = { left:false, right:false, jump:false, shoot:false, dropThrough:false }; this.characterType = runtime.player.characterType ?? 'orca';
    this._activePointers = new Map();
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
    this.#stopPreview();
    this.screen = title.toLowerCase().replace(/[^a-z]+/g,'-');
    this.root.innerHTML = `<section class="orca-ui"><header class="orca-top"><div class="orca-mark">◈ ORCA ADVENTURE</div><div class="orca-sub">${esc(subtitle)}</div></header><main class="orca-panel"><h1 tabindex="-1" aria-live="polite">${esc(title)}</h1>${body}</main><footer class="orca-foot">THE DEEP IS CALLING <span>◆ ◆ ◆</span></footer></section>`;
    this.root.querySelector('.orca-panel h1')?.focus?.({ preventScroll: true });
    return this.root;
  }
  #button(label, action, extra='') { return `<button type="button" class="orca-btn ${extra}" data-action="${esc(action)}">${esc(label)}</button>`; }
  #state() { return this.runtime.progression.getProgressionState(); }
  showMainMenu() {
    return this.#shell('Orca Adventure', `<p class="orca-lead">A pixel-deep journey across five underwater worlds.</p><div class="orca-actions">${this.#button('Start Adventure','setup','primary')}${this.#button('World Map','map')}${this.#button('Load Save','load')}${this.#button('Save Game','save')}${this.#button('Settings','settings')}</div><p class="orca-hint">Keyboard: arrows / A-D · Space: jump · X: shoot · S: drop through</p>`,'MAIN MENU');
  }
  showCharacterSetup({ name = this.runtime.player.name, colour = this.runtime.player.color, difficulty = this.#state().difficulty, characterType = this.runtime.player.characterType ?? 'orca' } = {}) {
    const colors = GAME_CONFIG.playerColours.map(c => `<option value="${c}" ${c===colour?'selected':''}>${c[0].toUpperCase()+c.slice(1)}</option>`).join('');
    const characters = GAME_CONFIG.playableCharacters.map(ch => `<option value="${ch.id}" ${ch.id===characterType?'selected':''}>${esc(ch.name)} — ${esc(ch.description)}</option>`).join('');
    const result = this.#shell('Choose Your Character', `<div class="orca-setup"><div class="orca-preview"><canvas data-preview width="240" height="150" aria-label="Selected character animated preview"></canvas><strong data-character-caption>YOUR DEEP-SEA PARTNER</strong></div><form data-form="setup" class="orca-form"><label>Character<select name="characterType">${characters}</select></label><label>Player name<input name="name" maxlength="24" required value="${esc(name)}"></label><label>Colour / Accent<select name="colour">${colors}</select></label><label>Difficulty<select name="difficulty"><option value="easy" ${difficulty==='easy'?'selected':''}>Easy</option><option value="hard" ${difficulty==='hard'?'selected':''}>Hard</option></select></label><div class="orca-actions">${this.#button('Continue','begin','primary')}${this.#button('Back','menu')}</div></form></div>`,'CHARACTER SELECTION');
    this.characterType=characterType;
    this.#drawPreview(result.querySelector('[data-preview]'), colour, characterType);
    return result;
  }
  #stopPreview(){if(this._previewFrame!==undefined&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(this._previewFrame);this._previewFrame=undefined;this._previewPlayer=null;}
  #drawPreview(canvas, colour='classic', characterType=this.characterType??'orca') { if(!canvas)return; this.#stopPreview(); const ctx=canvas.getContext('2d'); const preview=new Orca({x:87,y:55,name:'Preview',color:colour,characterType}); preview.animationState='swim'; this._previewPlayer=preview; const draw=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#0a5970';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<8;i++){ctx.fillStyle='rgba(180,245,255,.22)';ctx.fillRect((i*37+13)%230,(i*23+8)%140,3,3);}preview.render(ctx,0);};draw();if(typeof requestAnimationFrame==='function'){let previous=0;const animate=now=>{if(!this._previewPlayer||this._previewPlayer!==preview)return;const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;preview.animation.update(dt);draw();this._previewFrame=requestAnimationFrame(animate);};this._previewFrame=requestAnimationFrame(animate);} }
  showWorldMap() {
    const p=this.#state(), completed=p.completedLevels??{}, unlocked=new Set(p.unlockedLevels??[1]), gold=new Set(p.goldLevels??[]);
    const worlds=GAME_CONFIG.worlds, coords=[], routeParts=[]; let nodes='', totalDone=0, totalGold=0;
    worlds.forEach((world,wi)=>{
      const y=58+wi*91, regionTop=wi*20;
      nodes+=`<div class="map-region" style="top:${regionTop}%;--region-index:${wi}"></div><div class="orca-world-label" style="--world-row:${wi}"><span>WORLD 0${wi+1}</span><b>${esc(world.name)}</b></div>`;
      world.levels.forEach((level,li)=>{
        const c={x:76+li*128,y}; coords[level-1]=c;
        const done=completed[level]??completed[String(level)]??{}, isGold=gold.has(level)||!!done.hard, isGreen=!!done.easy;
        const status=isGold?'gold':isGreen?'green':unlocked.has(level)?'available':'locked';
        if(isGold||isGreen)totalDone++; if(isGold)totalGold++;
        nodes+=`<button type="button" class="map-node ${status}" style="left:${c.x/510*100}%;top:${c.y/490*100}%" data-action="level" data-level="${level}" ${status==='locked'?'disabled':''} aria-label="Level ${level}, ${status}"><b>${String(level).padStart(2,'0')}</b><small>${status==='gold'?'GOLD':status==='green'?'CLEAR':status==='available'?'DIVE':'LOCKED'}</small></button>`;
      });
      const bossLevel=world.levels[2],c=coords[bossLevel-1],bossId=world.bossId,bossOpen=(p.unlockedBosses??[]).includes(bossId),bossDone=(p.defeatedBosses??[]).includes(bossId);
      nodes+=`<div class="boss-marker-wrap" style="left:88%;top:${c.y/490*100}%" title="${esc(BOSS_DEFS[bossId]?.name ?? bossId)}"><span class="map-boss ${bossDone?'defeated':bossOpen?'open':'locked'}">${bossDone?'✦':'♛'}</span><small>BOSS</small></div>`;
    });
    const allCoords=worlds.flatMap(w=>w.levels.map(level=>coords[level-1]));
    const route=allCoords.map((c,i)=>i?`L ${c.x} ${c.y}`:`M ${c.x} ${c.y}`).join(' ');
    const legend=`<div class="map-legend"><span><i class="gold"></i> Hard / Gold</span><span><i class="green"></i> Easy cleared</span><span><i class="available"></i> Ready</span><span><i class="locked"></i> Locked</span><span><i class="boss-key">♛</i> World boss</span></div>`;
    const cheat=p.orcalordUnlocked?`<p class="orca-cheat">ORCALORD ACCESS UNLOCKED</p>`:'';
    const progress=Math.round(totalDone/15*100);
    return this.#shell('World Map',`<div class="map-intro"><p class="orca-lead">Chart your route through five regions of the deep. Clear levels, earn Gold, and face each world guardian.</p><div class="map-progress"><div><b>${totalDone}/15</b><small>LEVELS CLEARED</small></div><div><b>${totalGold}</b><small>GOLD CLEAR</small></div><div><b>5</b><small>WORLD BOSSES</small></div><div class="map-progress-bar"><i style="--progress:${progress}%"></i></div></div></div><div class="orca-map map-atlas"><div class="map-grid" aria-hidden="true"></div><svg viewBox="0 0 510 490" preserveAspectRatio="none" aria-hidden="true"><path class="map-route-shadow" d="${route}"/><path class="map-route" d="${route}"/></svg>${nodes}<div class="map-compass" aria-hidden="true">N<br>✧</div><div class="map-depth" aria-hidden="true">ABYSSAL EXPEDITION · 00–5000m</div></div>${legend}${cheat}<div class="orca-actions">${this.#button('Return','menu')}</div>`,'EXPEDITION ATLAS · 15 LEVELS · 5 BOSSES');
  }
  updateHUD(data = {}) {
    const state = this.runtime.state, prog = this.#state(), milestone = this.runtime.score.getMilestoneProgress();
    const level = data.level ?? prog.currentLevel, world = data.world ?? GAME_CONFIG.worlds.find(w=>w.levels.includes(level))?.name ?? 'Unknown';
    const active = this.runtime.powerUps.getActivePowerUp();
    const fields = [ ['PLAYER',data.playerName??this.runtime.player.name],['WORLD',world],['LEVEL',`${level}/15`],['MODE',(data.difficulty??prog.difficulty).toUpperCase()],['LIVES',this.runtime.lives.getLives()],['SCORE',this.runtime.score.getScore().toLocaleString()],['NEXT LIFE',`${milestone.remaining.toLocaleString()} pts`],['DEATHS',this.runtime.lives.deathCount ?? state.player.deathCount ?? 0],['POWER-UP',active?.name??'None'],['BOSS',data.bossHealth==null?'—':`${Math.max(0,Math.round(data.bossHealth))}%`]];
    const bar = Math.max(0,Math.min(100,milestone.progress/milestone.threshold*100));
    this.root.querySelector('[data-hud]')?.remove();
    const html=fields.map(([k,v])=>`<div class="${k==='BOSS'&&data.bossHealth!=null?'hud-boss':''}"><small>${esc(k)}</small><b>${esc(v)}</b>${k==='NEXT LIFE'?`<i style="--progress:${bar}%"></i>`:''}${k==='BOSS'&&data.bossHealth!=null?`<i class="boss-health-fill" style="--progress:${Math.max(0,Math.min(100,data.bossHealth))}%"></i>`:''}</div>`).join('');
    if (typeof document === 'undefined') return { className:'orca-hud', innerHTML:html, dataset:{hud:''} };
    const hud=document.createElement('aside'); hud.className='orca-hud'; hud.dataset.hud=''; hud.setAttribute('role','group'); hud.setAttribute('aria-label','Game status'); hud.innerHTML=html;
    this.root.querySelector('.orca-ui')?.prepend(hud); return hud;
  }
  showGameplay({ level=1, world='' }={}) { const result=this.#shell('Dive in Progress', `<div class="orca-game-status" data-hud></div><div class="orca-actions">${this.#button('Badges / Profile','profile')}${this.#button('Pause','pause')}</div>`,'GAMEPLAY'); this.updateHUD({level,world}); this.mountMobileControls(); return result; }
  showProfile({ returnToDive = true } = {}) { const owned=new Set(this.runtime.profile?.badges??[]); const worlds=GAME_CONFIG.worlds; const cards=Array.from({length:15},(_,i)=>{const level=i+1,world=worlds[Math.floor(i/3)],got=owned.has(level),name=['Coral Crest','Reef Pearl','Tide Emblem','Kelp Knot','Green Current','Forest Seal','Frost Shard','Glacier Star','Ice Crown','Ruins Glyph','Ancient Coin','Temple Sigil','Abyss Gem','Void Mark','Deep Guardian'][i],colours=['#ff8a5b','#64d9c2','#a18bff','#ffdb68','#6cc8ff'];return `<article class="badge-card ${got?'earned':'locked'}"><div class="badge-art" style="--badge-colour:${colours[i%colours.length]}"><span>${got?'✦':'?'}</span><small>${String(level).padStart(2,'0')}</small></div><b>${esc(name)}</b><small>LEVEL ${level} · ${esc(world.name)}</small><strong>${got?'COLLECTED':'UNDISCOVERED'}</strong></article>`}).join(''); return this.#shell('Player Profile & Badge Collection',`<p class="orca-lead">Collect the unique badge hidden in every level. ${owned.size}/15 collected.</p><div class="badge-grid">${cards}</div><div class="orca-actions">${this.#button(returnToDive?'Return to Dive':'World Map',returnToDive?'profile-back':'map')}</div>`,'PERSONAL COLLECTION'); }
  showPauseMenu() { this.runtime.state.gameplay.paused=true; this.runtime.audio?.pauseAudio?.(); return this.#shell('Paused', `<p class="orca-lead">The current dive is suspended.</p><div class="orca-actions">${this.#button('Resume','resume','primary')}${this.#button('World Map','map')}${this.#button('Settings','settings')}${this.#button('Save Game','save')}${this.#button('Main Menu','menu')}</div>`,'PAUSE'); }
  showSettings() { const a=this.runtime.audio; return this.#shell('Settings', `<div class="orca-form"><label class="orca-toggle">Music <input type="checkbox" name="music" ${a?.musicEnabled!==false?'checked':''}></label><label class="orca-toggle">Sound effects <input type="checkbox" name="sound" ${a?.soundEnabled!==false?'checked':''}></label><div class="orca-actions">${this.#button('Back','back')}</div></div>`,'AUDIO & ACCESSIBILITY'); }
  #drawVictoryPreview(canvas, animation, duration=2.8) { if(!canvas || typeof requestAnimationFrame!=='function')return; const ctx=canvas.getContext('2d'); const player=new Orca({x:canvas.width/2-33,y:canvas.height/2-22,name:this.runtime.player.name,color:this.runtime.player.color,characterType:this.runtime.player.characterType}); player.triggerVictoryAnimation(animation,duration); this._previewPlayer=player; let previous=0; const draw=now=>{if(this._previewPlayer!==player)return;const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;player.animation.update(dt);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#07334d';ctx.fillRect(0,0,canvas.width,canvas.height);for(let i=0;i<10;i++){ctx.fillStyle='rgba(180,245,255,.25)';ctx.beginPath();ctx.arc((i*31+now*.015)%canvas.width,(i*19+now*.01)%canvas.height,2+i%3,0,Math.PI*2);ctx.fill();}player.render(ctx,0);this._previewFrame=requestAnimationFrame(draw);};this._previewFrame=requestAnimationFrame(draw); }
  showVictory({ level=this.#state().currentLevel, animation=null, playerName=this.runtime.player.name }={}) { const chosen=animation??VICTORY_BY_LEVEL[(level-1)%VICTORY_BY_LEVEL.length]; this.runtime.player.triggerVictoryAnimation(chosen); const root=this.#shell('Level Complete', `<p class="orca-lead">${esc(playerName)} cleared level ${level}.</p><canvas class="orca-victory-preview" data-victory-preview width="320" height="160" aria-label="${esc(chosen)} victory animation"></canvas><div class="orca-actions">${this.#button('World Map','map')}${this.#button('Continue','continue','primary')}</div>`,'VICTORY'); this.#drawVictoryPreview(root.querySelector('[data-victory-preview]'),chosen); return root; }
  showBossVictory({ bossId='boss', level=this.#state().currentLevel, playerName=this.runtime.player.name, animation=null }={}) { const chosen=animation??VICTORY_BY_LEVEL[(level-1)%15], bossName=BOSS_DEFS[bossId]?.name ?? bossId; this.runtime.player.triggerVictoryAnimation(chosen); const root=this.#shell('Boss Defeated', `<p class="orca-lead">${esc(playerName)} defeated ${esc(bossName)}.</p><canvas class="orca-victory-preview" data-victory-preview width="320" height="160" aria-label="${esc(chosen)} victory animation"></canvas>${this.#button('World Map','map')}`,'BOSS VICTORY'); this.#drawVictoryPreview(root.querySelector('[data-victory-preview]'),chosen); return root; }
  showFinalEnding({ playerName=this.runtime.player.name }={}) { this.runtime.player.triggerVictoryAnimation('grand victory leap',4); const root=this.#shell('Guardian of the Abyss', `<p class="orca-lead">${esc(playerName)}, the five worlds are safe. Your journey becomes legend.</p><canvas class="orca-victory-preview" data-victory-preview width="320" height="160" aria-label="Grand victory leap"></canvas><div class="orca-actions">${this.#button('World Map','map')}${this.#button('Main Menu','menu')}</div>`,'THE FINAL ENDING'); this.#drawVictoryPreview(root.querySelector('[data-victory-preview]'),'grand victory leap',4); return root; }
  showRecoveryScreen({ difficulty=this.#state().difficulty }={}) { return this.#shell('Back to the Current', `<p class="orca-lead">Your orca has recovered. Your score and progress are preserved.</p><div class="orca-form"><label>Difficulty<select name="recoveryDifficulty"><option value="easy" ${difficulty==='easy'?'selected':''}>Easy</option><option value="hard" ${difficulty==='hard'?'selected':''}>Hard</option></select></label>${this.#button('Resume Dive','recover','primary')}${this.#button('World Map','map')}</div>`,'RECOVERY'); }
  showLoadSave() { return this.#shell('Load Save', `<div class="orca-form"><label>Choose JSON save<input type="file" accept="application/json,.json" data-save-file></label><p class="orca-hint" data-save-message>Choose a save file to validate and load it.</p>${this.#button('Back','menu')}</div>`,'PORTABLE SAVE'); }
  showMobileControls() { return `<nav class="orca-mobile-controls" aria-label="Touch controls">${[['left','◀'],['right','▶'],['jump','JUMP'],['shoot','SHOOT'],['dropThrough','DROP']].map(([k,l])=>`<button type="button" data-control="${k}">${l}</button>`).join('')}</nav>`; }
  #handleClick(e) {
    const b=e.target.closest('[data-action]'); if(!b) return; const a=b.dataset.action;
    if(a==='menu'){this.runtime.state.gameplay.paused=false;this.onMainMenu?.();this.showMainMenu();}
    else if(a==='back'){if(this.runtime.world?.level && this.runtime.state.gameplay.paused)this.showPauseMenu();else this.showMainMenu();}
    else if(a==='setup') this.showCharacterSetup();
    else if(a==='map') this.showWorldMap();
    else if(a==='settings') this.showSettings();
    else if(a==='load') this.showLoadSave();
    else if(a==='save'){try{this.runtime.saves.downloadSave();}catch(error){this.#shell('Save Failed',`<p class="orca-lead">${esc(error.message)}</p>${this.#button('Back','menu')}`,'SAVE ERROR');}}
    else if(a==='profile'){this.runtime.state.gameplay.paused=true;this.showProfile({returnToDive:true});}
    else if(a==='profile-back'){this.runtime.state.gameplay.paused=false;this.showGameplay({level:this.runtime.world?.level?.number??this.#state().currentLevel,world:this.runtime.world?.level?.world?.name??''});}
    else if(a==='pause') this.showPauseMenu();
    else if(a==='resume'){this.runtime.state.gameplay.paused=false;this.runtime.audio?.resumeAudio?.();this.onInput?.({type:'resume'});}
    else if(a==='begin') this.#submitSetup();
    else if(a==='level'){const level=Number(b.dataset.level);this.runtime.progression.setCurrentLevel(level);this.onStartLevel?.(level);this.onInput?.({type:'startLevel',level});}
    else if(a==='continue'){const level=this.#state().currentLevel;this.onStartLevel?.(level);}
    else if(a==='recover'){const d=this.root.querySelector('[name="recoveryDifficulty"]')?.value;if(d!==this.#state().difficulty)this.runtime.progression.setDifficulty(d,{reason:'all-lives-lost'});this.runtime.state.gameplay.paused=false;this.onInput?.({type:'recover'});}
    else if(a==='boss-celebrate') this.runtime.player.triggerVictoryAnimation(b.dataset.animation??'grand victory leap');
  }
  #submitSetup(){const f=this.root.querySelector('[data-form="setup"]');if(!f?.reportValidity())return;const fd=new FormData(f), name=String(fd.get('name')).trim(), colour=String(fd.get('colour')), difficulty=String(fd.get('difficulty')), characterType=String(fd.get('characterType'));this.runtime.player.customize({name,color:colour,characterType});this.characterType=characterType;if(difficulty!==this.#state().difficulty)this.runtime.progression.setDifficulty(difficulty,{reason:'initialization'});this.runtime.state.player.name=name;this.runtime.state.player.color=colour;this.runtime.state.player.characterType=characterType;this.onInput?.({type:'profile',name,colour,difficulty,characterType});this.showWorldMap();}
  #handleChange(e){if(e.target.name==='colour')this.#drawPreview(this.root.querySelector('[data-preview]'),e.target.value,this.characterType);if(e.target.name==='characterType'){this.characterType=e.target.value;this.#drawPreview(this.root.querySelector('[data-preview]'),this.root.querySelector('[name="colour"]')?.value??'classic',this.characterType);const captions={orca:'ORCA — POWERFUL SWIMMER',raccoon:'RACCOON — AGILE PAWS',octopus:'OCTOPUS — FLOWING TENTACLES'};const caption=this.root.querySelector('[data-character-caption]');if(caption)caption.textContent=captions[this.characterType]??'YOUR CHARACTER';}if(e.target.name==='music')this.runtime.audio?.setMusicEnabled(e.target.checked);if(e.target.name==='sound')this.runtime.audio?.setSoundEnabled(e.target.checked);if(e.target.matches('[data-save-file]'))this.#loadFile(e.target.files?.[0]);}
  async #loadFile(file){if(!file)return;const message=this.root.querySelector('[data-save-message]');try{const result=await this.runtime.saves.loadSave(file);if(!result?.loaded)throw new Error(result?.errors?.join('; ')??'Save could not be loaded');if(this.runtime.world?.level){const level=this.runtime.world.level;if(this.runtime.world.completed){if(level.number===15)this.showFinalEnding({playerName:this.runtime.player.name});else if(level.boss)this.showBossVictory({level:level.number,bossId:level.boss.id,playerName:this.runtime.player.name});else this.showVictory({level:level.number,playerName:this.runtime.player.name});}else if(this.runtime.state.gameplay.paused)this.showPauseMenu();else this.showGameplay({level:level.number,world:level.world.name});}else this.showWorldMap();}catch(error){if(message)message.textContent=`Save rejected: ${error.message}`;}}
  #handlePointer(e,down){
    if(down){
      const button=e.target.closest?.('[data-control]');
      if(!button || this._activePointers.has(e.pointerId)) return;
      e.preventDefault();
      const key=button.dataset.control;
      const alreadyHeld=[...this._activePointers.values()].some(active=>active.key===key);
      this._activePointers.set(e.pointerId,{key,button});
      button.setPointerCapture?.(e.pointerId);
      this.input[key]=true;
      button.classList.add('pressed');
      if(!alreadyHeld)this.onInput?.({type:'control',control:key,pressed:true});
      return;
    }
    const active=this._activePointers.get(e.pointerId);
    if(!active)return;
    this._activePointers.delete(e.pointerId);
    const stillHeld=[...this._activePointers.values()].some(pointer=>pointer.key===active.key);
    if(!stillHeld){
      this.input[active.key]=false;
      this.onInput?.({type:'control',control:active.key,pressed:false});
    }
    if(![...this._activePointers.values()].some(pointer=>pointer.button===active.button))active.button.classList.remove('pressed');
  }
  mountMobileControls(){
    this.root.querySelector('.orca-mobile-controls')?.remove();
    const host=this.root.querySelector('.orca-ui')??this.root;
    host.insertAdjacentHTML('beforeend',this.showMobileControls());
    const nav=host.querySelector('.orca-mobile-controls');
    // Bind directly to each control as well as the root delegation. This keeps
    // controls responsive when an overlay or embedded host interferes with bubbling.
    nav?.querySelectorAll('[data-control]').forEach(button=>{
      button.addEventListener('pointerdown',this._pointerDown);
      button.addEventListener('pointerup',this._pointerUp);
      button.addEventListener('pointercancel',this._pointerUp);
      button.addEventListener('lostpointercapture',this._pointerUp);
      button.addEventListener('click',event=>{
        if(event.detail===0) return;
        const key=button.dataset.control;
        this.onInput?.({type:'control',control:key,pressed:true});
        queueMicrotask(()=>this.onInput?.({type:'control',control:key,pressed:false}));
      });
    });
    return nav;
  }
  dispose(){
    for(const active of this._activePointers.values())active.button.classList.remove('pressed');
    for(const key of Object.keys(this.input)){if(this.input[key])this.onInput?.({type:'control',control:key,pressed:false});this.input[key]=false;}
    this._activePointers.clear();
    this.#stopPreview();
    this.root.removeEventListener('click',this._click);this.root.removeEventListener('change',this._change);this.root.removeEventListener('pointerdown',this._pointerDown);this.root.removeEventListener('pointerup',this._pointerUp);this.root.removeEventListener('pointercancel',this._pointerUp);this.root.removeEventListener('lostpointercapture',this._pointerUp);this.root.replaceChildren();
  }
}

export const createUIManager = options => new UIManager(options);
