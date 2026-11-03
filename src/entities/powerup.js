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
    const pulse = 1 + Math.sin(this.animTimer) * 0.08;
    const bob = Math.sin(this.animTimer * 1.5) * 4;
    const s = (this.radius || 16) * pulse;
    const px = this.x;
    const py = this.y + bob;

    ctx.save();
    glowCache.drawGlow(ctx, px, py, s * 1.8, this.type.color, 0.8);

    ctx.translate(px, py);

    // 3D Isometric Cube Dimensions
    const dx = s * 0.866; // cos(30 deg)
    const dy = s * 0.5;   // sin(30 deg)
    const h = s * 1.1;

    // Face 1: Top Diamond Face
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(dx, -h + dy);
    ctx.lineTo(0, -h + dy * 2);
    ctx.lineTo(-dx, -h + dy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(18, 30, 54, 0.9)';
    ctx.fill();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Face 2: Left Side Face
    ctx.beginPath();
    ctx.moveTo(-dx, -h + dy);
    ctx.lineTo(0, -h + dy * 2);
    ctx.lineTo(0, dy * 2);
    ctx.lineTo(-dx, dy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 18, 36, 0.92)';
    ctx.fill();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Face 3: Right Side Face
    ctx.beginPath();
    ctx.moveTo(0, -h + dy * 2);
    ctx.lineTo(dx, -h + dy);
    ctx.lineTo(dx, dy);
    ctx.lineTo(0, dy * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(14, 24, 46, 0.95)';
    ctx.fill();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Inner glowing symbol on front face
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.5;

    if (this.type.id === 'heal' || this.type.id === 'heart' || this.type.icon === '❤️' || this.type.icon === '➕') {
      // Glowing '+' Cross Emblem (Health Crate)
      const cx = 0;
      const cy = -h * 0.2;
      const cw = 4;
      const cl = 11;
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(cx - cw / 2, cy - cl / 2, cw, cl);
      ctx.fillRect(cx - cl / 2, cy - cw / 2, cl, cw);
    } else if (this.type.id === 'boost' || this.type.id === 'overdrive' || this.type.id === 'multishot') {
      // Glowing '⏫' Double Chevrons (Buff Crate)
      const cx = 0;
      const cy = -h * 0.2;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      // Lower chevron
      ctx.moveTo(-6, cy + 3);
      ctx.lineTo(0, cy - 3);
      ctx.lineTo(6, cy + 3);
      // Upper chevron
      ctx.moveTo(-6, cy - 4);
      ctx.lineTo(0, cy - 10);
      ctx.lineTo(6, cy - 4);
      ctx.stroke();
    } else {
      // Centered Icon / Emoji
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.type.icon || '⚡', 0, -h * 0.2);
    }

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

