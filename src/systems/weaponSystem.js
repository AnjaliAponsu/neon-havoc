// NEON HAVOC — 30X Weapon Execution & Evolution System

import { COLORS, WEAPONS } from '../constants.js';
import { spatialGrid } from '../spatialHash.js';

export class WeaponSystem {
  constructor() {
    this.lightningArcs = []; // Active lightning visual lines
  }

  update(dt, player, input, bulletPool, soundEngine, particlePool, enemies, floatingTexts, isCoop = false) {
    // 1. Decay visual lightning lines
    for (let i = this.lightningArcs.length - 1; i >= 0; i--) {
      this.lightningArcs[i].life -= dt;
      if (this.lightningArcs[i].life <= 0) {
        this.lightningArcs.splice(i, 1);
      }
    }

    const playerList = Array.isArray(player) ? player : [player];
    const inputList = Array.isArray(input) ? input : [input];

    for (let pIdx = 0; pIdx < playerList.length; pIdx++) {
      const p = playerList[pIdx];
      const pIn = inputList[pIdx] || inputList[0];
      if (!p || p.isDowned) continue;
      this._updatePlayerWeapons(dt, p, pIn, bulletPool, soundEngine, particlePool, enemies, floatingTexts);
    }

    // Harmonic Convergence Synergy (Both Players in Overdrive)
    this.harmonicActive = false;
    if (playerList.length >= 2 && playerList[0].isOverdrive && playerList[1].isOverdrive && !playerList[0].isDowned && !playerList[1].isDowned) {
      this.harmonicActive = true;
      this.p1Pos = { x: playerList[0].x, y: playerList[0].y };
      this.p2Pos = { x: playerList[1].x, y: playerList[1].y };
      this._applyHarmonicConvergence(dt, playerList[0], playerList[1], enemies, particlePool, soundEngine, floatingTexts);
    }

    // 7. Projectile-to-Enemy Collisions & Evolutions
    const primaryP = playerList[0];
    this._checkBulletEnemyCollisions(bulletPool, enemies, primaryP, soundEngine, particlePool, floatingTexts);

    // 8. Enemy Projectile-to-Player Collisions
    for (let pIdx = 0; pIdx < playerList.length; pIdx++) {
      const p = playerList[pIdx];
      if (p && !p.isDowned) {
        this._checkEnemyBulletCollisions(bulletPool, p, soundEngine, particlePool, floatingTexts, isCoop);
      }
    }
  }

