import { GAME_CONFIG } from '../game-config.js';

/** Draws the active level and its world-space entities. */
export class LevelRenderer {
  render(world, ctx) {
    if (!world.level) {
      ctx.fillStyle = '#063b58';
      ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);
      world.player.render(ctx, 0);
      return;
    }
    const level = world.level;
    const [top, bottom] = level.background;
    const theme = level.theme ?? { terrain: '#143d48', trim: '#4eb7a1', accent: '#70d8c2', detail: '#d8f2e8' };
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.canvas.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_CONFIG.canvas.width, GAME_CONFIG.canvas.height);

    for (let i = 0; i < 12; i++) {
      const x = ((i * 173 - world.cameraX * 0.18 - world.cameraY * 0.08) % (GAME_CONFIG.canvas.width + 100) + GAME_CONFIG.canvas.width + 100) % (GAME_CONFIG.canvas.width + 100);
      ctx.fillStyle = 'rgba(210,245,255,0.045)';
      ctx.fillRect(x, 0, 22, GAME_CONFIG.canvas.height);
      ctx.strokeStyle = 'rgba(210,245,255,0.22)';
      ctx.beginPath();
      ctx.arc(x + 38, 75 + (i * 31) % 330, 3 + i % 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(-world.cameraX, -world.cameraY);
    for (const platform of level.platforms) {
      ctx.fillStyle = theme.terrain;
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
      ctx.fillStyle = theme.trim;
      ctx.fillRect(platform.x, platform.y, platform.w, platform.id.includes('floor') || platform.id.includes('bank') || platform.id.includes('shore') ? 8 : 5);
      if (platform.oneWay) {
        ctx.fillStyle = theme.accent;
        ctx.fillRect(platform.x + 5, platform.y + 6, Math.max(0, platform.w - 10), 3);
      }
    }
    for (const decoration of level.decorations ?? []) this.#drawDecoration(ctx, decoration, theme);
    for (const hazard of level.hazards ?? []) this.#drawHazard(ctx, hazard, theme);
    ctx.fillStyle = theme.detail;
    ctx.fillRect(level.exit.x, level.exit.y, level.exit.w, level.exit.h);
    ctx.fillStyle = '#174f61';
    ctx.fillRect(level.exit.x + 10, level.exit.y + 10, level.exit.w - 20, level.exit.h - 10);
    for (const item of level.collectibles) this.#drawCollectible(ctx, item, world.collectibleState.has(item.id));
    world.player.render(ctx);
    world.encounters.renderEnemies(ctx, { x: world.cameraX, y: world.cameraY });
    ctx.restore();
  }

  #drawDecoration(ctx, item, theme) {
    const scale = item.scale ?? 1;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = theme.accent;
    ctx.strokeStyle = theme.detail;
    ctx.lineWidth = 3;
    if (['coral','kelp','flower','fan','root-tree'].includes(item.type)) {
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(i * 20, -22, i * 15, -62 - Math.abs(i) * 8);
        ctx.stroke();
      }
      if (item.type === 'flower') { ctx.fillStyle = theme.detail; ctx.beginPath(); ctx.arc(0,-60,9,0,Math.PI*2); ctx.fill(); }
    } else if (['crystal','iceberg','pillar','statue'].includes(item.type)) {
      ctx.beginPath(); ctx.moveTo(-24,0); ctx.lineTo(-12,-48); ctx.lineTo(0,-68); ctx.lineTo(16,-38); ctx.lineTo(26,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (item.type === 'snowflake') {
      for (let i=0;i<6;i++) { ctx.rotate(Math.PI/3); ctx.beginPath(); ctx.moveTo(0,-30); ctx.lineTo(0,30); ctx.stroke(); }
    } else if (item.type === 'angler' || item.type === 'seal') {
      ctx.beginPath(); ctx.ellipse(0,-12,26,14,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = theme.detail; ctx.beginPath(); ctx.arc(12,-17,3,0,Math.PI*2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(0,-12,18,12,0,0,Math.PI*2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  #drawHazard(ctx, hazard, theme) {
    ctx.save();
    if (hazard.type === 'spikes') {
      ctx.fillStyle = '#e85d75';
      const count = Math.max(2, Math.floor(hazard.w / 18));
      for (let i=0;i<count;i++) {
        const x = hazard.x + i * hazard.w / count;
        ctx.beginPath(); ctx.moveTo(x,hazard.y+hazard.h); ctx.lineTo(x+hazard.w/count/2,hazard.y); ctx.lineTo(x+hazard.w/count,hazard.y+hazard.h); ctx.closePath(); ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(255,120,90,0.25)';
      ctx.fillRect(hazard.x,hazard.y,hazard.w,hazard.h);
      ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(hazard.x,hazard.y+hazard.h); ctx.quadraticCurveTo(hazard.x+hazard.w/2,hazard.y-12,hazard.x+hazard.w,hazard.y+hazard.h); ctx.stroke();
    }
    ctx.restore();
  }

  #drawCollectible(ctx, item, collected = false) {
    if (collected) return;
    ctx.save();
    ctx.translate(item.x + 15, item.y + 15);
    if (item.type === 'badge') {
      const palette = ['#ff8a5b', '#64d9c2', '#a18bff', '#ffdb68', '#6cc8ff'];
      ctx.fillStyle = palette[(item.badgeId - 1) % palette.length];
      ctx.strokeStyle = '#fff5c6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -13); ctx.lineTo(11, -7); ctx.lineTo(9, 8);
      ctx.lineTo(0, 13); ctx.lineTo(-9, 8); ctx.lineTo(-11, -7);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#07344b'; ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(item.badgeId), 0, 0);
    } else if (item.type === 'powerup' && item.powerUp === 'sea-berry') {
      ctx.fillStyle = '#f04e86'; ctx.strokeStyle = '#ffd4e3'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 2, 10, 12, -0.25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#65d77c'; ctx.beginPath(); ctx.ellipse(2, -11, 5, 3, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, -1, 2, 0, Math.PI * 2); ctx.fill();
    } else if (item.type === 'powerup' && item.powerUp === 'golden-krill') {
      ctx.fillStyle = '#ffc83d'; ctx.strokeStyle = '#fff0a8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-5, -7); ctx.lineTo(0, -4);
      ctx.lineTo(5, -7); ctx.lineTo(10, 0); ctx.lineTo(5, 7); ctx.lineTo(0, 4);
      ctx.lineTo(-5, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.fillRect(-3, -2, 2, 2); ctx.fillRect(3, -2, 2, 2);
    } else if (item.type === 'powerup' && item.powerUp === 'bubble-shell') {
      ctx.fillStyle = '#55dcff'; ctx.strokeStyle = '#e2fbff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#087baf'; ctx.lineWidth = 2;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.arc(k * 4, 0, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-4, -5, 3, 0, Math.PI * 2); ctx.fill();
    } else if (item.type === 'life') {
      ctx.fillStyle = '#ffe36b'; ctx.strokeStyle = '#fff5bc'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(11, 0); ctx.lineTo(0, 12);
      ctx.lineTo(-11, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', 0, 0);
    } else {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#75f4d2'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#087baf'; ctx.fillRect(-3, -7, 6, 14);
    }
    ctx.restore();
  }
}
