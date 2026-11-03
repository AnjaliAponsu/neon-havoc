// NEON HAVOC — Tactical Arena Hazards & Energy Pylons

import { GAME_CONFIG } from '../constants.js';
import { glowCache } from '../glowCache.js';

export class EnergyPylon {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 28;
    this.maxHealth = 150;
    this.health = this.maxHealth;
    this.active = true;
    this.respawnTimer = 0;
    this.animTimer = Math.random() * Math.PI * 2;
    this.flashTimer = 0;
  }

  takeDamage(amount) {
    if (!this.active) return 0;
    this.health -= amount;
    this.flashTimer = 0.1;
    if (this.health <= 0) {
      this.active = false;
      this.respawnTimer = 45.0; // Respawns after 45s
      return 999; // Trigger explosion
    }
    return amount;
  }

  update(dt) {
    this.animTimer += dt * 3;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    if (!this.active) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.active = true;
        this.health = this.maxHealth;
      }
    }
  }

  draw(ctx) {
    if (!this.active || !isFinite(this.x) || !isFinite(this.y)) return;
    const pulse = 1 + Math.sin(this.animTimer) * 0.08;
    const r = Math.max(1, (this.radius || 28) * pulse);

    ctx.save();
    try {
      glowCache.drawGlow(ctx, this.x, this.y, r * 1.5, '#00f0ff', 0.85);

      // Outer hexagonal core
      ctx.strokeStyle = this.flashTimer > 0 ? '#ffffff' : '#00f0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + this.animTimer * 0.2;
        const hx = this.x + Math.cos(a) * r;
        const hy = this.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.stroke();

      // Inner glowing power crystal
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Health ring
      const hpPct = Math.max(0, this.health / (this.maxHealth || 150));
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hpPct);
      ctx.stroke();
    } finally {
      ctx.restore();
    }
  }
}

export class HazardManager {
  constructor() {
    this.pylons = [];
  }

  setup(sector) {
    this.pylons = [];
    const count = sector.pylonCount || 6;
    const padding = 350;

    // Distribute around arena quadrants
    for (let i = 0; i < count; i++) {
      const px = padding + Math.random() * (GAME_CONFIG.ARENA_WIDTH - padding * 2);
      const py = padding + Math.random() * (GAME_CONFIG.ARENA_HEIGHT - padding * 2);
      this.pylons.push(new EnergyPylon(px, py));
    }
  }

  update(dt, bulletPool, enemies, soundEngine, particlePool, floatingTexts) {
    for (let i = 0; i < this.pylons.length; i++) {
      const p = this.pylons[i];
      p.update(dt);

      if (!p.active) continue;

      // Check bullet collisions
      for (let b = 0; b < bulletPool.pool.length; b++) {
        const bullet = bulletPool.pool[b];
        if (!bullet.active || bullet.isEnemy) continue;

        const dist = Math.hypot(p.x - bullet.x, p.y - bullet.y);
        if (dist < p.radius + bullet.radius) {
          bullet.active = false;
          const result = p.takeDamage(bullet.damage);

          if (result === 999) {
            // Overcharged Nova Explosion!
            this._detonatePylon(p, enemies, soundEngine, particlePool, floatingTexts);
          }
          break;
        }
      }
    }
  }

  _detonatePylon(pylon, enemies, soundEngine, particlePool, floatingTexts) {
    soundEngine.playShockwave();
    particlePool.spawnShockwave(pylon.x, pylon.y, '#00ffff', 360);
    particlePool.burst(pylon.x, pylon.y, '#00f0ff', 60, 450, 5);

    floatingTexts.spawn(pylon.x, pylon.y - 30, 'OVERCHARGED NOVA!', '#00f0ff', '#00f0ff', true, 20);

    const blastRadius = 380;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.isDead) continue;
      const d = Math.hypot(e.x - pylon.x, e.y - pylon.y);
      if (d < blastRadius) {
        e.takeDamage(180, soundEngine, particlePool, floatingTexts, true);
        e.applyKnockback(Math.atan2(e.y - pylon.y, e.x - pylon.x), 80);
      }
    }
  }

  draw(ctx) {
    for (let i = 0; i < this.pylons.length; i++) {
      this.pylons[i].draw(ctx);
    }
  }
}

