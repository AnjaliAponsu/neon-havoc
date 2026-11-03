// NEON HAVOC — 30X Enemy Entities, Elite Champions & Boss AI

import { COLORS, ENEMY_TYPES, GAME_CONFIG } from '../constants.js';
import { glowCache } from '../glowCache.js';
import { spatialGrid } from '../spatialHash.js';

export class Enemy {
  constructor(typeConfig, x, y, waveMultiplier = 1, isElite = false, eliteType = 'swift') {
    this.type = typeConfig.id;
    this.name = typeConfig.name;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = typeConfig.radius;
    this.baseSpeed = typeConfig.speed;
    this.speed = typeConfig.speed * (0.95 + Math.random() * 0.1);
    this.maxHealth = Math.round(typeConfig.health * waveMultiplier);
    this.health = this.maxHealth;
    this.damage = typeConfig.damage;
    this.xp = typeConfig.xp;
    this.score = typeConfig.score;
    this.color = typeConfig.color;
    this.glow = typeConfig.glow;
    this.behavior = typeConfig.behavior;
    this.knockbackResistance = typeConfig.knockbackResistance || 0;
    this.isBoss = typeConfig.isBoss || false;

    // Elite Champion Configuration
    this.isElite = isElite;
    this.eliteType = eliteType;
    this.eliteShield = 0;
    this.mortarTimer = 0;

    if (this.isElite) {
      this.radius *= 1.4;
      this.maxHealth = Math.round(this.maxHealth * 2.8);
      this.health = this.maxHealth;
      this.xp *= 4;
      this.score *= 4;
      this.damage = Math.round(this.damage * 1.5);
      this.knockbackResistance = Math.min(0.9, this.knockbackResistance + 0.35);

      if (this.eliteType === 'shielded') {
        this.eliteShield = Math.round(this.maxHealth * 0.75);
      } else if (this.eliteType === 'swift') {
        this.speed *= 1.6;
      }
    }

    this.active = true;
    this.isDead = false;
    this.flashTimer = 0;
    this.animTimer = Math.random() * Math.PI * 2;

    // Sniper specific
    this.preferredDistance = typeConfig.preferredDistance || 400;
    this.shootTimer = 1.0 + Math.random() * 1.5;
    this.aimingTimer = 0;
    this.isAiming = false;
    this.aimTarget = { x: 0, y: 0 };

    // Exploder specific
    this.fuseTime = typeConfig.fuseTime || 1.2;
    this.fuseTimer = 0;
    this.isExploding = false;
    this.explosionRadius = typeConfig.explosionRadius || 110;

    // Boss specific
    this.bossPhase = 1;
    this.bossAttackTimer = 0;
    this.bossLaserAngle = 0;
    this.bossLaserActive = false;
    this.bossSummonTimer = 0;
    this.singularityTimer = 0;
  }