  _updatePlayerWeapons(dt, player, input, bulletPool, soundEngine, particlePool, enemies, floatingTexts) {
    const nexusMult = player.nexusSyncActive ? 1.2 : 1.0;
    const effectiveFireRateMult = Math.min(4.0, Math.max(0.2, (player.stats.fireRateMult || 1.0) * nexusMult));

    // 2. Primary Weapon: Pulse Blaster OR Evolved Thunderstorm Railgun
    player.fireTimer += dt;
    const isEvoRailgun = player.weapons.evoRailgun;
    const baseFireRate = Math.max(0.04, (isEvoRailgun ? WEAPONS.EVO_RAILGUN.fireRate : WEAPONS.PISTOL.fireRate) / effectiveFireRateMult);
    const shouldFire = input.isShooting || input.autoFire;

    if (shouldFire && player.fireTimer >= baseFireRate) {
      player.fireTimer = 0;
      if (isEvoRailgun) {
        this._fireRailgun(player, bulletPool, soundEngine);
      } else {
        this._firePistol(player, bulletPool, soundEngine);
      }
    }

    // 3. Auxiliary Weapon: Plasma Shotgun OR Supernova Flak Cannon
    if (player.weapons.shotgun || player.weapons.evoSupernova) {
      player.shotgunTimer += dt;
      const isEvoSupernova = player.weapons.evoSupernova;
      const shotgunRate = Math.max(0.1, (isEvoSupernova ? WEAPONS.EVO_SUPERNOVA.fireRate : WEAPONS.SHOTGUN.fireRate) / effectiveFireRateMult);
      if (player.shotgunTimer >= shotgunRate) {
        player.shotgunTimer = 0;
        if (isEvoSupernova) {
          this._fireSupernova(player, bulletPool, soundEngine);
        } else {
          this._fireShotgun(player, bulletPool, soundEngine);
        }
      }
    }

    // 4. Auxiliary Weapon: Chain Lightning OR Tempest Web Matrix
    if (player.weapons.lightning || player.weapons.evoStormWeb) {
      player.lightningTimer += dt;
      const isEvoStorm = player.weapons.evoStormWeb;
      const lightningRate = Math.max(0.12, (isEvoStorm ? WEAPONS.EVO_STORM_WEB.fireRate : WEAPONS.LIGHTNING.fireRate) / effectiveFireRateMult);
      if (player.lightningTimer >= lightningRate) {
        player.lightningTimer = 0;
        this._triggerLightning(player, enemies, soundEngine, particlePool, floatingTexts, isEvoStorm);
      }
    }

    // 5. Auxiliary Weapon: Spectrum Laser Beam
    if (player.weapons.beam) {
      player.beamTimer += dt;
      if (player.beamTimer >= WEAPONS.BEAM.fireRate) {
        player.beamTimer = 0;
        this._fireBeam(player, bulletPool, soundEngine);
      }
    }

    // 6. Orbital Drones OR Event Horizon Vortex
    if (player.weapons.orbital && player.orbitalDrones > 0) {
      this._updateOrbitalCollision(dt, player, enemies, soundEngine, particlePool, floatingTexts);
    }
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  _applyHarmonicConvergence(dt, p1, p2, enemies, particlePool, soundEngine, floatingTexts) {
    const dmg = 750 * dt;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.isDead) continue;
      const d = this._distToSegment(e.x, e.y, p1.x, p1.y, p2.x, p2.y);
      if (d < e.radius + 36) {
        e.takeDamage(dmg, soundEngine, particlePool, floatingTexts);
        if (Math.random() < 0.25) {
          particlePool.spawnDirectionalSparks(e.x, e.y, Math.random() * Math.PI * 2, 1.2, 220, '#ff00aa', 2);
        }
      }
    }
  }

  _firePistol(player, bulletPool, soundEngine) {
    soundEngine.playPistol();

    const count = 1 + player.stats.extraProjectiles;
    const spreadAngle = count > 1 ? 0.35 : 0;
    const startAngle = player.aimAngle - spreadAngle / 2;
    const angleStep = count > 1 ? spreadAngle / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? player.aimAngle : startAngle + i * angleStep;
      const isCrit = Math.random() < player.stats.critChance;
      const damage = WEAPONS.PISTOL.damage * player.stats.damageMult * (isCrit ? 2.5 : 1.0);
      const bulletColor = isCrit ? '#ffe600' : (player.id === 2 ? '#ff00aa' : WEAPONS.PISTOL.color);

      bulletPool.spawn(
        player.x,
        player.y,
        angle,
        WEAPONS.PISTOL.speed,
        damage,
        WEAPONS.PISTOL.range,
        WEAPONS.PISTOL.pierce + player.stats.extraPierce,
        false,
        bulletColor,
        4.5,
        isCrit,
        'standard'
      );
    }
  }

  _fireRailgun(player, bulletPool, soundEngine) {
    soundEngine.playLightning();

    const count = 1 + Math.floor(player.stats.extraProjectiles * 0.5);
    const spreadAngle = count > 1 ? 0.2 : 0;
    const startAngle = player.aimAngle - spreadAngle / 2;
    const angleStep = count > 1 ? spreadAngle / (count - 1) : 0;

    for (let i = 0; i < count; i++) {
      const angle = count === 1 ? player.aimAngle : startAngle + i * angleStep;
      const isCrit = Math.random() < player.stats.critChance;
      const damage = WEAPONS.EVO_RAILGUN.damage * player.stats.damageMult * (isCrit ? 2.5 : 1.0);

      bulletPool.spawn(
        player.x,
        player.y,
        angle,
        WEAPONS.EVO_RAILGUN.speed,
        damage,
        WEAPONS.EVO_RAILGUN.range,
        WEAPONS.EVO_RAILGUN.pierce + player.stats.extraPierce,
        false,
        '#ffffff',
        6.5,
        isCrit,
        'railgun'
      );
    }
  }

  _fireShotgun(player, bulletPool, soundEngine) {
    soundEngine.playShotgun();
    const pellets = WEAPONS.SHOTGUN.projectiles + player.stats.extraProjectiles * 2;
    const cone = WEAPONS.SHOTGUN.spread;

    for (let i = 0; i < pellets; i++) {
      const angle = player.aimAngle + (Math.random() - 0.5) * cone;
      const isCrit = Math.random() < player.stats.critChance;
      const damage = WEAPONS.SHOTGUN.damage * player.stats.damageMult * (isCrit ? 2.5 : 1.0);
      const speed = WEAPONS.SHOTGUN.speed * (0.85 + Math.random() * 0.3);

      bulletPool.spawn(
        player.x,
        player.y,
        angle,
        speed,
        damage,
        WEAPONS.SHOTGUN.range,
        1 + player.stats.extraPierce,
        false,
        WEAPONS.SHOTGUN.color,
        3.5,
        isCrit,
        'standard'
      );
    }
  }

  _fireSupernova(player, bulletPool, soundEngine) {
    soundEngine.playShotgun();
    const shells = WEAPONS.EVO_SUPERNOVA.projectiles + player.stats.extraProjectiles * 2;
    const cone = WEAPONS.EVO_SUPERNOVA.spread;

    for (let i = 0; i < shells; i++) {
      const angle = player.aimAngle + (Math.random() - 0.5) * cone;
      const isCrit = Math.random() < player.stats.critChance;
      const damage = WEAPONS.EVO_SUPERNOVA.damage * player.stats.damageMult * (isCrit ? 2.5 : 1.0);
      const speed = WEAPONS.EVO_SUPERNOVA.speed * (0.85 + Math.random() * 0.3);

      bulletPool.spawn(
        player.x,
        player.y,
        angle,
        speed,
        damage,
        WEAPONS.EVO_SUPERNOVA.range,
        2 + player.stats.extraPierce,
        false,
        '#ffea00',
        5.5,
        isCrit,
        'supernova_shell'
      );
    }
  }

  _fireBeam(player, bulletPool, soundEngine) {
    const isCrit = Math.random() < player.stats.critChance;
    const damage = WEAPONS.BEAM.damage * player.stats.damageMult * (isCrit ? 2.5 : 1.0);

    bulletPool.spawn(
      player.x,
      player.y,
      player.aimAngle + (Math.random() - 0.5) * 0.04,
      1400,
      damage,
      WEAPONS.BEAM.range,
      4 + player.stats.extraPierce,
      false,
      '#ff00ff',
      5.0,
      isCrit,
      'laser'
    );
  }

  _triggerLightning(player, enemies, soundEngine, particlePool, floatingTexts, isEvoStorm = false) {
    let closest = null;
    let minDist = 550;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.isDead) continue;
      const d = Math.hypot(e.x - player.x, e.y - player.y);
      if (d < minDist) {
        minDist = d;
        closest = e;
      }
    }

    if (!closest) return;

    soundEngine.playLightning();

    const targets = [closest];
    let current = closest;
    const maxChains = isEvoStorm ? 8 : 3;
    const chainRad = isEvoStorm ? 280 : 180;

    for (let c = 0; c < maxChains; c++) {
      let nextTarget = null;
      let nextMin = chainRad;

      for (let i = 0; i < enemies.length; i++) {
        const candidate = enemies[i];
        if (!candidate.active || candidate.isDead || targets.includes(candidate)) continue;
        const d = Math.hypot(candidate.x - current.x, candidate.y - current.y);
        if (d < nextMin) {
          nextMin = d;
          nextTarget = candidate;
        }
      }

      if (nextTarget) {
        targets.push(nextTarget);
        current = nextTarget;
      } else {
        break;
      }
    }

    let prevPoint = { x: player.x, y: player.y };
    const baseDamage = isEvoStorm ? WEAPONS.EVO_STORM_WEB.damage : WEAPONS.LIGHTNING.damage;

    for (let i = 0; i < targets.length; i++) {
      const tgt = targets[i];
      const isCrit = Math.random() < player.stats.critChance;
      const dmg = baseDamage * player.stats.damageMult * (isCrit ? 2.5 : 1.0);

      tgt.takeDamage(dmg, soundEngine, particlePool, floatingTexts, isCrit);
      this.lightningArcs.push({
        x1: prevPoint.x,
        y1: prevPoint.y,
        x2: tgt.x,
        y2: tgt.y,
        life: 0.16,
        maxLife: 0.16,
      });
      prevPoint = { x: tgt.x, y: tgt.y };
    }
  }

  _updateOrbitalCollision(dt, player, enemies, soundEngine, particlePool, floatingTexts) {
    const isEvoVortex = player.weapons.evoVortex;
    const droneDist = isEvoVortex ? 80 : 65;
    const droneRadius = isEvoVortex ? 12 : 8;
    const dps = (isEvoVortex ? WEAPONS.EVO_EVENT_HORIZON.damagePerSec : WEAPONS.ORBITAL.damagePerSec) * player.stats.damageMult;
    const dmg = dps * dt;

    for (let i = 0; i < player.orbitalDrones; i++) {
      const angle = player.orbitalAngle + (i * Math.PI * 2) / player.orbitalDrones;
      const ox = player.x + Math.cos(angle) * droneDist;
      const oy = player.y + Math.sin(angle) * droneDist;

      for (let j = 0; j < enemies.length; j++) {
        const e = enemies[j];
        if (!e.active || e.isDead) continue;
        const d = Math.hypot(e.x - ox, e.y - oy);

        // Gravitational vortex suction on evolved orbs (bosses are immune to suction)
        if (isEvoVortex && d < 180 && !e.isBoss) {
          const pullAngle = Math.atan2(oy - e.y, ox - e.x);
          e.x += Math.cos(pullAngle) * 90 * dt;
          e.y += Math.sin(pullAngle) * 90 * dt;
        }

        if (d < droneRadius + e.radius) {
          e.takeDamage(dmg, soundEngine, particlePool, floatingTexts, false);
          e.applyKnockback(Math.atan2(e.y - oy, e.x - ox), isEvoVortex ? 25 : 15);
        }
      }
    }
  }

  _checkBulletEnemyCollisions(bulletPool, enemies, player, soundEngine, particlePool, floatingTexts) {
    for (let b = 0; b < bulletPool.pool.length; b++) {
      const bullet = bulletPool.pool[b];
      if (!bullet.active || bullet.isEnemy) continue;

      // Query radius accounts for large Boss cores (up to 75px radius) + bullet radius
      spatialGrid.queryNearby(bullet.x, bullet.y, bullet.radius + 90, (enemy) => {
        if (!enemy.active || enemy.isDead || bullet.hitEnemies.has(enemy)) return;

        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const distSq = dx * dx + dy * dy;
        const rad = enemy.radius + bullet.radius;

        if (distSq < rad * rad) {
          bullet.hitEnemies.add(enemy);
          bullet.piercedCount++;

          enemy.takeDamage(bullet.damage, soundEngine, particlePool, floatingTexts, bullet.isCrit);
          enemy.applyKnockback(Math.atan2(bullet.vy, bullet.vx), 20);

          // Fiery Starburst Explosive Impact Effect (Matching Reference Image)
          if (particlePool) {
            particlePool.spawnStarburst(bullet.x, bullet.y, bullet.isCrit ? '#ffe600' : '#ff9900', bullet.isCrit ? 22 : 14);
          }

          // 30X Directional impact sparks
          const hitAngle = Math.atan2(bullet.vy, bullet.vx) + Math.PI;
          particlePool.spawnDirectionalSparks(bullet.x, bullet.y, hitAngle, 0.9, 340, bullet.color, 4);

          if (bullet.isCrit) {
            soundEngine.playCrit();
            particlePool.spawnShockwave(bullet.x, bullet.y, '#ffe600', 36);
          }

          if (bullet.type === 'railgun') {
            this._triggerRailgunChain(bullet.x, bullet.y, enemies, enemy, soundEngine, particlePool, floatingTexts);
          }

          if (bullet.type === 'supernova_shell') {
            this._spawnSupernovaShrapnel(bullet.x, bullet.y, bulletPool);
          }

          if (bullet.piercedCount >= bullet.pierce) {
            bullet.active = false;
            return false;
          }
        }
      });
    }
  }

  _triggerRailgunChain(x, y, enemies, hitEnemy, soundEngine, particlePool, floatingTexts) {
    let count = 0;
    for (let i = 0; i < enemies.length && count < 2; i++) {
      const e = enemies[i];
      if (!e.active || e.isDead || e === hitEnemy) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 180) {
        e.takeDamage(35, soundEngine, particlePool, floatingTexts, true);
        this.lightningArcs.push({
          x1: x,
          y1: y,
          x2: e.x,
          y2: e.y,
          life: 0.12,
          maxLife: 0.12,
        });
        count++;
      }
    }
  }

  _spawnSupernovaShrapnel(x, y, bulletPool) {
    const shrapnelCount = 4;
    for (let s = 0; s < shrapnelCount; s++) {
      const a = (s * Math.PI * 2) / shrapnelCount + Math.random() * 0.4;
      bulletPool.spawn(
        x,
        y,
        a,
        800,
        18,
        250,
        1,
        false,
        '#ffaa00',
        3.0,
        false,
        'standard'
      );
    }
  }

  _checkEnemyBulletCollisions(bulletPool, player, soundEngine, particlePool, floatingTexts) {
    for (let b = 0; b < bulletPool.pool.length; b++) {
      const bullet = bulletPool.pool[b];
      if (!bullet.active || !bullet.isEnemy) continue;

      const dist = Math.hypot(player.x - bullet.x, player.y - bullet.y);

      // 1. Overdrive Vaporization Aura
      if (player.isOverdrive && dist < player.radius * 1.5 + bullet.radius + 25) {
        bullet.active = false;
        soundEngine.playDeflect();
        particlePool.spawnDirectionalSparks(bullet.x, bullet.y, Math.atan2(bullet.y - player.y, bullet.x - player.x), 1.2, 280, '#ff00aa', 6);
        continue;
      }

      // 2. Active Aegis Barrier Deflection
      if (player.isShieldActive && dist < player.radius + 18 + bullet.radius) {
        bullet.active = false;
        soundEngine.playDeflect();
        particlePool.spawnDirectionalSparks(bullet.x, bullet.y, Math.atan2(bullet.y - player.y, bullet.x - player.x), 1.0, 260, '#00f0ff', 5);
        continue;
      }

      // 3. Orbital Drone Absorption
      if (player.weapons.orbital && player.orbitalDrones > 0) {
        let absorbedByDrone = false;
        const droneDist = 65;
        for (let i = 0; i < player.orbitalDrones; i++) {
          const a = player.orbitalAngle + (i * Math.PI * 2) / player.orbitalDrones;
          const ox = player.x + Math.cos(a) * droneDist;
          const oy = player.y + Math.sin(a) * droneDist;
          if (Math.hypot(bullet.x - ox, bullet.y - oy) < 18 + bullet.radius) {
            bullet.active = false;
            soundEngine.playDeflect();
            particlePool.burst(ox, oy, '#00ffea', 6, 160, 2);
            absorbedByDrone = true;
            break;
          }
        }
        if (absorbedByDrone) continue;
      }

      // 4. Near-Miss Bullet Graze (+XP & Overdrive charge)
      if (dist < player.radius + bullet.radius + 24 && !bullet.hasGrazed) {
        bullet.hasGrazed = true;
        player.xp += 20;
        player.overdriveCharge = Math.min(100, player.overdriveCharge + 1.2);
        soundEngine.playGraze();
        particlePool.spawn(bullet.x, bullet.y, 0, 0, 14, '#00ffff', 0.22, 1, 'ring');
        if (floatingTexts) {
          floatingTexts.spawn(bullet.x, bullet.y - 12, 'GRAZE! +20', '#00ffff', '#ffffff', false, 12);
        }
      }

      // 5. Direct Player Hit
      if (dist < player.radius + bullet.radius) {
        bullet.active = false;
        player.takeDamage(bullet.damage, soundEngine, particlePool, floatingTexts);
      }
    }
  }

  draw(ctx) {
    // 1. Harmonic Convergence Electric Synergy Beam
    if (this.harmonicActive && this.p1Pos && this.p2Pos &&
        isFinite(this.p1Pos.x) && isFinite(this.p1Pos.y) && isFinite(this.p2Pos.x) && isFinite(this.p2Pos.y)) {
      ctx.save();
      try {
        // Outer intense resonance glow
        ctx.strokeStyle = 'rgba(255, 0, 180, 0.4)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(this.p1Pos.x, this.p1Pos.y);
        ctx.lineTo(this.p2Pos.x, this.p2Pos.y);
        ctx.stroke();

        // Inner electric laser beam
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.p1Pos.x, this.p1Pos.y);
        ctx.lineTo(this.p2Pos.x, this.p2Pos.y);
        ctx.stroke();
      } finally {
        ctx.restore();
      }
    }

    if (!this.lightningArcs || this.lightningArcs.length === 0) return;

    ctx.save();
    try {
      for (let i = 0; i < this.lightningArcs.length; i++) {
        const arc = this.lightningArcs[i];
        if (!arc || !isFinite(arc.x1) || !isFinite(arc.y1) || !isFinite(arc.x2) || !isFinite(arc.y2)) continue;
        const alpha = Math.max(0, Math.min(1, arc.life / (arc.maxLife || 1)));
        if (!isFinite(alpha)) continue;

        const segments = 4;
        const dx = (arc.x2 - arc.x1) / segments;
        const dy = (arc.y2 - arc.y1) / segments;

        ctx.beginPath();
        ctx.moveTo(arc.x1, arc.y1);
        for (let s = 1; s < segments; s++) {
          const perpX = -dy * 0.4;
          const perpY = dx * 0.4;
          const jitter = (Math.random() - 0.5) * 1.5;
          const sx = arc.x1 + dx * s + perpX * jitter;
          const sy = arc.y1 + dy * s + perpY * jitter;
          ctx.lineTo(sx, sy);
        }
        ctx.lineTo(arc.x2, arc.y2);

        // Outer luminous glow
        ctx.strokeStyle = `rgba(0, 240, 255, ${0.4 * alpha})`;
        ctx.lineWidth = 6.5 * alpha;
        ctx.stroke();

        // Intense white lightning core
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 2.2 * alpha;
        ctx.stroke();
      }
    } finally {
      ctx.restore();
    }
  }
}
