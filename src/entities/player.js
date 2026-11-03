// NEON HAVOC — Player Entity (Spark-01)

import { COLORS, GAME_CONFIG, WEAPONS, MULTIPLAYER_CONFIG } from '../constants.js';
import { glowCache } from '../glowCache.js';

export class Player {
  constructor(startX = GAME_CONFIG.ARENA_WIDTH / 2, startY = GAME_CONFIG.ARENA_HEIGHT / 2, metaEffects = {}, id = 1) {
    this.id = id;
    this.name = id === 2 ? 'Nova-02' : 'Spark-01';
    this.active = true;
    this.x = startX;
    this.y = startY;
    this.radius = 16;
    this.collisionRadius = 14;
    this.coreColor = id === 2 ? (COLORS.PLAYER2_CORE || '#ffffff') : COLORS.PLAYER_CORE;
    this.glowColor = id === 2 ? (COLORS.PLAYER2_GLOW || '#ff00aa') : COLORS.PLAYER_GLOW;
    this.trailColor = id === 2 ? (COLORS.PLAYER2_TRAIL || 'rgba(255, 0, 170, 0.4)') : COLORS.PLAYER_TRAIL;
    this.shieldColor = id === 2 ? (COLORS.PLAYER2_SHIELD || '#ff44bb') : COLORS.PLAYER_SHIELD;
    this.overdriveColor = id === 2 ? (COLORS.PLAYER2_OVERDRIVE || '#ffea00') : COLORS.PLAYER_OVERDRIVE;

    // Co-op Revival & Downed States
    this.isDowned = false;
    this.downedTimer = 0;
    this.reviveProgress = 0;
    this.isRevivingTeammate = false;

    // Movement & Physics
    this.vx = 0;
    this.vy = 0;
    this.baseSpeed = 310 * (1 + (metaEffects.speedBonus || 0));
    this.friction = 0.88;
    this.aimAngle = 0;

    // Remote Netcode dead reckoning
    this.isRemote = false;
    this.targetNetX = startX;
    this.targetNetY = startY;
    this.targetNetVx = 0;
    this.targetNetVy = 0;

    // Health & Shields
    this.maxHealth = 100 + (metaEffects.maxHealthBonus || 0);
    this.health = this.maxHealth;
    this.maxShield = 0;
    this.shield = 0;
    this.hasShieldUpgrade = false;
    this.shieldRegenTimer = 0;
    this.invulnerableTimer = 0;

    // Level & XP
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 50;

    // Weapons Unlocked
    this.weapons = {
      pistol: true,
      shotgun: false,
      lightning: false,
      orbital: false,
      beam: false,
      evoRailgun: false,
      evoSupernova: false,
      evoStormWeb: false,
      evoVortex: false,
    };
    this.orbitalDrones = 0;
    this.orbitalAngle = 0;

    // Weapon Timers
    this.fireTimer = 0;
    this.shotgunTimer = 0;
    this.lightningTimer = 0;
    this.beamTimer = 0;

    // Powerup Timers
    this.chronoFreezeTimer = 0;
    this.invulnPowerupTimer = 0;

    // Combat Stats Modifiers
    this.stats = {
      fireRateMult: 1.0,
      damageMult: 1.0 + (metaEffects.damageBonus || 0),
      moveSpeedMult: 1.0,
      extraProjectiles: 0,
      extraPierce: 0,
      critChance: 0.08,
      magnetRadius: 130 * (1 + (metaEffects.magnetBonus || 0)),
      dashCdMult: 1.0 - (metaEffects.dashCdBonus || 0),
      shockwaveRadiusMult: 1.0,
      shockwaveDamageMult: 1.0,
      overdriveDuration: 6.0,
      overdriveChargeRate: 1.0,
    };

    // Abilities Cooldowns & States
    this.isDashing = false;
    this.dashDuration = 0.22;
    this.dashTimer = 0;
    this.dashCooldown = 2.4 * this.stats.dashCdMult;
    this.dashCdTimer = 0;
    this.dashCharges = 1 + (metaEffects.extraDashes || 0);
    this.maxDashCharges = 1 + (metaEffects.extraDashes || 0);
    this.dashChargeRechargeTimer = 0;

    this.isShieldActive = false;
    this.shieldDuration = 4.0;
    this.shieldTimer = 0;
    this.shieldCooldown = 12.0;
    this.shieldCdTimer = 0;

    this.shockwaveCooldown = 8.0;
    this.shockwaveCdTimer = 0;

    this.overdriveCharge = 0; // 0..100
    this.isOverdrive = false;
    this.overdriveTimer = 0;

    // Visual trails
    this.trailPositions = [];
    this.pulseAnim = 0;
  }

