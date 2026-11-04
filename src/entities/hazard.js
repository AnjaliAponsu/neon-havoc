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

export class AccelPad {
  constructor(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.width = 48;
    this.height = 36;
    this.animTimer = Math.random() * Math.PI * 2;
    this.cooldown = 0;
  }

  update(dt, player, soundEngine, particlePool, floatingTexts) {
    this.animTimer += dt * 4;
    if (this.cooldown > 0) this.cooldown -= dt;

    if (!player || this.cooldown > 0) return;
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < 34) {
      this.cooldown = 3.2;
      player.boostTimer = 2.4;
      if (soundEngine) soundEngine.playDash();
      if (particlePool) {
        particlePool.spawnShockwave(this.x, this.y, '#00f0ff', 130);
        particlePool.burst(this.x, this.y, '#00ffff', 25, 280, 2);
      }
      if (floatingTexts) {
        floatingTexts.spawn(this.x, this.y - 25, '⚡ TURBO SURGE!', '#00f0ff', '#00f0ff', true, 16);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Floor base plate
    ctx.fillStyle = 'rgba(6, 14, 30, 0.75)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.rect(-this.width / 2, -this.height / 2, this.width, this.height);
    ctx.fill();
    ctx.stroke();

    // Directional chevron arrows pulsing forward
    const phase = (this.animTimer * 1.5) % 1;
    ctx.fillStyle = this.cooldown > 0 ? 'rgba(0, 200, 255, 0.3)' : '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = this.cooldown > 0 ? 0 : 8;

    for (let c = -1; c <= 1; c++) {
      const cx = c * 13 + (phase - 0.5) * 6;
      ctx.beginPath();
      ctx.moveTo(cx - 5, -8);
      ctx.lineTo(cx + 3, 0);
      ctx.lineTo(cx - 5, 8);
      ctx.lineTo(cx - 1, 8);
      ctx.lineTo(cx + 7, 0);
      ctx.lineTo(cx - 1, -8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

export class PlasmaBarrel {
  constructor(x, y, type = 'cryo') {
    this.x = x;
    this.y = y;
    this.type = type; // 'cryo' or 'plasma'
    this.radius = 18;
    this.maxHealth = 40;
    this.health = this.maxHealth;
    this.active = true;
    this.respawnTimer = 0;
    this.flashTimer = 0;
    this.animTimer = Math.random() * Math.PI * 2;
  }

  takeDamage(amount) {
    if (!this.active) return 0;
    this.health -= amount;
    this.flashTimer = 0.12;
    if (this.health <= 0) {
      this.active = false;
      this.respawnTimer = 35.0;
      return 999;
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
    if (!this.active) return;
    const color = this.type === 'cryo' ? '#00f0ff' : '#ff4400';
    ctx.save();
    ctx.translate(this.x, this.y);

    // Floor shadow
    ctx.fillStyle = 'rgba(2, 4, 12, 0.6)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3D Hexagonal Canister Cylinder
    ctx.fillStyle = '#0a1020';
    ctx.beginPath();
    ctx.moveTo(-14, -14); ctx.lineTo(14, -14); ctx.lineTo(14, 10); ctx.lineTo(-14, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = this.flashTimer > 0 ? '#ffffff' : (this.type === 'cryo' ? '#0f2448' : '#3c1008');
    ctx.fillRect(-12, -12, 24, 20);

    // Glowing core reactor window
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Hazard caution rim
    ctx.strokeStyle = '#ffe600';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-14, 6); ctx.lineTo(14, 6);
    ctx.stroke();

    ctx.restore();
  }
}

export class HazardManager {
  constructor() {
    this.pylons = [];
    this.accelPads = [];
    this.barrels = [];
  }

  setup(sector) {
    this.pylons = [];
    this.accelPads = [];
    this.barrels = [];

    const count = sector.pylonCount || 6;
    const padding = 350;

    // Distribute pylons around arena quadrants
    for (let i = 0; i < count; i++) {
      const px = padding + Math.random() * (GAME_CONFIG.ARENA_WIDTH - padding * 2);
      const py = padding + Math.random() * (GAME_CONFIG.ARENA_HEIGHT - padding * 2);
      this.pylons.push(new EnergyPylon(px, py));
    }

    // 4 Strategic Central Accel Boost Pads (Pointing in cardinal combat lanes)
    this.accelPads.push(new AccelPad(1340, 1200, 0));             // Pointing East
    this.accelPads.push(new AccelPad(1860, 1200, Math.PI));       // Pointing West
    this.accelPads.push(new AccelPad(1600, 940, Math.PI / 2));    // Pointing South
    this.accelPads.push(new AccelPad(1600, 1460, -Math.PI / 2));  // Pointing North

    // Strategic Volatile Cryo / Plasma Barrels near Bastion Flanks
    this.barrels.push(new PlasmaBarrel(920, 680, 'cryo'));
    this.barrels.push(new PlasmaBarrel(2280, 1720, 'cryo'));
    this.barrels.push(new PlasmaBarrel(2280, 680, 'plasma'));
    this.barrels.push(new PlasmaBarrel(920, 1720, 'plasma'));
    this.barrels.push(new PlasmaBarrel(1450, 1320, 'cryo'));
    this.barrels.push(new PlasmaBarrel(1750, 1080, 'plasma'));
  }

  update(dt, bulletPool, enemies, soundEngine, particlePool, floatingTexts, player = null, player2 = null) {
    // 1. Update Pylons
    for (let i = 0; i < this.pylons.length; i++) {
      const p = this.pylons[i];
      p.update(dt);
      if (!p.active) continue;

      for (let b = 0; b < bulletPool.pool.length; b++) {
        const bullet = bulletPool.pool[b];
        if (!bullet.active || bullet.isEnemy) continue;

        const dist = Math.hypot(p.x - bullet.x, p.y - bullet.y);
        if (dist < p.radius + bullet.radius) {
          bullet.active = false;
          const result = p.takeDamage(bullet.damage);
          if (result === 999) {
            this._detonatePylon(p, enemies, soundEngine, particlePool, floatingTexts);
          }
          break;
        }
      }
    }

    // 2. Update Accel Boost Pads
    for (let i = 0; i < this.accelPads.length; i++) {
      this.accelPads[i].update(dt, player, soundEngine, particlePool, floatingTexts);
      if (player2 && !player2.isDowned) {
        this.accelPads[i].update(dt, player2, soundEngine, particlePool, floatingTexts);
      }
    }

    // 3. Update Volatile Barrels
    for (let i = 0; i < this.barrels.length; i++) {
      const br = this.barrels[i];
      br.update(dt);
      if (!br.active) continue;

      for (let b = 0; b < bulletPool.pool.length; b++) {
        const bullet = bulletPool.pool[b];
        if (!bullet.active || bullet.isEnemy) continue;

        const dist = Math.hypot(br.x - bullet.x, br.y - bullet.y);
        if (dist < br.radius + bullet.radius) {
          bullet.active = false;
          const result = br.takeDamage(bullet.damage);
          if (result === 999) {
            this._detonateBarrel(br, enemies, soundEngine, particlePool, floatingTexts);
          }
          break;
        }
      }
    }
  }

  _detonateBarrel(barrel, enemies, soundEngine, particlePool, floatingTexts) {
    const isCryo = barrel.type === 'cryo';
    const color = isCryo ? '#00f0ff' : '#ff4400';
    soundEngine.playShockwave();
    particlePool.spawnShockwave(barrel.x, barrel.y, color, 260);
    particlePool.spawnStarburst(barrel.x, barrel.y, '#ffffff', 28);
    particlePool.burst(barrel.x, barrel.y, color, 45, 380, 4);

    floatingTexts.spawn(
      barrel.x, barrel.y - 28,
      isCryo ? '❄️ CRYO RUPTURE!' : '💥 PLASMA DETONATION!',
      color, color, true, 18
    );

    const blastRadius = 260;
    const dmg = isCryo ? 220 : 340;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.isDead) continue;
      const d = Math.hypot(e.x - barrel.x, e.y - barrel.y);
      if (d < blastRadius) {
        e.takeDamage(dmg, soundEngine, particlePool, floatingTexts, true);
        e.applyKnockback(Math.atan2(e.y - barrel.y, e.x - barrel.x), isCryo ? 60 : 120);
        if (isCryo) {
          e.speed = Math.max(20, e.speed * 0.35); // Slow enemy by 65%
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
    // 1. Accel Booster Pads (Floor Layer)
    for (let i = 0; i < this.accelPads.length; i++) {
      this.accelPads[i].draw(ctx);
    }
    // 2. Barrels
    for (let i = 0; i < this.barrels.length; i++) {
      this.barrels[i].draw(ctx);
    }
    // 3. Pylons
    for (let i = 0; i < this.pylons.length; i++) {
      this.pylons[i].draw(ctx);
    }
  }
}

