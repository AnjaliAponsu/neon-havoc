// NEON HAVOC — Floating Combat Text Engine

export class FloatingText {
  constructor() {
    this.active = false;
    this.text = '';
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = -50;
    this.color = '#ffffff';
    this.glow = '#00ffff';
    this.life = 1;
    this.maxLife = 1;
    this.size = 14;
    this.isCrit = false;
  }

  reset(x, y, text, color = '#ffffff', glow = '#00ffff', isCrit = false, size = 14, life = 0.8) {
    this.active = true;
    this.x = x + (Math.random() - 0.5) * 16;
    this.y = y - 10 + (Math.random() - 0.5) * 10;
    this.text = text;
    this.color = color;
    this.glow = glow;
    this.isCrit = isCrit;
    this.size = isCrit ? size * 1.35 : size;
    this.life = life;
    this.maxLife = life;
    this.vx = (Math.random() - 0.5) * 40;
    this.vy = isCrit ? -80 : -50;
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
    this.vy += 40 * dt; // slight gravity deceleration
  }

  draw(ctx) {
    if (!this.active || !isFinite(this.x) || !isFinite(this.y)) return;
    const alpha = Math.max(0, Math.min(1, this.life / this.maxLife));
    if (!isFinite(alpha)) return;

    ctx.save();
    try {
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${this.size}px 'Rajdhani', sans-serif`;
      ctx.textAlign = 'center';

      // High performance dark neon outline
      ctx.lineWidth = this.isCrit ? 3.5 : 2.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeText(this.text, this.x, this.y);

      ctx.fillStyle = this.color;
      ctx.fillText(this.text, this.x, this.y);
    } finally {
      ctx.restore();
    }
  }
}

export class FloatingTextManager {
  constructor(maxTexts = 120) {
    this.pool = [];
    for (let i = 0; i < maxTexts; i++) {
      this.pool.push(new FloatingText());
    }
  }

  spawn(x, y, text, color = '#ffffff', glow = '#00ffff', isCrit = false, size = 14, life = 0.8) {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].reset(x, y, text, color, glow, isCrit, size, life);
        return this.pool[i];
      }
    }
    return null;
  }

  update(dt) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt);
      }
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].draw(ctx);
      }
    }
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
    }
  }
}

