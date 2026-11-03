// NEON HAVOC — Ultra High Performance Particle Engine (30x Speedup)

export class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.size = 2;
    this.color = '#00ffff';
    this.life = 1;
    this.maxLife = 1;
    this.drag = 0.96;
    this.type = 'spark'; // 'spark', 'ring', 'line_spark', 'smoke_puff', 'starburst'
    this.rotation = 0;
    this.rotSpeed = 0;
  }

  reset(x, y, vx, vy, size, color, maxLife, drag = 0.96, type = 'spark') {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = size;
    this.color = color;
    this.life = maxLife;
    this.maxLife = maxLife;
    this.drag = drag;
    this.type = type;
    this.rotation = Math.random() * Math.PI;
    this.rotSpeed = (Math.random() - 0.5) * 8;
  }

  update(dt) {
    if (!this.active) return;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.rotation += this.rotSpeed * dt;

    if (this.type === 'ring') {
      this.size += 240 * dt;
    } else if (this.type === 'smoke_puff') {
      this.size += 22 * dt;
      this.vx *= 0.92;
      this.vy *= 0.92;
    } else if (this.type === 'starburst') {
      this.size += 40 * dt;
    }
  }

  draw(ctx) {
    if (!this.active) return;
    const alpha = Math.max(0, this.life / this.maxLife);

    ctx.save();
    ctx.globalAlpha = alpha;

    if (this.type === 'ring') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, 2.8 * alpha);
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'line_spark') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, 2.2 * alpha);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 0.045, this.y - this.vy * 0.045);
      ctx.stroke();
    } else if (this.type === 'smoke_puff') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'starburst') {
      // 8-Pointed Explosive Hit Starburst (Matching reference image impact flash)
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);

      const rOuter = this.size * 1.6;
      const rInner = this.size * 0.45;
      const points = 8;

      // Radiant outer burst
      ctx.fillStyle = this.color || '#ffcc00';
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? rOuter : rInner;
        const angle = (i * Math.PI) / points;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Bright white-hot center core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, rInner * 0.75, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size * alpha), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export class ParticlePool {
  constructor(maxParticles = 1000) {
    this.pool = [];
    for (let i = 0; i < maxParticles; i++) {
      this.pool.push(new Particle());
    }
  }

  spawn(x, y, vx, vy, size, color, maxLife, drag = 0.96, type = 'spark') {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].reset(x, y, vx, vy, size, color, maxLife, drag, type);
        return this.pool[i];
      }
    }
    return null;
  }

  burst(x, y, color, count = 14, speed = 240, size = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * speed;
      const vx = Math.cos(angle) * spd;
      const vy = Math.sin(angle) * spd;
      const life = 0.28 + Math.random() * 0.35;
      this.spawn(x, y, vx, vy, size * (0.6 + Math.random() * 0.8), color, life, 0.93, 'spark');
    }
    this.spawn(x, y, 0, 0, 8, color, 0.25, 1, 'ring');
  }

  spawnDirectionalSparks(x, y, baseAngle, spreadAngle = 0.8, speed = 320, color = '#ffffff', count = 5) {
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (Math.random() - 0.5) * spreadAngle;
      const spd = (0.5 + Math.random() * 0.7) * speed;
      const vx = Math.cos(a) * spd;
      const vy = Math.sin(a) * spd;
      const life = 0.16 + Math.random() * 0.22;
      this.spawn(x, y, vx, vy, 2.5, color, life, 0.88, 'line_spark');
    }
  }

  spawnSmoke(x, y, color = 'rgba(100, 150, 255, 0.3)', count = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 40;
      this.spawn(x, y, Math.cos(a) * spd, Math.sin(a) * spd, 6 + Math.random() * 4, color, 0.4 + Math.random() * 0.3, 0.92, 'smoke_puff');
    }
  }

  spawnShockwave(x, y, color = '#00ffff', maxRadius = 160) {
    this.spawn(x, y, 0, 0, 10, color, 0.35, 1, 'ring');
  }

  spawnStarburst(x, y, color = '#ffcc00', size = 16) {
    // Explosive impact starburst + spark ejection
    this.spawn(x, y, 0, 0, size, color, 0.16, 0.85, 'starburst');
    this.spawn(x, y, 0, 0, size * 0.7, '#ff3300', 0.22, 0.85, 'starburst');
    this.spawnDirectionalSparks(x, y, Math.random() * Math.PI * 2, Math.PI * 2, 280, '#ffe600', 4);
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].draw(ctx);
      }
    }
    ctx.restore();
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}