  update(dt, player, bulletPool, particlePool, soundEngine, floatingTexts, spawnQueue) {
    if (!this.active || this.isDead) return;

    this.animTimer += dt * 5;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // Resolve target player (in co-op, target closest non-downed player)
    let targetPlayer = player;
    if (Array.isArray(player)) {
      const alivePlayers = player.filter(p => !p.isDowned);
      const candidates = alivePlayers.length > 0 ? alivePlayers : player;
      let closest = candidates[0];
      let minD = Math.hypot(this.x - closest.x, this.y - closest.y);
      for (let i = 1; i < candidates.length; i++) {
        const d = Math.hypot(this.x - candidates[i].x, this.y - candidates[i].y);
        if (d < minD) {
          minD = d;
          closest = candidates[i];
        }
      }
      targetPlayer = closest;
    }

    // Chrono Freeze active? Immobilize!
    if (targetPlayer.chronoFreezeTimer > 0) {
      return;
    }

    const dx = targetPlayer.x - this.x;
    const dy = targetPlayer.y - this.y;
    const dist = Math.hypot(dx, dy);
    const angleToPlayer = Math.atan2(dy, dx);

    // --- BEHAVIOR BY TYPE ---

    if (this.type === 'singularity_boss') {
      this._updateSingularityBoss(dt, targetPlayer, dist, angleToPlayer, bulletPool, particlePool, soundEngine, spawnQueue, floatingTexts);
    } else if (this.isBoss) {
      this._updateBoss(dt, targetPlayer, dist, angleToPlayer, bulletPool, particlePool, soundEngine, spawnQueue, floatingTexts);
    } else if (this.behavior === 'rush') {
      this.vx = Math.cos(angleToPlayer) * this.speed;
      this.vy = Math.sin(angleToPlayer) * this.speed;

      // 30X Organic Swarm Separation (Boids Flocking)
      let sepX = 0, sepY = 0;
      spatialGrid.queryNearby(this.x, this.y, 28, (other) => {
        if (other !== this && other.active && !other.isDead && !other.isBoss) {
          const sx = this.x - other.x;
          const sy = this.y - other.y;
          const sDist = Math.hypot(sx, sy);
          if (sDist > 1 && sDist < 28) {
            const force = (1 - sDist / 28) * 55;
            sepX += (sx / sDist) * force;
            sepY += (sy / sDist) * force;
          }
        }
      });
      this.vx += sepX;
      this.vy += sepY;
    } else if (this.behavior === 'fast_dash') {
      const waveOffset = Math.sin(this.animTimer * 2) * 0.45;
      const moveAngle = angleToPlayer + waveOffset;
      this.vx = Math.cos(moveAngle) * this.speed;
      this.vy = Math.sin(moveAngle) * this.speed;

      let sepX = 0, sepY = 0;
      spatialGrid.queryNearby(this.x, this.y, 22, (other) => {
        if (other !== this && other.active && !other.isDead && !other.isBoss) {
          const sx = this.x - other.x;
          const sy = this.y - other.y;
          const sDist = Math.hypot(sx, sy);
          if (sDist > 1 && sDist < 22) {
            const force = (1 - sDist / 22) * 45;
            sepX += (sx / sDist) * force;
            sepY += (sy / sDist) * force;
          }
        }
      });
      this.vx += sepX;
      this.vy += sepY;
    } else if (this.behavior === 'heavy_crush') {
      this.vx = Math.cos(angleToPlayer) * this.speed;
      this.vy = Math.sin(angleToPlayer) * this.speed;
    } else if (this.behavior === 'split_on_death') {
      const moveAngle = angleToPlayer + Math.cos(this.animTimer) * 0.3;
      this.vx = Math.cos(moveAngle) * this.speed;
      this.vy = Math.sin(moveAngle) * this.speed;
    } else if (this.behavior === 'keep_distance_shoot') {
      if (dist < this.preferredDistance - 50) {
        this.vx = -Math.cos(angleToPlayer) * this.speed;
        this.vy = -Math.sin(angleToPlayer) * this.speed;
      } else if (dist > this.preferredDistance + 60) {
        this.vx = Math.cos(angleToPlayer) * this.speed;
        this.vy = Math.sin(angleToPlayer) * this.speed;
      } else {
        const strafeAngle = angleToPlayer + Math.PI / 2;
        this.vx = Math.cos(strafeAngle) * (this.speed * 0.6);
        this.vy = Math.sin(strafeAngle) * (this.speed * 0.6);
      }

      this.shootTimer -= dt;
      if (this.shootTimer <= 0.6 && !this.isAiming) {
        this.isAiming = true;
        this.aimTarget.x = player.x;
        this.aimTarget.y = player.y;
      }

      if (this.isAiming) {
        this.aimTarget.x += (player.x - this.aimTarget.x) * 0.1;
        this.aimTarget.y += (player.y - this.aimTarget.y) * 0.1;
      }

      if (this.shootTimer <= 0) {
        const shootAngle = Math.atan2(this.aimTarget.y - this.y, this.aimTarget.x - this.x);
        bulletPool.spawn(
          this.x,
          this.y,
          shootAngle,
          680,
          25,
          950,
          1,
          true,
          COLORS.BULLET_SNIPER,
          5,
          false,
          'sniper'
        );
        soundEngine.playPistol();
        this.shootTimer = 2.4;
        this.isAiming = false;
      }
    } else if (this.behavior === 'approach_and_detonate') {
      if (!this.isExploding) {
        this.vx = Math.cos(angleToPlayer) * this.speed;
        this.vy = Math.sin(angleToPlayer) * this.speed;
        if (dist < 110) {
          this.isExploding = true;
          this.fuseTimer = this.fuseTime;
        }
      } else {
        this.vx = Math.cos(angleToPlayer) * (this.speed * 1.35);
        this.vy = Math.sin(angleToPlayer) * (this.speed * 1.35);
        this.fuseTimer -= dt;
        this.color = (Math.floor(this.fuseTimer * 16) % 2 === 0) ? '#ffffff' : COLORS.EXPLODER;

        if (this.fuseTimer <= 0) {
          this.detonate(player, particlePool, soundEngine, floatingTexts);
          return;
        }
      }
    }

    // Elite Mortar ability
    if (this.isElite && this.eliteType === 'mortar') {
      this.mortarTimer += dt;
      if (this.mortarTimer >= 3.8) {
        this.mortarTimer = 0;
        bulletPool.spawn(
          this.x,
          this.y,
          angleToPlayer + (Math.random() - 0.5) * 0.4,
          280,
          35,
          550,
          1,
          true,
          '#ffaa00',
          8,
          false,
          'boss_orb'
        );
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = Math.max(this.radius, Math.min(GAME_CONFIG.ARENA_WIDTH - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(GAME_CONFIG.ARENA_HEIGHT - this.radius, this.y));
  }

  _updateBoss(dt, player, dist, angleToPlayer, bulletPool, particlePool, soundEngine, spawnQueue, floatingTexts = null) {
    const hpRatio = this.health / this.maxHealth;
    let newPhase = 1;
    if (hpRatio < 0.3) {
      newPhase = 4;
    } else if (hpRatio < 0.6) {
      newPhase = 3;
    } else if (hpRatio < 0.85) {
      newPhase = 2;
    }

    if (newPhase !== this.bossPhase) {
      this.bossPhase = newPhase;
      soundEngine.playBossAlert();
      particlePool.spawnShockwave(this.x, this.y, '#ff0055', 280);
      particlePool.burst(this.x, this.y, '#ffea00', 35, 300, 3.5);

      let phaseTitle = 'PHASE 2: OVERCLOCK ACTIVE!';
      if (newPhase === 3) phaseTitle = 'PHASE 3: VOID SURGE!';
      if (newPhase === 4) phaseTitle = 'FINAL PHASE: ENRAGED CORE!';

      if (floatingTexts) {
        floatingTexts.spawn(this.x, this.y - 55, phaseTitle, '#ffe600', '#ff0055', true, 26);
      }
    }

    const bossSpeed = this.bossPhase === 4 ? this.speed * 1.5 : this.speed;
    this.vx = Math.cos(angleToPlayer) * bossSpeed;
    this.vy = Math.sin(angleToPlayer) * bossSpeed;

    this.bossAttackTimer += dt;
    this.bossSummonTimer += dt;

    const attackInterval = this.bossPhase === 4 ? 1.7 : 2.6;
    if (this.bossAttackTimer >= attackInterval) {
      this.bossAttackTimer = 0;
      soundEngine.playShotgun();

      const numProjectiles = this.bossPhase === 4 ? 20 : 14;
      for (let i = 0; i < numProjectiles; i++) {
        const ringAngle = (i * Math.PI * 2) / numProjectiles + this.animTimer;
        bulletPool.spawn(
          this.x,
          this.y,
          ringAngle,
          320,
          18,
          850,
          1,
          true,
          COLORS.BULLET_ENEMY,
          6,
          false,
          'boss_orb'
        );
      }
    }

    if (this.bossPhase >= 2) {
      this.bossLaserAngle += dt * (this.bossPhase === 4 ? 1.4 : 0.9);
      if (Math.random() < 0.28) {
        bulletPool.spawn(
          this.x,
          this.y,
          this.bossLaserAngle,
          460,
          20,
          780,
          1,
          true,
          '#ff0055',
          5,
          false,
          'standard'
        );
      }
    }

    if (this.bossSummonTimer >= 7.0 && spawnQueue) {
      this.bossSummonTimer = 0;
      soundEngine.playBossAlert();
      particlePool.spawnShockwave(this.x, this.y, '#ff0044', 220);

      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI * 2) / 4;
        const sx = this.x + Math.cos(angle) * 90;
        const sy = this.y + Math.sin(angle) * 90;
        spawnQueue.push({ type: ENEMY_TYPES.CHASER, x: sx, y: sy });
      }
    }
  }

  _updateSingularityBoss(dt, player, dist, angleToPlayer, bulletPool, particlePool, soundEngine, spawnQueue, floatingTexts = null) {
    const hpRatio = this.health / this.maxHealth;
    let newPhase = 1;
    if (hpRatio < 0.4) {
      newPhase = 3;
    } else if (hpRatio < 0.75) {
      newPhase = 2;
    }

    if (newPhase !== this.bossPhase) {
      this.bossPhase = newPhase;
      soundEngine.playBossAlert();
      particlePool.spawnShockwave(this.x, this.y, '#b000ff', 300);
      particlePool.burst(this.x, this.y, '#00f0ff', 40, 320, 3.5);

      let phaseTitle = 'PHASE 2: EVENT HORIZON!';
      if (newPhase === 3) phaseTitle = 'FINAL PHASE: GRAVITATIONAL COLLAPSE!';

      if (floatingTexts) {
        floatingTexts.spawn(this.x, this.y - 60, phaseTitle, '#00f0ff', '#b000ff', true, 26);
      }
    }

    // Singularity Weaver: 4-Way Cross Laser, Spiral Petal Barrage, Gravity Pull
    this.vx = Math.cos(angleToPlayer) * this.speed * 0.9;
    this.vy = Math.sin(angleToPlayer) * this.speed * 0.9;

    this.bossAttackTimer += dt;
    this.bossLaserAngle += dt * 0.7;
    this.singularityTimer += dt;

    // 1. Crucifix 4-Way Laser Beams
    if (Math.random() < 0.35) {
      for (let k = 0; k < 4; k++) {
        const beamA = this.bossLaserAngle + (k * Math.PI) / 2;
        bulletPool.spawn(
          this.x,
          this.y,
          beamA,
          520,
          22,
          850,
          1,
          true,
          '#d000ff',
          5.5,
          false,
          'standard'
        );
      }
    }

    // 2. Petal Spiral Barrage
    if (this.bossAttackTimer >= 2.0) {
      this.bossAttackTimer = 0;
      soundEngine.playShotgun();
      const petals = 18;
      for (let i = 0; i < petals; i++) {
        const pa = (i * Math.PI * 2) / petals + this.animTimer * 1.5;
        bulletPool.spawn(
          this.x,
          this.y,
          pa,
          340,
          20,
          900,
          1,
          true,
          '#b000ff',
          6.5,
          false,
          'boss_orb'
        );
      }
    }

    // 3. Gravitational Singularity Pulse (draws player inward slightly)
    if (dist < 550 && dist > 80) {
      const pullForce = (1 - dist / 550) * 80 * dt;
      player.x -= Math.cos(angleToPlayer) * pullForce;
      player.y -= Math.sin(angleToPlayer) * pullForce;
    }
  }

  takeDamage(amount, soundEngine, particlePool, floatingTexts, isCrit = false) {
    if (!this.active || this.isDead) return 0;

    let effDmg = amount;
    this.flashTimer = 0.08;

    // Absorb with elite shield if active
    if (this.eliteShield > 0) {
      if (this.eliteShield >= effDmg) {
        this.eliteShield -= effDmg;
        effDmg = 0;
        soundEngine.playShield();
      } else {
        effDmg -= this.eliteShield;
        this.eliteShield = 0;
      }
    }

    this.health -= effDmg;

    if (floatingTexts && effDmg > 0) {
      floatingTexts.spawn(
        this.x,
        this.y - this.radius,
        Math.round(effDmg).toString(),
        isCrit ? '#ffe600' : '#ffffff',
        isCrit ? '#ffaa00' : this.glow,
        isCrit,
        isCrit ? 16 : 13
      );
    }

    if (particlePool) {
      particlePool.burst(this.x, this.y, this.glow, isCrit ? 8 : 4, 160, 2.5);
    }

    if (this.health <= 0) {
      this.isDead = true;
      this.active = false;
      return amount;
    }

    return amount;
  }

  applyKnockback(angle, force) {
    const effForce = force * (1 - this.knockbackResistance);
    this.x += Math.cos(angle) * effForce;
    this.y += Math.sin(angle) * effForce;
  }

  detonate(player, particlePool, soundEngine, floatingTexts, isCoop = false) {
    this.isDead = true;
    this.active = false;
    soundEngine.playShockwave();
    particlePool.spawnShockwave(this.x, this.y, COLORS.EXPLODER, this.explosionRadius);
    particlePool.burst(this.x, this.y, COLORS.EXPLODER, 35, 300, 4.5);

    const playerList = Array.isArray(player) ? player : [player];
    for (const p of playerList) {
      if (p.isDowned) continue;
      const dist = Math.hypot(p.x - this.x, p.y - this.y);
      if (dist < this.explosionRadius + p.radius) {
        p.takeDamage(this.damage, soundEngine, particlePool, floatingTexts, isCoop);
      }
    }
  }

  draw(ctx) {
    if (!this.active || this.isDead) return;

    ctx.save();

    // 1. Sniper telegraph laser line
    if (this.isAiming) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.aimTarget.x, this.aimTarget.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Boss Laser Telegraph Beam
    if (this.isBoss) {
      ctx.strokeStyle = this.type === 'singularity_boss' ? 'rgba(200, 0, 255, 0.35)' : 'rgba(255, 0, 80, 0.35)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(
        this.x + Math.cos(this.bossLaserAngle) * 700,
        this.y + Math.sin(this.bossLaserAngle) * 700
      );
      ctx.stroke();
    }

    // 3. Body Rendering with Fast GlowCache
    glowCache.drawGlow(ctx, this.x, this.y, this.radius * (this.isBoss ? 1.6 : 1.3), this.color, 0.75);

    const drawColor = this.flashTimer > 0 ? '#ffffff' : this.color;
    ctx.fillStyle = drawColor;

    if (this.isBoss) {
      const pulse = 1 + Math.sin(this.animTimer) * 0.06;
      const r = this.radius * pulse;
      const spikes = this.type === 'singularity_boss' ? 16 : 12;

      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a = (i * Math.PI * 2) / spikes + this.animTimer * 0.4;
        const outerR = r * 1.25;
        const innerR = r * 0.85;
        const ox = this.x + Math.cos(a) * outerR;
        const oy = this.y + Math.sin(a) * outerR;
        const ix = this.x + Math.cos(a + Math.PI / spikes) * innerR;
        const iy = this.y + Math.sin(a + Math.PI / spikes) * innerR;
        if (i === 0) ctx.moveTo(ox, oy);
        else ctx.lineTo(ox, oy);
        ctx.lineTo(ix, iy);
      }
      ctx.closePath();
      ctx.fill();

      // Corrupted black center
      ctx.fillStyle = this.type === 'singularity_boss' ? COLORS.SINGULARITY_BOSS_CORE : COLORS.VOID_BOSS_CORE;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Glowing pupil
      const pupilColor = this.type === 'singularity_boss' ? '#d000ff' : '#ff0044';
      glowCache.drawGlow(ctx, this.x, this.y, r * 0.5, pupilColor, 0.9);
      ctx.fillStyle = pupilColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();

      // Angry dot eyes
      ctx.fillStyle = '#ffffff';
      const eyeOffset = this.radius * 0.35;
      const eyeSize = Math.max(1.5, this.radius * 0.18);
      ctx.beginPath();
      ctx.arc(this.x - eyeOffset, this.y - 2, eyeSize, 0, Math.PI * 2);
      ctx.arc(this.x + eyeOffset, this.y - 2, eyeSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Elite Champion Crown & Affix Runic Ring
    if (this.isElite) {
      // Rotating Crown rune above
      const crownY = this.y - this.radius - 14;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', this.x, crownY);

      // Rotating Affix Aura Ring
      const auraColor = this.eliteType === 'swift' ? '#ffe600' : this.eliteType === 'mortar' ? '#ff6600' : this.eliteType === 'shielded' ? '#00e5ff' : '#00ff66';
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -this.animTimer * 12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (this.eliteShield > 0) {
        // Dual-pass shield ring
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.35)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // 5. Health bar for Tanks, Elites, and Bosses
    if (this.isBoss || this.type === 'tank' || this.isElite) {
      const barW = this.radius * 2;
      const barH = 5;
      const barX = this.x - barW / 2;
      const barY = this.y - this.radius - (this.isElite ? 18 : 12);
      const hpPct = Math.max(0, this.health / this.maxHealth);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(barX, barY, barW, barH);

      ctx.fillStyle = this.isBoss ? '#ff0055' : this.isElite ? '#ffe600' : '#aa00ff';
      ctx.fillRect(barX, barY, barW * hpPct, barH);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    }

    ctx.restore();
  }
}
