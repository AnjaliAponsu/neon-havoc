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
    const bob = Math.sin(this.animTimer * 1.5) * 5;
    const s = (this.radius || 17) * pulse;
    const px = this.x;
    const py = this.y + bob;

    ctx.save();
    // Luscious neon aura
    glowCache.drawGlow(ctx, px, py, s * 2.2, this.type.color, 0.85);

    ctx.translate(px, py);

    // 3D Isometric Cube Dimensions
    const dx = s * 0.866; // cos(30 deg)
    const dy = s * 0.5;   // sin(30 deg)
    const h = s * 1.15;

    // Ground Drop-Shadow with soft colored bounce underneath
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, dy * 2 + 14 - bob * 0.8, dx * 1.05, dy * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    glowCache.drawGlow(ctx, 0, dy * 2 + 14 - bob * 0.8, s * 1.3, this.type.color, 0.4);

    // Parametric functions for Left Face & Right Face
    const pLeft = (u, v) => ({
      x: -dx * (1 - u),
      y: -h + dy + u * dy + v * h,
    });
    const pRight = (u, v) => ({
      x: u * dx,
      y: -h + 2 * dy - u * dy + v * h,
    });

    // 1. Face 1: Top Diamond Face
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(dx, -h + dy);
    ctx.lineTo(0, -h + dy * 2);
    ctx.lineTo(-dx, -h + dy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(16, 32, 60, 0.94)';
    ctx.fill();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Top Face Inner Accent Diamond
    ctx.beginPath();
    ctx.moveTo(0, -h + 3.5);
    ctx.lineTo(dx - 5, -h + dy + 1.2);
    ctx.lineTo(0, -h + dy * 2 - 3.5);
    ctx.lineTo(-dx + 5, -h + dy + 1.2);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 2. Face 2: Left Side Face (Primary Isometric Front Face)
    ctx.beginPath();
    ctx.moveTo(-dx, -h + dy);
    ctx.lineTo(0, -h + dy * 2);
    ctx.lineTo(0, dy * 2);
    ctx.lineTo(-dx, dy);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 18, 38, 0.96)';
    ctx.fill();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 3. Face 3: Right Side Face
    ctx.beginPath();
    ctx.moveTo(0, -h + dy * 2);
    ctx.lineTo(dx, -h + dy);
    ctx.lineTo(dx, dy);
    ctx.lineTo(0, dy * 2);
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 12, 28, 0.96)';
    ctx.fill();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // Right Face Inner Accent Border
    const r0 = pRight(0.18, 0.18);
    const r1 = pRight(0.82, 0.18);
    const r2 = pRight(0.82, 0.82);
    const r3 = pRight(0.18, 0.82);
    ctx.beginPath();
    ctx.moveTo(r0.x, r0.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.lineTo(r2.x, r2.y);
    ctx.lineTo(r3.x, r3.y);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 4. Left Face Inner Glowing Square Frame (Matching Reference Image)
    const q0 = pLeft(0.16, 0.16);
    const q1 = pLeft(0.84, 0.16);
    const q2 = pLeft(0.84, 0.84);
    const q3 = pLeft(0.16, 0.84);
    ctx.beginPath();
    ctx.moveTo(q0.x, q0.y);
    ctx.lineTo(q1.x, q1.y);
    ctx.lineTo(q2.x, q2.y);
    ctx.lineTo(q3.x, q3.y);
    ctx.closePath();
    ctx.strokeStyle = this.type.color;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 5. Symbol inside Inner Square Frame (Matching Reference Image)
    if (this.type.id === 'heal' || this.type.id === 'heart' || this.type.icon === '❤️' || this.type.icon === '➕') {
      // Isometric '+' Cross with White Core (Health Crate)
      const drawIsoPoly = (points, fillCol) => {
        ctx.fillStyle = fillCol;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const pt = pLeft(points[i][0], points[i][1]);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
      };

      // Outer cyan cross arms
      const crossOuter = [
        [0.42, 0.26], [0.58, 0.26], [0.58, 0.42], [0.74, 0.42],
        [0.74, 0.58], [0.58, 0.58], [0.58, 0.74], [0.42, 0.74],
        [0.42, 0.58], [0.26, 0.58], [0.26, 0.42], [0.42, 0.42]
      ];
      drawIsoPoly(crossOuter, '#00f0ff');

      // Inner white-hot cross
      const crossInner = [
        [0.46, 0.32], [0.54, 0.32], [0.54, 0.46], [0.68, 0.46],
        [0.68, 0.54], [0.54, 0.54], [0.54, 0.68], [0.46, 0.68],
        [0.46, 0.54], [0.32, 0.54], [0.32, 0.46], [0.46, 0.46]
      ];
      drawIsoPoly(crossInner, '#ffffff');

    } else if (this.type.id === 'boost' || this.type.id === 'overdrive' || this.type.id === 'battery' || this.type.icon === '⏫') {
      // Isometric Double Chevron '⏫' (Buff Crate)
      const drawIsoChevron = (uCenter, vTip, vWing, thick) => {
        const tip = pLeft(uCenter, vTip);
        const lWing = pLeft(uCenter - 0.24, vWing);
        const rWing = pLeft(uCenter + 0.24, vWing);

        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = thick;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(lWing.x, lWing.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(rWing.x, rWing.y);
        ctx.stroke();

        // White core highlight line
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = thick * 0.45;
        ctx.beginPath();
        ctx.moveTo(lWing.x, lWing.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.lineTo(rWing.x, rWing.y);
        ctx.stroke();
      };

      // Lower chevron
      drawIsoChevron(0.5, 0.52, 0.70, 3.2);
      // Upper chevron
      drawIsoChevron(0.5, 0.30, 0.48, 3.2);
    } else {
      // Centered fallback glyph
      const cp = pLeft(0.5, 0.5);
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.type.icon || '⚡', cp.x, cp.y);
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

