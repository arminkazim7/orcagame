/** Canvas animation layer. All poses retain the orca silhouette and anatomy. */
export const VICTORY_ANIMATIONS = Object.freeze([
  'tail slap', 'barrel roll', 'leap/splash', 'treasure chest spin', 'bubble-ring trick',
  'tail flip', 'spiral swim', 'somersault', 'big tail splash', 'kelp weave',
  'spinning dash', 'jump through bubbles', 'ice arch slide', 'double flip', 'grand victory leap'
]);

const TAU = Math.PI * 2;
const clamp01 = n => Math.max(0, Math.min(1, n));

export class OrcaAnimation {
  constructor({ characterType = 'orca' } = {}) { this.time = 0; this.victory = null; this.lastPose = null; this.characterType = characterType; }

  trigger(name, duration = 2.8) {
    const normalized = String(name).toLowerCase();
    const canonical = VICTORY_ANIMATIONS.find(n => n.toLowerCase() === normalized);
    if (!canonical) throw new RangeError(`Unknown victory animation: ${name}`);
    this.victory = { name: canonical, elapsed: 0, duration: Math.max(0.5, duration) };
    return canonical;
  }

  update(dt) {
    this.time += Math.max(dt, 0);
    if (!this.victory) return null;
    this.victory.elapsed += Math.max(dt, 0);
    if (this.victory.elapsed >= this.victory.duration) {
      const completed = this.victory.name;
      this.victory = null;
      return completed;
    }
    return null;
  }

  getVictoryPose() {
    if (!this.victory) return null;
    const v = this.victory, t = clamp01(v.elapsed / v.duration), wave = Math.sin(t * TAU * 2);
    const pose = { name: v.name, t, dx: 0, dy: 0, rotation: 0, scale: 1, tail: wave * 0.5, fin: wave * 0.18, bubbles: false, splash: false, rings: false, spin: false };
    switch (v.name) {
      case 'tail slap': pose.tail = Math.sin(t * Math.PI * 3) * 1.25; pose.dy = Math.sin(t * Math.PI * 2) * 5; pose.splash = t > .28 && t < .72; break;
      case 'barrel roll': pose.rotation = t * TAU; pose.spin = true; break;
      case 'leap/splash': pose.dy = -Math.sin(t * Math.PI) * 95; pose.splash = t > .78; break;
      case 'treasure chest spin': pose.rotation = Math.sin(t * TAU * 2) * .22; pose.tail = Math.sin(t * TAU * 3); pose.scale = 1 + Math.sin(t * TAU * 2) * .08; break;
      case 'bubble-ring trick': pose.dy = -Math.sin(t * Math.PI) * 30; pose.rings = true; pose.bubbles = true; break;
      case 'tail flip': pose.rotation = Math.sin(t * TAU) * .18; pose.tail = Math.sin(t * TAU * 2) * 1.7; pose.dy = -Math.abs(Math.sin(t * TAU)) * 28; break;
      case 'spiral swim': pose.rotation = t * TAU * 1.5; pose.dx = Math.sin(t * TAU) * 26; pose.dy = Math.cos(t * TAU * 1.5) * 18; pose.bubbles = true; break;
      case 'somersault': pose.rotation = t * TAU; pose.dy = -Math.sin(t * Math.PI) * 22; break;
      case 'big tail splash': pose.tail = Math.sin(t * Math.PI * 4) * 1.9; pose.dy = -Math.max(0, Math.sin(t * Math.PI * 2)) * 24; pose.splash = t > .25 && t < .8; break;
      case 'kelp weave': pose.dx = Math.sin(t * TAU * 2) * 42; pose.rotation = Math.sin(t * TAU * 2) * .24; pose.fin = Math.sin(t * TAU * 4) * .55; break;
      case 'spinning dash': pose.dx = (t - .5) * 155; pose.rotation = t * TAU * 2; pose.spin = true; break;
      case 'jump through bubbles': pose.dy = -Math.sin(t * Math.PI) * 110; pose.bubbles = true; break;
      case 'ice arch slide': pose.dx = Math.sin(t * Math.PI) * 105; pose.dy = 20 + Math.sin(t * Math.PI) * 8; pose.rotation = Math.sin(t * Math.PI) * -.32; pose.scale = 1 + Math.sin(t * Math.PI) * .12; break;
      case 'double flip': pose.rotation = t * TAU * 2; pose.dy = -Math.abs(Math.sin(t * TAU)) * 65; pose.bubbles = true; break;
      case 'grand victory leap': pose.dy = -Math.sin(t * Math.PI) * 150; pose.rotation = Math.sin(t * TAU) * .18; pose.scale = 1 + Math.sin(t * Math.PI) * .22; pose.splash = t > .82; pose.rings = true; pose.bubbles = true; break;
    }
    return pose;
  }

