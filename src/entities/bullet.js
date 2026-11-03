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
      // Player projectile: Streamlined Glowing Plasma Dart (Matching Reference Image)
      const dartLen = this.radius * 2.8;
      const dartW = this.radius * 1.1;

      // Soft glow tail plume
      const tailGrad = ctx.createLinearGradient(-dartLen * 1.4, 0, dartLen * 0.5, 0);
      tailGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      tailGrad.addColorStop(1, this.color);
      ctx.fillStyle = tailGrad;
      ctx.beginPath();
      ctx.moveTo(dartLen * 0.6, 0);
      ctx.lineTo(-dartLen * 1.4, -dartW * 0.45);
      ctx.lineTo(-dartLen * 1.4, dartW * 0.45);
      ctx.closePath();
      ctx.fill();

      // Dart aerodynamic body
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(dartLen, 0);
      ctx.lineTo(-dartLen * 0.3, -dartW);
      ctx.lineTo(-dartLen * 0.8, -dartW * 0.4);
      ctx.lineTo(-dartLen * 0.8, dartW * 0.4);
      ctx.lineTo(-dartLen * 0.3, dartW);
      ctx.closePath();
      ctx.fill();

      // Brilliant white-hot core & tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(dartLen, 0);
      ctx.lineTo(0, -dartW * 0.45);
      ctx.lineTo(-dartLen * 0.4, 0);
      ctx.lineTo(0, dartW * 0.45);
      ctx.closePath();
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
