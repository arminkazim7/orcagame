/** Small, self-contained projectile collection. Coordinates are world-space. */
export class Projectiles {
  constructor(options = {}) {
    this.items = [];
    this.speed = options.speed ?? 560;
    this.radius = options.radius ?? 5;
    this.cooldown = options.cooldown ?? 220;
    this.elapsed = this.cooldown;
  }

  shoot(orca) {
    if (this.elapsed < this.cooldown) return null;
    this.elapsed = 0;
    const scale = orca.sizeScale ?? 1;
    const projectile = {
      x: orca.facing > 0 ? orca.x + orca.width + 2 : orca.x - 10,
      y: orca.y + orca.height * 0.48,
      vx: this.speed * orca.facing,
      radius: this.radius * Math.max(1, scale * 0.8),
      damage: 1,
      alive: true
    };
    this.items.push(projectile);
    return projectile;
  }

  update(deltaTime, bounds = null) {
    const dt = Math.min(Math.max(deltaTime, 0), 1 / 30);
    this.elapsed += dt * 1000;
    for (const p of this.items) {
      p.x += p.vx * dt;
      if (bounds && (p.x < bounds.left || p.x > bounds.right)) p.alive = false;
    }
    this.items = this.items.filter(p => p.alive);
  }

  render(ctx) {
    for (const p of this.items) {
      const x = p.x;
      ctx.save();
      ctx.shadowColor = '#8ff7ff';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#d9fbff';
      ctx.beginPath();
      ctx.arc(x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  clear() { this.items.length = 0; }
}
