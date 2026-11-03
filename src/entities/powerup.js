// NEON HAVOC — Arena Power-up Pickups

import { POWERUP_TYPES } from '../constants.js';
import { glowCache } from '../glowCache.js';

export class Powerup {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.type = null;
    this.radius = 16;
    this.life = 30.0; // 30s before expiring
    this.animTimer = 0;
  }

  reset(x, y, powerupType) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.type = powerupType;
    this.life = 25.0;
    this.animTimer = Math.random() * Math.PI * 2;
  }

  update(dt, playerX, playerY, onCollect) {
    if (!this.active) return;
    this.animTimer += dt * 4;
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }

    // Proximity check with player
    const dist = Math.hypot(playerX - this.x, playerY - this.y);
    if (dist < this.radius + 18) {
      this.active = false;
      onCollect(this.type, this.x, this.y);
    }
  }

  draw(ctx) {
    if (!this.active) return;
    const pulse = 1 + Math.sin(this.animTimer) * 0.15;
    const r = this.radius * pulse;

    ctx.save();
    glowCache.drawGlow(ctx, this.x, this.y, r * 1.6, this.type.color, 0.85);

    // Glowing outer ring
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, r - 2, 0, Math.PI * 2);
    ctx.fill();

    // Emoji icon in center
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.type.icon, this.x, this.y + 1);

    ctx.restore();
  }
}

export class PowerupManager {
  constructor(maxPowerups = 20) {
    this.pool = [];
    for (let i = 0; i < maxPowerups; i++) {
      this.pool.push(new Powerup());
    }
    this.spawnTimer = 0;
    this.spawnInterval = 28.0; // Random arena drop every 28s
  }

  spawn(x, y, type = null) {
    const keys = Object.keys(POWERUP_TYPES);
    const chosenType = type || POWERUP_TYPES[keys[Math.floor(Math.random() * keys.length)]];

    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].reset(x, y, chosenType);
        return this.pool[i];
      }
    }
    return null;
  }

  update(dt, playerX, playerY, onCollect) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // Spawn random powerup near player arena view
      const angle = Math.random() * Math.PI * 2;
      const dist = 350 + Math.random() * 300;
      this.spawn(playerX + Math.cos(angle) * dist, playerY + Math.sin(angle) * dist);
    }

    for (let i = 0; i < this.pool.length; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt, playerX, playerY, onCollect);
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

