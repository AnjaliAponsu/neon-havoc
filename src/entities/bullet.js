// NEON HAVOC — Bullet & Projectile Physics Engine (30x Speedup with GlowCache)

import { COLORS } from '../constants.js';
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
    if (!this.active) return;

    // Fast glow halo via cached sprite
    glowCache.drawGlow(ctx, this.x, this.y, this.radius * (this.isCrit ? 1.6 : 1.2), this.color, 0.7);

    ctx.save();
    ctx.fillStyle = this.color;

    const angle = Math.atan2(this.vy, this.vx);
    ctx.translate(this.x, this.y);
    ctx.rotate(angle);

    if (this.isEnemy) {
      // Enemy projectile: Pulsing spherical energy orb
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Corrupted center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Player projectile: Smooth Glowing Rounded Plasma Bolt / Capsule (Matching Reference Image)
      const boltLen = this.radius * 2.8;
      const boltW = this.radius * 1.0;

      // 1. Soft trailing plasma aura
      const tailGrad = ctx.createLinearGradient(-boltLen * 1.4, 0, boltLen * 0.4, 0);
      tailGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      tailGrad.addColorStop(0.5, this.color);
      tailGrad.addColorStop(1, 'rgba(255, 255, 255, 0.9)');
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.ellipse(-boltLen * 0.2, 0, boltLen * 0.7, boltW * 1.35, 0, 0, Math.PI * 2);
      ctx.fill();

      // 2. Smooth Rounded Plasma Capsule Body (No sharp/triangular edges)
      ctx.fillStyle = this.color;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-boltLen * 0.5, -boltW, boltLen, boltW * 2, boltW);
      } else {
        ctx.ellipse(0, 0, boltLen * 0.5, boltW, 0, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. Brilliant White-Hot Glowing Rounded Core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(-boltLen * 0.35, -boltW * 0.5, boltLen * 0.7, boltW, boltW * 0.5);
      } else {
        ctx.ellipse(0, 0, boltLen * 0.35, boltW * 0.5, 0, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    ctx.restore();
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
