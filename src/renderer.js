// NEON HAVOC — 30X Canvas Graphics Engine: Spring Grid, Camera Trauma, Dynamic Zoom & Holographic Radar

import { COLORS, GAME_CONFIG } from './constants.js';

class SpringNode {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.x0 = x;
    this.y0 = y;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt, damping = 0.92, stiffness = 120.0) {
    // Hooke's law towards anchor
    const fx = -stiffness * (this.x - this.x0);
    const fy = -stiffness * (this.y - this.y0);

    this.vx = (this.vx + fx * dt) * damping;
    this.vy = (this.vy + fy * dt) * damping;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

class SpringGrid {
  constructor(width, height, spacing = 72) {
    this.width = width;
    this.height = height;
    this.spacing = spacing;
    this.cols = Math.ceil(width / spacing) + 1;
    this.rows = Math.ceil(height / spacing) + 1;
    this.nodes = [];

    for (let r = 0; r < this.rows; r++) {
      this.nodes[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.nodes[r][c] = new SpringNode(c * spacing, r * spacing);
      }
    }
  }

  applyExplosion(x, y, force = 45, radius = 220) {
    const minC = Math.max(0, Math.floor((x - radius) / this.spacing));
    const maxC = Math.min(this.cols - 1, Math.ceil((x + radius) / this.spacing));
    const minR = Math.max(0, Math.floor((y - radius) / this.spacing));
    const maxR = Math.min(this.rows - 1, Math.ceil((y + radius) / this.spacing));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const node = this.nodes[r][c];
        const dx = node.x - x;
        const dy = node.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 1) {
          const factor = (1 - dist / radius) * force;
          node.vx += (dx / dist) * factor * 14;
          node.vy += (dy / dist) * factor * 14;
        }
      }
    }
  }

  applyImplosion(x, y, force = 40, radius = 240) {
    this.applyExplosion(x, y, -force, radius);
  }

  update(dt, camX, camY, camW, camH) {
    // Only simulate nodes near the viewport for optimal 120 FPS performance
    const pad = 120;
    const minC = Math.max(0, Math.floor((camX - pad) / this.spacing));
    const maxC = Math.min(this.cols - 1, Math.ceil((camX + camW + pad) / this.spacing));
    const minR = Math.max(0, Math.floor((camY - pad) / this.spacing));
    const maxR = Math.min(this.rows - 1, Math.ceil((camY + camH + pad) / this.spacing));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        this.nodes[r][c].update(dt);
      }
    }
  }

  draw(ctx, camX, camY, camW, camH, pulse = 0.05, accentColor = '#00f0ff') {
    const pad = 80;
    const minC = Math.max(0, Math.floor((camX - pad) / this.spacing));
    const maxC = Math.min(this.cols - 1, Math.ceil((camX + camW + pad) / this.spacing));
    const minR = Math.max(0, Math.floor((camY - pad) / this.spacing));
    const maxR = Math.min(this.rows - 1, Math.ceil((camY + camH + pad) / this.spacing));

    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Horizontal lines
    for (let r = minR; r <= maxR; r++) {
      ctx.moveTo(this.nodes[r][minC].x, this.nodes[r][minC].y);
      for (let c = minC + 1; c <= maxC; c++) {
        ctx.lineTo(this.nodes[r][c].x, this.nodes[r][c].y);
      }
    }

    // Vertical lines
    for (let c = minC; c <= maxC; c++) {
      ctx.moveTo(this.nodes[minR][c].x, this.nodes[minR][c].y);
      for (let r = minR + 1; r <= maxR; r++) {
        ctx.lineTo(this.nodes[r][c].x, this.nodes[r][c].y);
      }
    }
    ctx.stroke();

    // High-tech intersection crosshairs
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = Math.min(1, pulse * 2.5);
    for (let r = minR; r <= maxR; r += 2) {
      for (let c = minC; c <= maxC; c += 2) {
        const node = this.nodes[r][c];
        ctx.fillRect(node.x - 1.5, node.y - 1.5, 3, 3);
      }
    }

    ctx.restore();
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Camera with advanced trauma & smooth zoom
    this.camera = {
      x: GAME_CONFIG.ARENA_WIDTH / 2,
      y: GAME_CONFIG.ARENA_HEIGHT / 2,
      zoom: 1.0,
      targetZoom: 1.0,
      trauma: 0, // In [0..1]
      maxShakeOffset: 24,
      maxShakeAngle: 0.04, // Radians
    };

    // Elastic Reactive Grid
    this.grid = new SpringGrid(GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.ARENA_HEIGHT, 72);
    this.gridPulse = 0;

    // Hit-stop crunch timer
    this.hitStopTimer = 0;

    // Radar pulse animation
    this.radarSweep = 0;

    // Cyberpunk Glitch & Chromatic Aberration
    this.glitchTimer = 0;
    this.glitchIntensity = 0;

    // 30X Sector Theming & Recoil Kick
    this.sectorAccent = '#00f0ff';
    this.recoilKick = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('fullscreenchange', () => this.resize());
    window.addEventListener('webkitfullscreenchange', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  addTrauma(amount = 0.4) {
    this.camera.trauma = Math.min(1.0, this.camera.trauma + amount);
  }

  triggerHitStop(duration = 0.035) {
    this.hitStopTimer = duration;
  }

  triggerGlitch(duration = 0.2, intensity = 8) {
    this.glitchTimer = duration;
    this.glitchIntensity = intensity;
  }

  setSector(sector) {
    if (sector && sector.accentColor) {
      this.sectorAccent = sector.accentColor;
    }
  }

  triggerRecoil(amount = 7) {
    this.recoilKick = Math.min(15, this.recoilKick + amount);
  }

  updateCamera(dt, targetX, targetY, isBossActive = false, isOverdrive = false, player2Distance = 0) {
    // Recoil kick decay
    if (this.recoilKick > 0) {
      this.recoilKick = Math.max(0, this.recoilKick - dt * 28);
    }

    // Zoom calculation
    let baseZoom = 1.0;
    if (isOverdrive) {
      baseZoom = 1.06;
    } else if (isBossActive) {
      baseZoom = 0.88;
    }

    if (player2Distance > 400) {
      // Dynamic Co-op Zoom: smoothly expand viewport when players split up
      const coopZoomFactor = Math.max(0.72, 1.0 - (player2Distance - 400) / 1800);
      baseZoom = Math.min(baseZoom, coopZoomFactor);
    }

    this.camera.targetZoom = baseZoom;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;

    // Smoothly lerp camera center to target world position
    const lerpSpeed = 0.16;
    this.camera.x += (targetX - this.camera.x) * lerpSpeed;
    this.camera.y += (targetY - this.camera.y) * lerpSpeed;

    // Visible half-extent in world units
    const halfViewW = (this.width / 2) / this.camera.zoom;
    const halfViewH = (this.height / 2) / this.camera.zoom;

    // Clamp camera center so visible view never extends beyond arena boundaries
    this.camera.x = Math.max(halfViewW, Math.min(GAME_CONFIG.ARENA_WIDTH - halfViewW, this.camera.x));
    this.camera.y = Math.max(halfViewH, Math.min(GAME_CONFIG.ARENA_HEIGHT - halfViewH, this.camera.y));

    // Trauma decay
    if (this.camera.trauma > 0) {
      this.camera.trauma = Math.max(0, this.camera.trauma - dt * 1.5);
    }

    // Glitch timer decay
    if (this.glitchTimer > 0) {
      this.glitchTimer = Math.max(0, this.glitchTimer - dt);
    }

    this.gridPulse += dt * 3.0;
    this.radarSweep = (this.radarSweep + dt * 2.8) % (Math.PI * 2);

    // Update elastic spring grid using world view rectangle
    const viewW = halfViewW * 2;
    const viewH = halfViewH * 2;
    this.grid.update(dt, this.camera.x - halfViewW, this.camera.y - halfViewH, viewW, viewH);
  }

  clampToCameraView(player, margin = 35) {
    if (!player) return;
    const halfViewW = (this.width / 2) / this.camera.zoom - margin;
    const halfViewH = (this.height / 2) / this.camera.zoom - margin;
    player.x = Math.max(this.camera.x - halfViewW, Math.min(this.camera.x + halfViewW, player.x));
    player.y = Math.max(this.camera.y - halfViewH, Math.min(this.camera.y + halfViewH, player.y));
  }

  getScreenPos(worldX, worldY) {
    const zoom = this.camera.zoom;
    const sx = (worldX - this.camera.x) * zoom + this.width / 2;
    const sy = (worldY - this.camera.y) * zoom + this.height / 2;
    return { x: sx, y: sy };
  }

  getWorldPos(screenX, screenY) {
    const zoom = this.camera.zoom;
    const wx = (screenX - this.width / 2) / zoom + this.camera.x;
    const wy = (screenY - this.height / 2) / zoom + this.camera.y;
    return { x: wx, y: wy };
  }

  beginFrame() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Deep space background fill
    ctx.fillStyle = COLORS.BG_DARK;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();

    // Camera transform with Trauma Shake & Rotation
    const shake = this.camera.trauma * this.camera.trauma;
    const shakeX = (Math.random() - 0.5) * shake * this.camera.maxShakeOffset;
    const shakeY = (Math.random() - 0.5) * shake * this.camera.maxShakeOffset;
    const shakeAngle = (Math.random() - 0.5) * shake * this.camera.maxShakeAngle;

    ctx.translate(this.width / 2 + shakeX, this.height / 2 + shakeY);
    if (shakeAngle !== 0) {
      ctx.rotate(shakeAngle);
    }
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    const halfViewW = (this.width / 2) / this.camera.zoom;
    const halfViewH = (this.height / 2) / this.camera.zoom;

    // Draw elastic grid & glowing arena borders
    const pulseAlpha = 0.05 + Math.sin(this.gridPulse) * 0.025;
    this.grid.draw(ctx, this.camera.x - halfViewW, this.camera.y - halfViewH, halfViewW * 2, halfViewH * 2, pulseAlpha, this.sectorAccent);
    this._drawBorders(ctx);
  }

  endFrame(player = null) {
    this.ctx.restore();
    this._drawVignette(this.ctx, player);
    if (this.glitchTimer > 0) {
      this._drawGlitch(this.ctx);
    }
  }

  _drawBorders(ctx) {
    ctx.save();
    const col = this.sectorAccent || '#00f0ff';

    // Dual-pass border glow without shadowBlur
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 10;
    ctx.strokeRect(4, 4, GAME_CONFIG.ARENA_WIDTH - 8, GAME_CONFIG.ARENA_HEIGHT - 8);

    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, GAME_CONFIG.ARENA_WIDTH - 8, GAME_CONFIG.ARENA_HEIGHT - 8);

    // High-tech corner telemetry brackets
    const mLen = 50;
    ctx.lineWidth = 5;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(0, mLen); ctx.lineTo(0, 0); ctx.lineTo(mLen, 0);
    // Top-right
    ctx.moveTo(GAME_CONFIG.ARENA_WIDTH - mLen, 0); ctx.lineTo(GAME_CONFIG.ARENA_WIDTH, 0); ctx.lineTo(GAME_CONFIG.ARENA_WIDTH, mLen);
    // Bottom-left
    ctx.moveTo(0, GAME_CONFIG.ARENA_HEIGHT - mLen); ctx.lineTo(0, GAME_CONFIG.ARENA_HEIGHT); ctx.lineTo(mLen, GAME_CONFIG.ARENA_HEIGHT);
    // Bottom-right
    ctx.moveTo(GAME_CONFIG.ARENA_WIDTH - mLen, GAME_CONFIG.ARENA_HEIGHT); ctx.lineTo(GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.ARENA_HEIGHT); ctx.lineTo(GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.ARENA_HEIGHT - mLen);
    ctx.stroke();

    ctx.restore();
  }

  _drawGlitch(ctx) {
    ctx.save();
    const slices = 4;
    for (let i = 0; i < slices; i++) {
      const sy = Math.random() * this.height;
      const sh = 10 + Math.random() * 20;
      const sx = (Math.random() - 0.5) * this.glitchIntensity * 2;
      ctx.drawImage(this.canvas, 0, sy, this.width, sh, sx, sy, this.width, sh);
    }

    // Subtle cyan/red tint pulse
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 0, 85, 0.08)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();
  }

  drawTargetingSight(player, targetEnemy = null) {
    // Intentionally removed: Clean HUD and unobstructed bullet-hell aesthetics
  }

  drawReviveTether(p1, p2, progress = 0.5) {
    if (!p1 || !p2) return;
    const ctx = this.ctx;
    ctx.save();
    const alpha = 0.4 + progress * 0.55;
    ctx.strokeStyle = `rgba(0, 255, 170, ${alpha})`;
    ctx.lineWidth = 4 + progress * 5;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
  }

  _drawVignette(ctx, player = null) {
    ctx.save();
    const grad = ctx.createRadialGradient(
      this.width / 2,
      this.height / 2,
      this.width * 0.35,
      this.width / 2,
      this.height / 2,
      this.width * 0.78
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(3, 5, 12, 0.75)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // 30X Low Health Danger Vignette Pulse
    if (player && player.health / player.maxHealth < 0.35) {
      const pulse = 0.22 + Math.sin(this.gridPulse * 2.5) * 0.12;
      const redGrad = ctx.createRadialGradient(
        this.width / 2,
        this.height / 2,
        this.width * 0.25,
        this.width / 2,
        this.height / 2,
        this.width * 0.75
      );
      redGrad.addColorStop(0, 'rgba(255, 0, 50, 0)');
      redGrad.addColorStop(1, `rgba(255, 0, 50, ${pulse})`);
      ctx.fillStyle = redGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  // ---- HOLOGRAPHIC TACTICAL RADAR (MINIMAP) ----
  drawRadar(player, enemies, powerupPool, activeBoss, teammate = null) {
    if (!player) return;

    const ctx = this.ctx;
    // Responsive sizing for mobile vs desktop
    const isMobile = this.width < 768;
    const radarSize = isMobile ? 96 : 124;
    const radarX = this.width - radarSize - (isMobile ? 14 : 24);
    const radarY = isMobile ? 54 : 64;
    const radius = radarSize / 2;
    const cx = radarX + radius;
    const cy = radarY + radius;
    const radarRange = 1200; // World unit radius visible on radar

    ctx.save();

    // Radar backdrop
    ctx.fillStyle = 'rgba(6, 12, 28, 0.88)';
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Tactical Crosshairs (Matching Reference Image)
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - radius + 4, cy);
    ctx.lineTo(cx + radius - 4, cy);
    ctx.moveTo(cx, cy - radius + 4);
    ctx.lineTo(cx, cy + radius - 4);
    ctx.stroke();

    // Concentric Range rings
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.35, 0, Math.PI * 2);
    ctx.arc(cx, cy, radius * 0.7, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating radar sweep line
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.radarSweep) * radius, cy + Math.sin(this.radarSweep) * radius);
    ctx.stroke();

    // Clip within radar circle for blips
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    // 1. Draw Active Powerups
    if (powerupPool) {
      for (let i = 0; i < powerupPool.pool.length; i++) {
        const p = powerupPool.pool[i];
        if (!p.active) continue;
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        const rx = cx + (dx / radarRange) * radius;
        const ry = cy + (dy / radarRange) * radius;
        ctx.fillStyle = '#ffe600';
        ctx.beginPath();
        ctx.arc(rx, ry, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2. Draw Enemies (Red hostile blips matching Reference Image)
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e.active || e.isDead) continue;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);

      if (dist < radarRange) {
        const rx = cx + (dx / radarRange) * radius;
        const ry = cy + (dy / radarRange) * radius;
        ctx.fillStyle = e.isBoss ? '#ff0055' : '#ff2255';
        ctx.beginPath();
        ctx.arc(rx, ry, e.isBoss ? 4.5 : 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 2.5 Draw Teammate on Radar
    if (teammate && teammate.active) {
      const tdx = teammate.x - player.x;
      const tdy = teammate.y - player.y;
      const tdist = Math.hypot(tdx, tdy);
      const tColor = teammate.playerIndex === 2 ? '#ff00aa' : '#00f0ff';
      if (tdist < radarRange) {
        const rx = cx + (tdx / radarRange) * radius;
        const ry = cy + (tdy / radarRange) * radius;
        ctx.fillStyle = teammate.isDowned ? '#ff0044' : tColor;
        ctx.beginPath();
        ctx.arc(rx, ry, teammate.isDowned ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // 3. Draw Player in Center
    ctx.fillStyle = player.playerIndex === 2 ? '#ff00aa' : '#00ffff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
    ctx.fill();

    // Aim Heading Pointer
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(player.aimAngle) * 9, cy + Math.sin(player.aimAngle) * 9);
    ctx.stroke();

    ctx.restore();

    // 4. Off-screen Boss Direction Indicator Chevron
    if (activeBoss && activeBoss.active) {
      const bdx = activeBoss.x - player.x;
      const bdy = activeBoss.y - player.y;
      const bdist = Math.hypot(bdx, bdy);

      if (bdist > radarRange * 0.8) {
        const bAngle = Math.atan2(bdy, bdx);
        const indX = cx + Math.cos(bAngle) * (radius + 12);
        const indY = cy + Math.sin(bAngle) * (radius + 12);

        ctx.save();
        ctx.fillStyle = '#ff0055';
        ctx.translate(indX, indY);
        ctx.rotate(bAngle);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, -6);
        ctx.lineTo(-3, 0);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 5. Off-Screen Teammate Direction Indicator on HUD (Multi-Device Freedom)
    if (teammate && teammate.active) {
      const tScreen = this.getScreenPos(teammate.x, teammate.y);
      const margin = 50;
      const isOffScreen = tScreen.x < margin || tScreen.x > this.width - margin || tScreen.y < margin || tScreen.y > this.height - margin;

      if (isOffScreen) {
        const tColor = teammate.playerIndex === 2 ? '#ff00aa' : '#00f0ff';
        const tName = teammate.playerIndex === 2 ? 'NOVA-02' : 'SPARK-01';
        const angle = Math.atan2(teammate.y - player.y, teammate.x - player.x);
        const dist = Math.round(Math.hypot(teammate.x - player.x, teammate.y - player.y));

        const screenCenterX = this.width / 2;
        const screenCenterY = this.height / 2;
        const edgeDistX = (this.width / 2) - margin;
        const edgeDistY = (this.height / 2) - margin;

        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const scaleX = Math.abs(cosA) > 0.001 ? Math.abs(edgeDistX / cosA) : 999999;
        const scaleY = Math.abs(sinA) > 0.001 ? Math.abs(edgeDistY / sinA) : 999999;
        const scale = Math.min(scaleX, scaleY);

        const indX = screenCenterX + cosA * scale;
        const indY = screenCenterY + sinA * scale;

        ctx.save();
        ctx.translate(indX, indY);
        ctx.rotate(angle);

        // Chevron Arrow
        ctx.fillStyle = teammate.isDowned ? '#ff0044' : tColor;
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-10, -9);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Distance & Status Tag
        ctx.save();
        ctx.font = '700 11px Rajdhani, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const tagOffsetY = indY > this.height - 75 ? -24 : 24;
        const tagText = teammate.isDowned ? `⚠️ ${tName} DOWN! (${dist}m)` : `${tName} • ${dist}m`;
        ctx.fillStyle = teammate.isDowned ? 'rgba(255, 0, 68, 0.85)' : 'rgba(8, 16, 32, 0.85)';
        const textW = ctx.measureText(tagText).width + 16;
        ctx.fillRect(indX - textW / 2, indY + tagOffsetY - 9, textW, 18);
        ctx.strokeStyle = teammate.isDowned ? '#ffe600' : tColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(indX - textW / 2, indY + tagOffsetY - 9, textW, 18);
        ctx.fillStyle = teammate.isDowned ? '#ffffff' : tColor;
        ctx.fillText(tagText, indX, indY + tagOffsetY);
        ctx.restore();
      }
    }
  }
}
