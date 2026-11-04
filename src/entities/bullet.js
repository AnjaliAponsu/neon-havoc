// NEON HAVOC — Bullet & Projectile Physics Engine (30x Speedup with GlowCache)

import { COLORS, GAME_CONFIG } from '../constants.js';
import { glowCache } from '../glowCache.js';

export class Bullet {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.damage = 20;
    this.radius = 4;
    this.color = COLORS.BULLET_PLAYER;
    this.pierce = 1;
    this.piercedCount = 0;
    this.distanceTraveled = 0;
    this.maxRange = 800;
    this.isEnemy = false;
    this.isCrit = false;
    this.type = 'standard';
    this.hitEnemies = new Set();
  }

  reset(x, y, angle, speed, damage, maxRange, pierce = 1, isEnemy = false, color = COLORS.BULLET_PLAYER, radius = 4, isCrit = false, type = 'standard') {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.maxRange = maxRange;
    this.distanceTraveled = 0;
    this.pierce = pierce;
    this.piercedCount = 0;
    this.isEnemy = isEnemy;
    this.color = color;
    this.radius = radius;
    this.isCrit = isCrit;
    this.type = type;
    this.hitEnemies.clear();
  }

  update(dt, particlePool) {
    if (!this.active) return;

    const stepDist = Math.hypot(this.vx * dt, this.vy * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.distanceTraveled += stepDist;

    if (this.distanceTraveled >= this.maxRange) {
      this.active = false;
      return;
    }

    // Arena Bulkhead & Perimeter Ricochet Sparks
    if (this.x <= 45 || this.x >= (GAME_CONFIG.ARENA_WIDTH || 3200) - 45 ||
        this.y <= 45 || this.y >= (GAME_CONFIG.ARENA_HEIGHT || 2400) - 45) {
      if (particlePool) {
        particlePool.spawnStarburst(this.x, this.y, this.color, 10);
        particlePool.burst(this.x, this.y, this.color, 5, 140, 1.2);
      }
      this.active = false;
      return;
    }

    if (particlePool && Math.random() < 0.25) {
      particlePool.spawn(
        this.x,
        this.y,
        -this.vx * 0.04 + (Math.random() - 0.5) * 10,
        -this.vy * 0.04 + (Math.random() - 0.5) * 10,
        this.radius * 0.6,
        this.color,
        0.12,
        0.9,
        'spark'
      );
    }
  }

  draw(ctx) {
    if (!this.active || !isFinite(this.x) || !isFinite(this.y)) return;

    // Fast glow halo via cached sprite
    glowCache.drawGlow(ctx, this.x, this.y, this.radius * (this.isCrit ? 1.6 : 1.2), this.color, 0.7);

    ctx.save();
    try {
      ctx.fillStyle = this.color;

      const angle = (isFinite(this.vx) && isFinite(this.vy)) ? Math.atan2(this.vy, this.vx) : 0;
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);

      if (this.isEnemy) {
        // Enemy projectile: Pulsing spherical energy orb
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, this.radius), 0, Math.PI * 2);
        ctx.fill();

        // Corrupted center
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.5, this.radius * 0.45), 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Player projectile: Sleek glowing rounded plasma energy bolt
        const length = Math.max(1, (this.radius || 4) * 2.2);
        const r = Math.max(1, this.radius || 4);

        if (isFinite(length) && isFinite(r)) {
          // Soft trailing plasma bloom
          const tailGrad = ctx.createLinearGradient(-length * 1.2, 0, r, 0);
          tailGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
          tailGrad.addColorStop(0.6, this.color);
          tailGrad.addColorStop(1, '#ffffff');

          ctx.fillStyle = tailGrad;
          ctx.beginPath();
          ctx.ellipse(0, 0, length, r, 0, 0, Math.PI * 2);
          ctx.fill();

          // Brilliant white-hot circular core
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(r * 0.3, 0, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } finally {
      ctx.restore();
    }
  }
}

export class BulletPool {
  constructor(maxBullets = 700) {
    this.pool = [];
    for (let i = 0; i < maxBullets; i++) {
      this.pool.push(new Bullet());
    }
  }

  spawn(x, y, angle, speed, damage, maxRange, pierce = 1, isEnemy = false, color = COLORS.BULLET_PLAYER, radius = 4, isCrit = false, type = 'standard') {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].reset(x, y, angle, speed, damage, maxRange, pierce, isEnemy, color, radius, isCrit, type);
        return this.pool[i];
      }
    }
    return null;
  }

  update(dt, particlePool) {
    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt, particlePool);
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