  update(dt, input, soundEngine, particlePool, floatingTexts) {
    this.pulseAnim += dt * 6;

    // Powerup Timers (always count down)
    if (this.chronoFreezeTimer > 0) this.chronoFreezeTimer -= dt;
    if (this.invulnPowerupTimer > 0) this.invulnPowerupTimer -= dt;

    // Downed Core Simulation
    if (this.isDowned) {
      this.vx *= 0.85;
      this.vy *= 0.85;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.downedTimer > 0) {
        this.downedTimer -= dt;
      }
      return;
    }

    // 1. Dash Recharge logic
    if (this.dashCharges < this.maxDashCharges) {
      this.dashChargeRechargeTimer += dt;
      if (this.dashChargeRechargeTimer >= this.dashCooldown * this.stats.dashCdMult) {
        this.dashCharges++;
        this.dashChargeRechargeTimer = 0;
      }
    }

    // Cooldown clocks
    if (this.shieldCdTimer > 0) this.shieldCdTimer -= dt;
    if (this.shockwaveCdTimer > 0) this.shockwaveCdTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;
    if (this.chronoFreezeTimer > 0) this.chronoFreezeTimer -= dt;
    if (this.invulnPowerupTimer > 0) this.invulnPowerupTimer -= dt;

    // Shield active timer
    if (this.isShieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.isShieldActive = false;
      }
    }

    // Shield passive regeneration if upgrade unlocked
    if (this.hasShieldUpgrade && this.shield < this.maxShield) {
      this.shieldRegenTimer += dt;
      if (this.shieldRegenTimer >= 4.0) {
        this.shield = Math.min(this.maxShield, this.shield + 8 * dt);
      }
    }

    // Low Health audio state sync
    const isLowHp = this.health / this.maxHealth < 0.35;
    soundEngine.setLowHealth(isLowHp);

    // Overdrive active timer & solar kinetic pulses
    if (this.isOverdrive) {
      this.overdriveTimer -= dt;
      this.overdrivePulseTimer = (this.overdrivePulseTimer || 0) + dt;
      if (this.overdrivePulseTimer >= 0.85) {
        this.overdrivePulseTimer = 0;
        particlePool.spawnShockwave(this.x, this.y, '#ff0077', 160);
      }
      // Overdrive particle sparks
      if (Math.random() < 0.6) {
        particlePool.spawn(
          this.x + (Math.random() - 0.5) * 40,
          this.y + (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          4,
          COLORS.PLAYER_OVERDRIVE,
          0.3,
          0.9,
          'spark',
          18
        );
      }
      if (this.overdriveTimer <= 0) {
        this.isOverdrive = false;
        this.overdriveCharge = 0;
      }
    }

    // 2. Dash Execution
    if (input.consumeDash() && this.dashCharges > 0 && !this.isDashing) {
      this.dashCharges--;
      this.isDashing = true;
      this.dashTimer = this.dashDuration;
      soundEngine.playDash();

      // Dash burst in movement direction or facing angle (strictly guarded against NaN)
      const moveLen = Math.hypot(input.moveX || 0, input.moveY || 0);
      const rawAim = (input && input.aimAngle !== undefined && !isNaN(input.aimAngle)) ? input.aimAngle : (this.aimAngle || 0);
      const dashAngle = (moveLen > 0.1 && !isNaN(moveLen)) ? Math.atan2(input.moveY, input.moveX) : rawAim;
      const dashSpeed = 950;
      this.vx = Math.cos(dashAngle) * dashSpeed;
      this.vy = Math.sin(dashAngle) * dashSpeed;
      if (!isFinite(this.vx) || isNaN(this.vx)) this.vx = 0;
      if (!isFinite(this.vy) || isNaN(this.vy)) this.vy = 0;

      particlePool.spawnShockwave(this.x, this.y, '#00ffff', 90);
    }

    if (this.isDashing) {
      this.dashTimer -= dt;
      // Electric trail
      particlePool.spawn(
        this.x,
        this.y,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        5,
        '#70e0ff',
        0.25,
        0.9,
        'spark',
        14
      );
      if (this.dashTimer <= 0) {
        this.isDashing = false;
      }
    } else if (this.isRemote) {
      // Remote network interpolation with dead reckoning (ultra-smooth 60/120fps)
      const snapDist = Math.hypot(this.targetNetX - this.x, this.targetNetY - this.y);
      if (snapDist > 250) {
        this.x = isFinite(this.targetNetX) ? this.targetNetX : this.x;
        this.y = isFinite(this.targetNetY) ? this.targetNetY : this.y;
      } else {
        const lerpFactor = Math.min(1.0, dt * 20);
        if (isFinite(this.targetNetX)) this.x += (this.targetNetX - this.x) * lerpFactor;
        if (isFinite(this.targetNetY)) this.y += (this.targetNetY - this.y) * lerpFactor;
      }
      this.vx = isFinite(this.targetNetVx) ? this.targetNetVx : 0;
      this.vy = isFinite(this.targetNetVy) ? this.targetNetVy : 0;
    } else {
      // Normal local movement
      const speed = this.baseSpeed * (this.stats.moveSpeedMult || 1.0) * (this.isOverdrive ? 1.45 : 1.0) * (this.invulnPowerupTimer > 0 ? 1.75 : 1.0);
      const targetVx = (input.moveX || 0) * speed;
      const targetVy = (input.moveY || 0) * speed;

      this.vx += (targetVx - this.vx) * 0.22;
      this.vy += (targetVy - this.vy) * 0.22;
      if (!isFinite(this.vx) || isNaN(this.vx)) this.vx = 0;
      if (!isFinite(this.vy) || isNaN(this.vy)) this.vy = 0;
    }

    // Apply movement (Local players only; remote position is directly interpolated above)
    if (!this.isRemote) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // Guard against non-finite corruption
    if (!isFinite(this.x) || isNaN(this.x)) this.x = GAME_CONFIG.ARENA_WIDTH / 2;
    if (!isFinite(this.y) || isNaN(this.y)) this.y = GAME_CONFIG.ARENA_HEIGHT / 2;

    // Arena boundary clamp
    const pad = this.radius + 20;
    this.x = Math.max(pad, Math.min(GAME_CONFIG.ARENA_WIDTH - pad, this.x));
    this.y = Math.max(pad, Math.min(GAME_CONFIG.ARENA_HEIGHT - pad, this.y));

    // Aim angle
    if (!this.isRemote && input && input.aimAngle !== undefined) {
      this.aimAngle = input.aimAngle;
    }

    // Orbital rotation
    if (this.weapons.orbital) {
      this.orbitalAngle += dt * 3.5;
    }

    // Save trail history
    this.trailPositions.unshift({ x: this.x, y: this.y, isDash: this.isDashing });
    if (this.trailPositions.length > 8) {
      this.trailPositions.pop();
    }

    // 3. Abilities Triggers
    // [E] Shield
    if (input.consumeShield() && this.shieldCdTimer <= 0) {
      this.isShieldActive = true;
      this.shieldTimer = this.shieldDuration;
      this.shieldCdTimer = this.shieldCooldown;
      soundEngine.playShield();
      floatingTexts.spawn(this.x, this.y - 20, 'AEGIS BARRIER!', '#00f0ff', '#00f0ff', true);
      particlePool.spawnShockwave(this.x, this.y, '#00d4ff', 120);
    }

    // [R] Shockwave
    if (input.consumeShockwave() && this.shockwaveCdTimer <= 0) {
      this.shockwaveCdTimer = this.shockwaveCooldown;
      this.triggerShockwave(soundEngine, particlePool, floatingTexts);
    }

    // [Space] Overdrive
    if (input.consumeOverdrive() && this.overdriveCharge >= 100 && !this.isOverdrive) {
      this.isOverdrive = true;
      this.overdriveTimer = this.stats.overdriveDuration;
      soundEngine.playOverdrive();
      floatingTexts.spawn(this.x, this.y - 30, 'SPECTRUM OVERDRIVE!', '#ff0077', '#ff0077', true, 20);
      particlePool.spawnShockwave(this.x, this.y, '#ff0077', 260);
    }
  }

  triggerShockwave(soundEngine, particlePool, floatingTexts) {
    soundEngine.playShockwave();
    floatingTexts.spawn(this.x, this.y - 20, 'SHOCKWAVE!', '#00ffff', '#00ffff', true, 16);
    const radius = 280 * this.stats.shockwaveRadiusMult;
    particlePool.spawnShockwave(this.x, this.y, '#00ffff', radius);
    this.shockwaveTriggered = {
      x: this.x,
      y: this.y,
      radius,
      damage: 120 * this.stats.shockwaveDamageMult * this.stats.damageMult,
    };
  }

  takeDamage(amount, soundEngine, particlePool, floatingTexts, isCoop = false) {
    if (this.isDowned) return 0;
    if (this.isDashing || this.isShieldActive || this.invulnerableTimer > 0 || this.invulnPowerupTimer > 0 || this.isOverdrive) return 0;

    let remaining = amount;
    this.shieldRegenTimer = 0; // reset passive regen

    if (this.shield > 0) {
      if (this.shield >= remaining) {
        this.shield -= remaining;
        remaining = 0;
      } else {
        remaining -= this.shield;
        this.shield = 0;
        soundEngine.playShield();
        floatingTexts.spawn(this.x, this.y - 15, 'SHIELD BREAK', '#00e5ff', '#00e5ff');
      }
    }

    if (remaining > 0) {
      this.health -= remaining;
      this.invulnerableTimer = 0.35; // Brief i-frames
      soundEngine.playEnemyPop(0.7);
      particlePool.burst(this.x, this.y, '#ff0055', 12, 180, 3);
      floatingTexts.spawn(this.x, this.y, `-${Math.round(remaining)}`, '#ff2255', '#ff003c', false, 16);

      if (this.health <= 0 && isCoop) {
        this.health = 0;
        this.isDowned = true;
        this.downedTimer = MULTIPLAYER_CONFIG.DOWNED_TIMEOUT;
        this.reviveProgress = 0;
        floatingTexts.spawn(this.x, this.y - 25, `${this.name} DOWNED!`, '#ff0055', '#ffffff', true, 18);
        soundEngine.playEnemyExplosion();
      }
    }

    return remaining;
  }

  revive(soundEngine, particlePool, floatingTexts) {
    this.isDowned = false;
    this.health = Math.round(this.maxHealth * 0.45);
    this.invulnerableTimer = 2.5;
    this.reviveProgress = 0;
    particlePool.spawnShockwave(this.x, this.y, this.glowColor, 220);
    floatingTexts.spawn(this.x, this.y - 25, `${this.name} REVIVED!`, '#00ff88', '#ffffff', true, 20);
    soundEngine.playShield();
  }

  addXp(amount, soundEngine, floatingTexts) {
    this.xp += amount;
    // Overdrive charge gained
    if (!this.isOverdrive) {
      this.overdriveCharge = Math.min(100, this.overdriveCharge + amount * 0.18 * this.stats.overdriveChargeRate);
    }

    let leveledUp = false;
    let loopGuard = 0;
    while (this.xp >= this.xpToNextLevel && loopGuard < 20) {
      loopGuard++;
      this.xp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.max(30, Math.floor(this.xpToNextLevel * 1.35 + 25));
      leveledUp = true;
    }

    if (leveledUp) {
      soundEngine.playLevelUp();
      floatingTexts.spawn(this.x, this.y - 30, `LEVEL UP! [${this.level}]`, '#ffe600', '#ffaa00', true, 18);
    }

    return leveledUp;
  }

  draw(ctx) {
    if (this.isDowned) {
      this._drawDownedCore(ctx);
      return;
    }

    ctx.save();

    // 1. Motion Trail & Chromatic Dash Afterimages
    for (let i = 0; i < this.trailPositions.length; i++) {
      const pos = this.trailPositions[i];
      const isDashing = pos.isDash || this.isOverdrive;
      const alpha = (1 - (i + 1) / (this.trailPositions.length + 1)) * (isDashing ? 0.8 : 0.45);
      const size = this.radius * (1 - i * 0.07);

      if (isDashing) {
        // RGB split ghost colors
        const ghostColors = ['#00f0ff', '#ff00aa', '#ffe600', '#70e0ff'];
        const ghostColor = ghostColors[i % ghostColors.length];
        glowCache.drawGlow(ctx, pos.x, pos.y, size * 1.5, ghostColor, alpha * 0.7);
        ctx.fillStyle = ghostColor;
      } else {
        ctx.fillStyle = this.trailColor || this.glowColor;
      }

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1.0;

    // 2. Overdrive Solar Corona & Flare Discharges
    if (this.isOverdrive) {
      const odColor = this.overdriveColor || COLORS.PLAYER_OVERDRIVE;
      const odPulse = 1 + Math.sin(this.pulseAnim * 2) * 0.18;
      const odR = (this.radius + 14) * odPulse;
      glowCache.drawGlow(ctx, this.x, this.y, odR * 1.6, odColor, 0.95);

      // Rotating Solar Corona Flame Petals
      const flames = 8;
      ctx.fillStyle = odColor;
      for (let f = 0; f < flames; f++) {
        const fa = this.pulseAnim * 2.5 + (f * Math.PI * 2) / flames;
        const flen = odR * (1.25 + Math.sin(this.pulseAnim * 4 + f) * 0.25);
        const fx = this.x + Math.cos(fa) * flen;
        const fy = this.y + Math.sin(fa) * flen;
        ctx.beginPath();
        ctx.arc(fx, fy, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = odColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, odR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Active Aegis Barrier or Invulnerability Powerup
    if (this.invulnPowerupTimer > 0) {
      // Dual-pass glow ring
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.35)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 18, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 255, 136, 0.2)';
      ctx.fill();
    } else if (this.isShieldActive) {
      const sColor = this.shieldColor || '#00f0ff';
      ctx.strokeStyle = sColor;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 16, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fill();
    }

    // 4. Player Core Sphere (Clean, Radiant Energy Orb — Unobstructed by UI overlays)
    const currentRadius = this.isOverdrive ? this.radius * 1.5 : this.radius;
    const pulse = 1 + Math.sin(this.pulseAnim) * 0.08;
    const auraColor = this.isOverdrive ? (this.overdriveColor || COLORS.PLAYER_OVERDRIVE) : this.glowColor;

    // Fast Glow Cache Aura
    glowCache.drawGlow(ctx, this.x, this.y, currentRadius * 2.2, auraColor, 0.85);

    // Player body
    ctx.fillStyle = auraColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius * pulse, 0, Math.PI * 2);
    ctx.fill();

    // White-hot core
    ctx.fillStyle = this.coreColor || '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, currentRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Invulnerability / Shield Shimmer (During I-Frames)
    if (this.invulnerableTimer > 0) {
      const shimPulse = 0.5 + Math.sin(this.pulseAnim * 4) * 0.5;
      ctx.strokeStyle = `rgba(255, 230, 0, ${0.5 + shimPulse * 0.45})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, currentRadius * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 5. Orbital Drones
    if (this.weapons.orbital && this.orbitalDrones > 0) {
      const droneDist = 65;
      for (let i = 0; i < this.orbitalDrones; i++) {
        const angle = this.orbitalAngle + (i * Math.PI * 2) / this.orbitalDrones;
        const ox = this.x + Math.cos(angle) * droneDist;
        const oy = this.y + Math.sin(angle) * droneDist;

        glowCache.drawGlow(ctx, ox, oy, 14, '#00ffea', 0.8);

        ctx.fillStyle = '#00ffea';
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ox, oy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _drawDownedCore(ctx) {
    ctx.save();
    const pulse = 0.8 + Math.sin(this.pulseAnim * 3) * 0.2;
    const coreR = 20;

    // Warning distress radius beacon
    ctx.strokeStyle = 'rgba(255, 0, 85, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, MULTIPLAYER_CONFIG.REVIVE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Downed core glow
    glowCache.drawGlow(ctx, this.x, this.y, coreR * 2.5, '#ff0055', 0.95);

    // Core body (pulsing distressed red/orange)
    ctx.fillStyle = '#ff2255';
    ctx.beginPath();
    ctx.arc(this.x, this.y, coreR * pulse, 0, Math.PI * 2);
    ctx.fill();

    // White core fragment
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, coreR * 0.45, 0, Math.PI * 2);
    ctx.fill();

    // Circular Revive Progress Gauge
    if (this.reviveProgress > 0) {
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, coreR + 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.reviveProgress);
      ctx.stroke();
    }

    // Name & Timer Text
    const text = `${this.name} [DOWN: ${Math.ceil(this.downedTimer)}s]`;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff2255';
    ctx.fillText(text, this.x, this.y - 20);

    ctx.restore();
  }
}

