import { OrcaPhysics, PLAYER_CONTROLS, inputDown } from './OrcaPhysics.js';
import { OrcaAnimation } from './OrcaAnimation.js';
import { Projectiles } from './Projectiles.js';

const PALETTES = Object.freeze({
  classic: { body: '#101820', belly: '#f7f8f4', patch: '#f4f7f5', fin: '#0a1119', eye: '#07111a', accent: '#9beaff' },
  midnight: { body: '#142d50', belly: '#eaf6ff', patch: '#dcecff', fin: '#0a1d38', eye: '#07111a', accent: '#7bbcff' },
  teal: { body: '#075b62', belly: '#eafff9', patch: '#e5fff9', fin: '#06444d', eye: '#062d35', accent: '#7ef4df' },
  rose: { body: '#553448', belly: '#fff3f5', patch: '#ffe9f0', fin: '#392433', eye: '#20131b', accent: '#ffb4d0' },
  gold: { body: '#56451b', belly: '#fff9df', patch: '#fff3c2', fin: '#382c0f', eye: '#171205', accent: '#ffdf71' }
});

/**
 * Playable orca entity. Uses the shared engine's update/render lifecycle and does not create a loop.
 * @param {object} options - x/y, name, color, physics, projectiles, events, onEvent.
 */
export class Orca {
  constructor(options = {}) {
    this.x = options.x ?? 80; this.y = options.y ?? 300;
    this.baseWidth = options.width ?? 66; this.baseHeight = options.height ?? 43;
    this.sizeScale = 1; this.jumpScale = 1;
    this.vx = 0; this.vy = 0; this.facing = 1; this.grounded = false;
    this.name = options.name ?? 'Orca'; this.color = options.color ?? 'classic'; this.characterType = options.characterType ?? 'orca';
    if (!['orca','raccoon','octopus'].includes(this.characterType)) throw new RangeError(`Unknown character type: ${this.characterType}`);
    this.physics = options.physics ?? new OrcaPhysics(options.physicsOptions);
    this.animation = options.animation ?? new OrcaAnimation({ characterType: this.characterType });
    this.projectiles = options.projectiles ?? new Projectiles(options.projectileOptions);
    this.events = options.events ?? null; this.onEvent = options.onEvent ?? null;
    this.invulnerabilityMs = 0; this.protectionHits = 0; this.activePowerUp = null;
    this.shootWasDown = false; this.animationState = 'idle'; this.alive = true;
    this.lastDamageAt = -Infinity;
  }

  get width() { return this.baseWidth * this.sizeScale; }
  get height() { return this.baseHeight * this.sizeScale; }
  get centerX() { return this.x + this.width / 2; }
  get centerY() { return this.y + this.height / 2; }
  get isInvulnerable() { return this.invulnerabilityMs > 0 || this.protectionHits > 0; }

  update(deltaTime, input, platforms = [], options = {}) {
    if (!this.alive) return;
    const dt = Math.min(Math.max(deltaTime, 0), 1 / 30);
    this.invulnerabilityMs = Math.max(0, this.invulnerabilityMs - dt * 1000);
    this.physics.update(this, dt, input, platforms, {
      onJump: () => this.#emit('player.jump', { x: this.x, y: this.y }),
      onDropThrough: () => this.#emit('player.dropThrough', { x: this.x, y: this.y })
    });
    const shooting = inputDown(input, PLAYER_CONTROLS.shoot);
    if (shooting) this.shoot();
    this.shootWasDown = shooting;
    this.projectiles.update(dt, options.projectileBounds ?? null);
    const completed = this.animation.update(dt);
    if (completed) this.#emit('player.victoryAnimationComplete', { name: completed, playerName: this.name });
  }