  getMotionPose(state, facing = 1) {
    if (this.victory) return this.getVictoryPose();
    const phase = this.time * (state === 'swim' ? 9 : 4);
    const swim = state === 'swim', idle = state === 'idle', jump = state === 'jump', fall = state === 'fall';
    if (this.characterType === 'raccoon') return { name: state, rotation: jump ? -.2 : fall ? .18 : Math.sin(phase)*.04, tail: Math.sin(phase)* (idle?.12:.75), fin: 0, dx:0, dy: swim?Math.sin(phase)*2:0, scale:1, bubbles:false,splash:false,rings:false,spin:false, legs:Math.sin(phase)*.55, paws:Math.sin(phase+1)*.4, facing };
    if (this.characterType === 'octopus') return { name:state, rotation: jump?-.16:fall?.14:Math.sin(phase)*.06, tail:0, fin:0, dx:0, dy:swim?Math.sin(phase)*4:idle?Math.sin(phase)*2:0, scale:1, bubbles:swim, splash:false,rings:false,spin:false, tentacles:Math.sin(phase)*.65, curl:Math.sin(phase+1)*.4, facing };
    return { name: state, rotation: jump ? -0.12 : fall ? 0.12 : 0,
      tail: Math.sin(phase) * (idle ? .16 : .58), fin: Math.sin(phase + Math.PI / 2) * .22,
      dy: swim ? Math.sin(phase) * 2.5 : 0, dx: 0, scale: 1, bubbles: false, splash: false, rings: false, spin: false, facing };
  }

  renderEffects(ctx, x, y, width, pose) {
    if (!pose) return;
    ctx.save();
    if (pose.bubbles) {
      for (let i = 0; i < 7; i++) {
        const bx = x + width * (.2 + i * .1) + Math.sin(this.time * 3 + i) * 7;
        const by = y - 12 - ((this.time * 34 + i * 17) % 72);
        ctx.strokeStyle = 'rgba(190,245,255,.72)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, by, 3 + i % 3, 0, TAU); ctx.stroke();
      }
    }
    if (pose.rings) {
      ctx.strokeStyle = 'rgba(131,231,255,.75)'; ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(x + width / 2, y + 18, 18 + i * 13 + pose.t * 15, 7 + i * 4, 0, 0, TAU); ctx.stroke(); }
    }
    if (pose.splash) {
      ctx.strokeStyle = '#b8f6ff'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) { const a = Math.PI + i * Math.PI / 7; ctx.beginPath(); ctx.moveTo(x + width / 2, y + 32); ctx.lineTo(x + width / 2 + Math.cos(a) * (18 + i % 3 * 8), y + 32 + Math.sin(a) * 18); ctx.stroke(); }
    }
    if (pose.name === 'treasure chest spin') {
      ctx.fillStyle = '#d69a45'; ctx.fillRect(x + width * .42, y + 35, 25, 15); ctx.fillStyle = '#f4d27a'; ctx.fillRect(x + width * .42, y + 35, 25, 4);
    }
    if (pose.name === 'ice arch slide') {
      ctx.strokeStyle = 'rgba(194,244,255,.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x + width / 2, y + 28, 52, Math.PI, 0); ctx.stroke();
    }
    if (pose.name === 'kelp weave') {
      ctx.strokeStyle = '#3aaf91'; ctx.lineWidth = 5;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x + 8 + i * 13, y + 50); ctx.quadraticCurveTo(x - 10 + i * 16, y + 25, x + 10 + i * 16, y - 18); ctx.stroke(); }
    }
    ctx.restore();
  }
}
