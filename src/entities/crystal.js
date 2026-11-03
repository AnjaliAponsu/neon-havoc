// NEON HAVOC — Spectrum Crystal Collectibles (30x Speedup with GlowCache)

import { COLORS } from '../constants.js';
import { glowCache } from '../glowCache.js';

export class Crystal {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.value = 10;
    this.radius = 5;
    this.color = COLORS.XP_CRYSTAL;
    this.pulseTimer = Math.random() * Math.PI * 2;
    this.magnetized = false;
  }

  reset(x, y, value = 10) {
    this.active = true;
    this.x = x;
    this.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 40;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;

    this.value = value;
    this.magnetized = false;
    this.pulseTimer = Math.random() * Math.PI * 2;

    if (value >= 100) {
      this.color = COLORS.XP_CRYSTAL_LARGE;
      this.radius = 8;
    } else if (value >= 30) {
      this.color = COLORS.XP_CRYSTAL_MED;
      this.radius = 6.5;
    } else {
      this.color = COLORS.XP_CRYSTAL;
      this.radius = 5;
    }
  }

  update(dt, playerX, playerY, magnetRadius) {
    if (!this.active) return false;

    this.pulseTimer += dt * 4;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < magnetRadius * magnetRadius) {
      this.magnetized = true;
    }

    if (this.magnetized) {
      const dist = Math.sqrt(distSq);
      if (dist < 20) {
        this.active = false;
        return true;
      }
      const pullSpeed = 520 + (1 - Math.min(1, dist / 800)) * 700;
      this.vx = (dx / dist) * pullSpeed;
      this.vy = (dy / dist) * pullSpeed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.92;
      this.vy *= 0.92;
    }

    return false;
  }

  draw(ctx) {
    if (!this.active || !isFinite(this.x) || !isFinite(this.y)) return;

    const pulse = 1 + Math.sin(this.pulseTimer) * 0.12;
    const r = Math.max(1, (this.radius || 5) * pulse);

    // Fast glow via cached sprite (warm golden aura)
    glowCache.drawGlow(ctx, this.x, this.y, r * 1.6, '#ffe600', 0.65);

    ctx.save();
    try {
      // 1. Faceted Golden Diamond Geometry (Matching Reference Image)
      // Left highlight facet
      ctx.fillStyle = '#fff176';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - r * 1.35);
      ctx.lineTo(this.x - r, this.y);
      ctx.lineTo(this.x, this.y + r * 1.35);
      ctx.closePath();
      ctx.fill();

      // Right shaded facet
      ctx.fillStyle = '#ffaa00';
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - r * 1.35);
      ctx.lineTo(this.x + r, this.y);
      ctx.lineTo(this.x, this.y + r * 1.35);
      ctx.closePath();
      ctx.fill();

      // Sharp diamond facet border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y - r * 1.35);
      ctx.lineTo(this.x + r, this.y);
      ctx.lineTo(this.x, this.y + r * 1.35);
      ctx.lineTo(this.x - r, this.y);
      ctx.closePath();
      ctx.stroke();

      // Gleaming center spark
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x - r * 0.15, this.y - r * 0.25, Math.max(0.5, r * 0.28), 0, Math.PI * 2);
      ctx.fill();
    } finally {
      ctx.restore();
    }
  }
}

export class CrystalPool {
  constructor(maxCrystals = 500) {
    this.pool = [];
    for (let i = 0; i < maxCrystals; i++) {
      this.pool.push(new Crystal());
    }
  }

  spawn(x, y, value = 10) {
    for (let i = 0; i < this.pool.length; i++) {
      if (!this.pool[i].active) {
        this.pool[i].reset(x, y, value);
        return this.pool[i];
      }
    }
    return null;
  }

  update(dt, playerOrX, playerYOrCollect, magnetRadius, onCollectCb) {
    let playerList = [];
    let onCollect = onCollectCb;

    if (Array.isArray(playerOrX)) {
      playerList = playerOrX.filter(p => p && !p.isDowned);
      onCollect = playerYOrCollect;
    } else if (playerOrX && typeof playerOrX === 'object' && playerOrX.x !== undefined) {
      playerList = [playerOrX];
      onCollect = playerYOrCollect;
    } else {
      // Legacy signature: (dt, playerX, playerY, magnetRadius, onCollect)
      const px = playerOrX;
      const py = playerYOrCollect;
      for (let i = 0; i < this.pool.length; i++) {
        if (this.pool[i].active) {
          const collected = this.pool[i].update(dt, px, py, magnetRadius);
          if (collected && onCollectCb) {
            onCollectCb(this.pool[i]);
          }
        }
      }
      return;
    }

    if (playerList.length === 0) return;

    for (let i = 0; i < this.pool.length; i++) {
      const c = this.pool[i];
      if (!c.active) continue;

      let closestP = playerList[0];
      let minDSq = (closestP.x - c.x) * (closestP.x - c.x) + (closestP.y - c.y) * (closestP.y - c.y);
      for (let pIdx = 1; pIdx < playerList.length; pIdx++) {
        const p = playerList[pIdx];
        const dSq = (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y);
        if (dSq < minDSq) {
          minDSq = dSq;
          closestP = p;
        }
      }

      const collected = c.update(dt, closestP.x, closestP.y, closestP.stats.magnetRadius);
      if (collected && onCollect) {
        onCollect(c, closestP);
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