  render(ctx) {
    if (!this.alive) return;
    const pose = this.animation.getMotionPose(this.animationState, this.facing);
    const x = this.x + (pose.dx ?? 0), y = this.y + (pose.dy ?? 0);
    const blink = this.invulnerabilityMs > 0 && Math.floor(this.invulnerabilityMs / 75) % 2 === 0;
    if (blink) return;
    this.animation.renderEffects(ctx, x, y, this.width, pose);
    if (this.characterType === 'raccoon') { this.#renderRaccoon(ctx, x, y, pose); this.projectiles.render(ctx); this.#renderName(ctx); return; }
    if (this.characterType === 'octopus') { this.#renderOctopus(ctx, x, y, pose); this.projectiles.render(ctx); this.#renderName(ctx); return; }
    ctx.save();
    ctx.translate(x + this.width / 2, y + this.height / 2);
    ctx.scale(this.facing, 1);
    ctx.rotate(pose.rotation ?? 0);
    ctx.scale(pose.scale ?? 1, pose.scale ?? 1);
    const w = this.width, h = this.height, c = PALETTES[this.color] ?? PALETTES.classic;
    const t = pose.tail ?? 0, fin = pose.fin ?? 0;

    // Tail flukes: two distinct lobes and a narrow peduncle, never legs.
    ctx.save(); ctx.translate(-w * .39, h * .02); ctx.rotate(t * .34);
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(-w*.12, -h*.18, -w*.31, -h*.25); ctx.quadraticCurveTo(-w*.24, -h*.02, -w*.12, h*.06); ctx.quadraticCurveTo(-w*.25, h*.28, -w*.34, h*.22); ctx.quadraticCurveTo(-w*.16, h*.02, 0, 3); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Main streamlined black body and white underside.
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.ellipse(0, 0, w*.43, h*.43, -.04, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = c.belly; ctx.beginPath(); ctx.ellipse(w*.12, h*.22, w*.27, h*.18, .1, 0, Math.PI); ctx.fill();
    // White lower jaw/chest patch.
    ctx.fillStyle = c.patch; ctx.beginPath(); ctx.ellipse(w*.34, h*.11, w*.11, h*.12, .2, 0, Math.PI*2); ctx.fill();

    // Dorsal fin: unmistakable triangular swept-back fin.
    ctx.fillStyle = c.fin; ctx.beginPath(); ctx.moveTo(-w*.10, -h*.31); ctx.quadraticCurveTo(-w*.02, -h*.95, w*.12, -h*.39); ctx.lineTo(w*.19, -h*.29); ctx.closePath(); ctx.fill();

    // Far-side pectoral fin visible below the body.
    ctx.fillStyle = c.fin; ctx.beginPath(); ctx.moveTo(-w*.05, h*.18); ctx.quadraticCurveTo(-w*.02, h*.54, w*.18, h*.52); ctx.quadraticCurveTo(w*.12, h*.28, w*.10, h*.17); ctx.fill();
    // Near-side pectoral fin sweeps backward and flutters.
    ctx.save(); ctx.translate(-w*.02, h*.18); ctx.rotate(.42 + fin);
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-w*.02, h*.36, -w*.25, h*.48); ctx.quadraticCurveTo(-w*.22, h*.19, -w*.09, -.02); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-w*.06, h*.08); ctx.quadraticCurveTo(-w*.13, h*.22, -w*.19, h*.37); ctx.stroke(); ctx.restore();

    // Large white eye patch and small expressive eye on the head.
    ctx.fillStyle = c.patch; ctx.beginPath(); ctx.ellipse(w*.27, -h*.18, w*.105, h*.17, -.28, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = c.eye; ctx.beginPath(); ctx.arc(w*.345, -h*.19, Math.max(1.8, h*.055), 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w*.36, -h*.215, Math.max(0.8, h*.018), 0, Math.PI*2); ctx.fill();

    // Rounded rostrum and a subtle mouth line; no human facial features.
    ctx.fillStyle = c.body; ctx.beginPath(); ctx.ellipse(w*.405, h*.035, w*.065, h*.075, .05, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = 'rgba(245,250,250,.7)'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(w*.34, h*.16); ctx.quadraticCurveTo(w*.40, h*.20, w*.45, h*.14); ctx.stroke();

    // Protective shell / hit shield is an outer bubble, not a body mutation.
    if (this.protectionHits > 0 || this.invulnerabilityMs > 0) {
      ctx.strokeStyle = 'rgba(125,231,255,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, w*.53, h*.64, 0, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = 'rgba(150,235,255,.12)'; ctx.fill();
    }
    ctx.restore();
    this.projectiles.render(ctx);
    ctx.save(); ctx.fillStyle = 'rgba(235,249,255,.9)'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(this.name, this.centerX, this.y - 8); ctx.restore();
  }

  #renderName(ctx) { ctx.save(); ctx.fillStyle = 'rgba(235,249,255,.9)'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(this.name, this.centerX, this.y-8); ctx.restore(); }

  #renderRaccoon(ctx, x, y, pose) {
    const w=this.width,h=this.height,t=pose.tail??0, phase=this.animation.time;
    ctx.save(); ctx.translate(x+w/2,y+h/2); ctx.scale(this.facing,1); ctx.rotate(pose.rotation??0);
    ctx.save(); ctx.translate(-w*.38,h*.12); ctx.rotate(t*.28+Math.sin(phase*4)*.12);
    ctx.strokeStyle='#554039'; ctx.lineWidth=h*.42; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(-w*.25,-h*.34,-w*.48,-h*.12); ctx.stroke();
    for(let i=0;i<4;i++){ctx.strokeStyle=i%2?'#e4d4b7':'#49372f';ctx.lineWidth=h*.12;ctx.beginPath();ctx.arc(-w*.24-i*w*.055,-h*.15+i*h*.025,h*.15,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    ctx.fillStyle='#81766b';ctx.beginPath();ctx.ellipse(0,h*.08,w*.37,h*.36,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d6c8b5';ctx.beginPath();ctx.ellipse(w*.15,h*.2,w*.21,h*.18,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#5a4a40';for(const ex of [-w*.2,w*.2]){ctx.beginPath();ctx.arc(ex,-h*.29,h*.14,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#d7c9b7';for(const ex of [-w*.2,w*.2]){ctx.beginPath();ctx.arc(ex,-h*.29,h*.075,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#3e3530';ctx.beginPath();ctx.ellipse(w*.19,-h*.11,w*.24,h*.15,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f0e9df';ctx.beginPath();ctx.ellipse(w*.28,-h*.11,w*.1,h*.11,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#151311';ctx.beginPath();ctx.arc(w*.31,-h*.14,Math.max(2,h*.05),0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#2e2824';ctx.beginPath();ctx.ellipse(w*.37,h*.05,w*.05,h*.04,0,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){const pawX=-w*.19+i*w*.12;ctx.fillStyle='#5d5148';ctx.beginPath();ctx.ellipse(pawX,h*.38+Math.sin(phase*8+i)*h*.025+(pose.paws??0)*h*.03,w*.09,h*.08,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }

  #renderOctopus(ctx, x, y, pose) {
    const w=this.width,h=this.height, phase=this.animation.time, wave=pose.tentacles??0;
    ctx.save();ctx.translate(x+w/2,y+h*.38);ctx.scale(this.facing,1);ctx.rotate(pose.rotation??0);
    const colors=['#a94dba','#8c3ca7','#c46bd0','#79328e'];
    for(let i=0;i<8;i++){
      const angle=-Math.PI*.85+i*Math.PI*1.7/7, len=h*(.55+(i%3)*.12), startX=Math.cos(angle)*w*.19,startY=h*.08+Math.sin(angle)*h*.08;
      ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=h*.14;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(startX,startY);
      const sway=Math.sin(phase*5+i*.8+wave)*len*.34;
      ctx.bezierCurveTo(startX+Math.cos(angle)*len*.45+sway,startY+len*.4,startX+Math.sin(phase*3+i)*len*.3,startY+len*.7,startX+Math.cos(angle)*len*.65+sway,startY+len);
      ctx.stroke();
      ctx.fillStyle='rgba(255,232,255,.75)';for(let s=1;s<=3;s++){const sx=startX+Math.cos(angle)*len*s*.19+sway*s*.2,sy=startY+len*s*.24;ctx.beginPath();ctx.arc(sx,sy,h*.035,0,Math.PI*2);ctx.fill();}
    }
    ctx.fillStyle='#b45ac5';ctx.beginPath();ctx.ellipse(0,-h*.1,w*.34,h*.42,-.08,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#d889df';ctx.beginPath();ctx.ellipse(0,h*.12,w*.22,h*.22,0,0,Math.PI*2);ctx.fill();
    for(const ex of [-w*.12,w*.12]){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,-h*.1,h*.12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#292036';ctx.beginPath();ctx.arc(ex+w*.025,-h*.08,h*.055,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#683274';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,h*.2,w*.075,.15,Math.PI-.15);ctx.stroke();
    ctx.restore();
  }

  shoot() {
    const projectile = this.projectiles.shoot(this);
    if (projectile) this.#emit('player.shoot', { x: projectile.x, y: projectile.y, direction: this.facing });
    return projectile;
  }

  /** Customize the visible name and one of classic, midnight, teal, rose, gold. */
  customize({ name, color, characterType } = {}) {
    if (typeof name === 'string' && name.trim()) this.name = name.trim().slice(0, 24);
    if (color && PALETTES[color]) this.color = color;
    if (characterType !== undefined) { if (!['orca','raccoon','octopus'].includes(characterType)) throw new RangeError(`Unknown character type: ${characterType}`); this.characterType = characterType; this.animation.characterType = characterType; }
    this.#emit('player.customized', { name: this.name, color: this.color, characterType: this.characterType });
    return { name: this.name, color: this.color, characterType: this.characterType };
  }

  /** Set absolute visual/physical size multiplier. */
  setSize(scale = 1) {
    const value = Number(scale); this.sizeScale = Math.max(.65, Math.min(2.25, Number.isFinite(value) ? value : 1));
    this.#emit('player.sizeChanged', { sizeScale: this.sizeScale });
    return this.sizeScale;
  }

  /** Set jump-strength multiplier independently of size. */
  setJumpStrength(multiplier = 1) {
    const value = Number(multiplier); this.jumpScale = Math.max(.5, Math.min(2.5, Number.isFinite(value) ? value : 1));
    this.#emit('player.jumpStrengthChanged', { jumpScale: this.jumpScale });
    return this.jumpScale;
  }

  /** Progression calls this when collecting a power-up; only one may be active. */
  applyPowerUp(type) {
    const effects = {
      berry: { size: 1.4, jump: 1, label: 'Sea Berry' },
      'sea-berry': { size: 1.4, jump: 1, label: 'Sea Berry' },
      'sea berry': { size: 1.4, jump: 1, label: 'Sea Berry' },
      krill: { size: 1.8, jump: 1.35, label: 'Golden Krill' },
      'golden-krill': { size: 1.8, jump: 1.35, label: 'Golden Krill' },
      'golden krill': { size: 1.8, jump: 1.35, label: 'Golden Krill' },
      bubble: { size: 1, jump: 1, label: 'Bubble Shell' },
      'bubble-shell': { size: 1, jump: 1, label: 'Bubble Shell' },
      'bubble shell': { size: 1, jump: 1, label: 'Bubble Shell' }
    };
    const effect = effects[String(type).toLowerCase()];
    if (!effect) throw new RangeError(`Unknown power-up: ${type}`);
    this.activePowerUp = effect.label;
    this.setSize(effect.size); this.setJumpStrength(effect.jump);
    this.protectionHits = 1;
    this.#emit('player.powerUpApplied', { type: effect.label, protectionHits: 1 });
    return { ...effect, protectionHits: 1 };
  }

  clearPowerUp() {
    const previous = this.activePowerUp;
    this.activePowerUp = null; this.protectionHits = 0;
    this.setSize(1); this.setJumpStrength(1);
    this.#emit('player.powerUpCleared', { previous });
  }

  /** Returns false if a one-hit power-up or temporary invulnerability absorbed the hit. */
  takeDamage(options = {}) {
    if (this.invulnerabilityMs > 0) return false;
    if (this.protectionHits > 0) {
      this.protectionHits -= 1;
      this.invulnerabilityMs = options.invulnerabilityMs ?? 650;
      this.#emit('player.protectionConsumed', { powerUp: this.activePowerUp, remaining: this.protectionHits });
      if (this.protectionHits === 0) this.clearPowerUp();
      return false;
    }
    this.invulnerabilityMs = options.invulnerabilityMs ?? 1100;
    this.lastDamageAt = 0;
    if (options.emitEvent !== false) this.#emit('player.damaged', { x: this.x, y: this.y, source: options.source ?? 'damage' });
    if (options.knockback !== false) { this.vy = -230; this.vx = -this.facing * 110; this.grounded = false; }
    return true;
  }

  setInvulnerable(milliseconds = 1000) { this.invulnerabilityMs = Math.max(0, milliseconds); }

  triggerVictoryAnimation(name, duration = 2.8) {
    const canonical = this.animation.trigger(name, duration);
    this.#emit('player.victoryAnimationStarted', { name: canonical, playerName: this.name });
    return canonical;
  }

  getVictoryAnimationName() { return this.animation.victory?.name ?? null; }

  /** Progression/recovery can call this when all lives are lost. */
  recover() {
    this.clearPowerUp(); this.invulnerabilityMs = 1500; this.alive = true;
    this.vx = 0; this.vy = 0; this.projectiles.clear();
    this.#emit('player.recovered', { x: this.x, y: this.y });
  }

  #emit(name, payload) {
    this.events?.emit?.(name, payload);
    this.onEvent?.(name, payload);
  }
}

export { PALETTES };
