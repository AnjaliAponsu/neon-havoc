// NEON HAVOC — 30X Canvas Graphics Engine: Spring Grid, Camera Trauma, Dynamic Zoom & Holographic Radar

import { COLORS, GAME_CONFIG } from './constants.js';
import { glowCache } from './glowCache.js';

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
    const safeDt = Math.min(0.04, Math.max(0.001, dt));
    // Hooke's law towards anchor
    const fx = -stiffness * (this.x - this.x0);
    const fy = -stiffness * (this.y - this.y0);

    this.vx = (this.vx + fx * safeDt) * damping;
    this.vy = (this.vy + fy * safeDt) * damping;

    this.x += this.vx * safeDt;
    this.y += this.vy * safeDt;
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
    if (!isFinite(x) || !isFinite(y) || isNaN(x) || isNaN(y)) return;
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

  applyWake(x, y, vx, vy, radius = 95) {
    if (!isFinite(x) || !isFinite(y)) return;
    const speed = Math.hypot(vx, vy);
    if (speed < 15) return;
    const minC = Math.max(0, Math.floor((x - radius) / this.spacing));
    const maxC = Math.min(this.cols - 1, Math.ceil((x + radius) / this.spacing));
    const minR = Math.max(0, Math.floor((y - radius) / this.spacing));
    const maxR = Math.min(this.rows - 1, Math.ceil((y + radius) / this.spacing));

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const node = this.nodes[r][c];
        const dist = Math.hypot(node.x - x, node.y - y);
        if (dist < radius && dist > 1) {
          const factor = (1 - dist / radius) * 0.12;
          node.vx += vx * factor;
          node.vy += vy * factor;
        }
      }
    }
  }

  update(dt, camX, camY, camW, camH) {
    if (isNaN(camX) || isNaN(camY) || isNaN(camW) || isNaN(camH)) return;
    const pad = 120;
    const minC = Math.max(0, Math.min(this.cols - 1, Math.floor((camX - pad) / this.spacing) || 0));
    const maxC = Math.max(0, Math.min(this.cols - 1, Math.ceil((camX + camW + pad) / this.spacing) || 0));
    const minR = Math.max(0, Math.min(this.rows - 1, Math.floor((camY - pad) / this.spacing) || 0));
    const maxR = Math.max(0, Math.min(this.rows - 1, Math.ceil((camY + camH + pad) / this.spacing) || 0));

    for (let r = minR; r <= maxR; r++) {
      if (!this.nodes[r]) continue;
      for (let c = minC; c <= maxC; c++) {
        if (this.nodes[r][c]) {
          this.nodes[r][c].update(dt);
        }
      }
    }
  }

  draw(ctx, camX, camY, camW, camH, pulse = 0.05, accentColor = '#00f0ff') {
    if (isNaN(camX) || isNaN(camY) || isNaN(camW) || isNaN(camH)) return;
    const pad = 80;
    const minC = Math.max(0, Math.min(this.cols - 1, Math.floor((camX - pad) / this.spacing) || 0));
    const maxC = Math.max(0, Math.min(this.cols - 1, Math.ceil((camX + camW + pad) / this.spacing) || 0));
    const minR = Math.max(0, Math.min(this.rows - 1, Math.floor((camY - pad) / this.spacing) || 0));
    const maxR = Math.max(0, Math.min(this.rows - 1, Math.ceil((camY + camH + pad) / this.spacing) || 0));

    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Horizontal lines
    for (let r = minR; r <= maxR; r++) {
      if (!this.nodes[r] || !this.nodes[r][minC]) continue;
      ctx.moveTo(this.nodes[r][minC].x, this.nodes[r][minC].y);
      for (let c = minC + 1; c <= maxC; c++) {
        if (this.nodes[r][c]) {
          ctx.lineTo(this.nodes[r][c].x, this.nodes[r][c].y);
        }
      }
    }

    // Vertical lines
    for (let c = minC; c <= maxC; c++) {
      if (!this.nodes[minR] || !this.nodes[minR][c]) continue;
      ctx.moveTo(this.nodes[minR][c].x, this.nodes[minR][c].y);
      for (let r = minR + 1; r <= maxR; r++) {
        if (this.nodes[r] && this.nodes[r][c]) {
          ctx.lineTo(this.nodes[r][c].x, this.nodes[r][c].y);
        }
      }
    }
    ctx.stroke();

    // High-tech intersection crosshairs (+) & illuminated nodes (Matching Reference Design)
    ctx.strokeStyle = accentColor;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = Math.min(0.55, pulse * 2.8);
    for (let r = minR; r <= maxR; r += 2) {
      if (!this.nodes[r]) continue;
      for (let c = minC; c <= maxC; c += 2) {
        const node = this.nodes[r][c];
        if (node && isFinite(node.x) && isFinite(node.y)) {
          // Precise 5px tactical crosshair (+)
          ctx.beginPath();
          ctx.moveTo(node.x - 3, node.y);
          ctx.lineTo(node.x + 3, node.y);
          ctx.moveTo(node.x, node.y - 3);
          ctx.lineTo(node.x, node.y + 3);
          ctx.stroke();

          // Sub-pixel white center gleam
          ctx.fillRect(node.x - 0.75, node.y - 0.75, 1.5, 1.5);
        }
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

    // Ambient Floating Hexagonal Debris (Matching Reference Image Background)
    this.bgHexagons = [
      // Key Viewport Hexagonal Slabs (Framing central combat arena matching storyboard!)
      { x: 1720, y: 940, size: 36, rotation: 0.1, pulseSpeed: 0.5, offset: 0 },
      { x: 1260, y: 1040, size: 34, rotation: -0.2, pulseSpeed: 0.6, offset: 1.2 },
      { x: 1840, y: 1440, size: 38, rotation: 0.3, pulseSpeed: 0.55, offset: 2.1 },
      { x: 1340, y: 1400, size: 35, rotation: -0.15, pulseSpeed: 0.45, offset: 3.4 },
      { x: 1980, y: 1000, size: 32, rotation: 0.25, pulseSpeed: 0.7, offset: 4.5 },
    ];
    const hexCount = 36;
    for (let i = 0; i < hexCount; i++) {
      this.bgHexagons.push({
        x: Math.random() * GAME_CONFIG.ARENA_WIDTH,
        y: Math.random() * GAME_CONFIG.ARENA_HEIGHT,
        size: 24 + Math.random() * 26,
        rotation: (Math.random() - 0.5) * 0.6,
        pulseSpeed: 0.4 + Math.random() * 0.6,
        offset: Math.random() * Math.PI * 2,
      });
    }

    // Atmospheric Floating Cyber Motes (Volumetric 3D Parallax Embers)
    this.ambientMotes = [];
    const moteCount = 52;
    const moteColors = ['#00f0ff', '#ff00aa', '#ffe600', '#70e0ff', '#ffffff', '#b000ff'];
    for (let i = 0; i < moteCount; i++) {
      this.ambientMotes.push({
        x: Math.random() * GAME_CONFIG.ARENA_WIDTH,
        y: Math.random() * GAME_CONFIG.ARENA_HEIGHT,
        vx: (Math.random() - 0.5) * 22,
        vy: -12 - Math.random() * 24,
        size: 1.4 + Math.random() * 2.6,
        color: moteColors[i % moteColors.length],
        baseAlpha: 0.35 + Math.random() * 0.5,
        pulseSpeed: 1.6 + Math.random() * 2.2,
        offset: Math.random() * Math.PI * 2,
      });
    }

    // Dynamic Combat Scorch Marks
    this.scorchMarks = [];

    // Glowing Cyber Power Conduits (Embedded Circuit Bus Floor Tracks)
    this.conduitPulse = 0;
    this.cyberConduits = [
      // Connecting Center Nexus to the 4 In-View Framing Bastions
      { from: { x: 1600, y: 1200 }, to: { x: 1150, y: 940 }, color: '#d000ff', pips: 4 },
      { from: { x: 1600, y: 1200 }, to: { x: 2050, y: 1460 }, color: '#00f0ff', pips: 4 },
      { from: { x: 1600, y: 1200 }, to: { x: 2050, y: 940 }, color: '#00f0ff', pips: 4 },
      { from: { x: 1600, y: 1200 }, to: { x: 1150, y: 1460 }, color: '#ff00aa', pips: 4 },
      // Connecting to Perimeter Fortification Gates
      { from: { x: 1600, y: 1200 }, to: { x: 1600, y: 80 }, color: '#00f0ff', pips: 4 },
      { from: { x: 1600, y: 1200 }, to: { x: 1600, y: 2320 }, color: '#ff00aa', pips: 4 },
      { from: { x: 1600, y: 1200 }, to: { x: 80, y: 1200 }, color: '#d000ff', pips: 4 },
      { from: { x: 1600, y: 1200 }, to: { x: 3120, y: 1200 }, color: '#00f0ff', pips: 4 },
    ];

    // Tactical Sector Trench Bastions (Industrial Armor, Hazard Stripes & Slanted LED Vents)
    this.sectorBastions = [
      // 1. IN-VIEW CENTRAL VIEWPORT BASTIONS (Permanently visible in normal 1280x720 camera view, exact match to storyboard!)
      // Top-Left Bastion (slanted down-right, exact match to top-left of reference image!)
      { x: 1150, y: 940, length: 340, angle: -Math.PI / 4, color: '#d000ff', hasCaution: true, hasVents: true },
      // Bottom-Right Bastion (slanted up-left, exact match to bottom-right of reference image!)
      { x: 2050, y: 1460, length: 340, angle: 3 * Math.PI / 4, color: '#00f0ff', hasCaution: true, hasVents: true },
      // Top-Right Bastion
      { x: 2050, y: 940, length: 340, angle: Math.PI / 4, color: '#00f0ff', hasCaution: true, hasVents: true },
      // Bottom-Left Bastion
      { x: 1150, y: 1460, length: 340, angle: -3 * Math.PI / 4, color: '#ff00aa', hasCaution: true, hasVents: true },

      // 2. Mid-Field Secondary Trench Bastions
      { x: 740, y: 560, length: 320, angle: -Math.PI / 4, color: '#d000ff', hasCaution: true, hasVents: true },
      { x: 2460, y: 1840, length: 320, angle: 3 * Math.PI / 4, color: '#00f0ff', hasCaution: true, hasVents: true },
      { x: 2460, y: 560, length: 320, angle: Math.PI / 4, color: '#00f0ff', hasCaution: true, hasVents: true },
      { x: 740, y: 1840, length: 320, angle: -3 * Math.PI / 4, color: '#ff00aa', hasCaution: true, hasVents: true },

      // 3. Perimeter Gates / Outer Flanking Bunkers
      { x: 1600, y: 80, length: 480, angle: 0, color: '#00f0ff', hasCaution: true, hasVents: true },
      { x: 1600, y: 2320, length: 480, angle: Math.PI, color: '#ff00aa', hasCaution: true, hasVents: true },
      { x: 80, y: 1200, length: 480, angle: Math.PI / 2, color: '#d000ff', hasCaution: true, hasVents: true },
      { x: 3120, y: 1200, length: 480, angle: -Math.PI / 2, color: '#00f0ff', hasCaution: true, hasVents: true },
    ];

    // Ambient Glowing Crystal Formations (Nested in Bastion Alcoves & Strategic Landmarks)
    this.crystalFormations = [
      // 1. IN-VIEW CENTRAL VIEWPORT FORMATIONS (Directly visible framing the combat camera)
      // Nested Inside Top-Left Bastion Alcove (Vibrant purple 3D crystals with ground rubble — exact match to storyboard!)
      { x: 1040, y: 980, color: '#d000ff', count: 8, scale: 1.45 },
      // Nested Inside Bottom-Right Bastion Alcove (Vibrant cyan 3D crystals with ground rubble — exact match to storyboard!)
      { x: 2160, y: 1420, color: '#00f0ff', count: 8, scale: 1.45 },
      // Nested Inside Top-Right Bastion Alcove
      { x: 2160, y: 980, color: '#ffe600', count: 7, scale: 1.35 },
      // Nested Inside Bottom-Left Bastion Alcove
      { x: 1040, y: 1420, color: '#ff00aa', count: 7, scale: 1.35 },

      // 2. Mid-Field Strategic Formations
      { x: 740, y: 620, color: '#d000ff', count: 6, scale: 1.25 },
      { x: 2460, y: 1780, color: '#00f0ff', count: 6, scale: 1.25 },
      { x: 2460, y: 620, color: '#ffe600', count: 5, scale: 1.2 },
      { x: 740, y: 1780, color: '#ff00aa', count: 5, scale: 1.2 },

      // 3. Perimeter Bastion Clusters
      { x: 160, y: 150, color: '#9933ff', count: 7, scale: 1.45 },
      { x: GAME_CONFIG.ARENA_WIDTH - 160, y: 150, color: '#00f0ff', count: 7, scale: 1.45 },
      { x: 150, y: GAME_CONFIG.ARENA_HEIGHT - 160, color: '#d000ff', count: 7, scale: 1.45 },
      { x: GAME_CONFIG.ARENA_WIDTH - 160, y: GAME_CONFIG.ARENA_HEIGHT - 150, color: '#00f0ff', count: 8, scale: 1.5 },
    ];

    // Atmospheric Exhaust Vents & Cyber Grates (Vent steam motes)
    this.exhaustVents = [
      { x: 1160, y: 980, angle: -Math.PI / 4, timer: 0 },
      { x: 2040, y: 1420, angle: 3 * Math.PI / 4, timer: 1.2 },
      { x: 2040, y: 980, angle: Math.PI / 4, timer: 0.6 },
      { x: 1160, y: 1420, angle: -3 * Math.PI / 4, timer: 1.8 }
    ];
    this.steamParticles = [];
    this.sweeperAngle = 0;
    this.waveClearShockwaves = [];

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
    if (!sector) return;
    this.currentSectorData = sector;
    if (sector.accentColor) {
      this.sectorAccent = sector.accentColor;
    }
    const primary = sector.accentColor || '#00f0ff';
    const secondary = sector.id === 'sector_2' ? '#ff4400' : (sector.id === 'sector_3' ? '#d000ff' : '#ff00aa');

    // 1. Re-theme cyber conduits per sector
    if (this.cyberConduits) {
      this.cyberConduits.forEach((c, idx) => {
        c.color = idx % 2 === 0 ? primary : secondary;
      });
    }

    // 2. Re-theme sector trench bastions
    if (this.sectorBastions) {
      this.sectorBastions.forEach((b, idx) => {
        b.color = idx % 2 === 0 ? primary : secondary;
      });
    }

    // 3. Re-theme 3D crystal clusters
    if (this.crystalFormations) {
      this.crystalFormations.forEach((cf, idx) => {
        cf.color = idx % 3 === 0 ? primary : (idx % 3 === 1 ? secondary : '#ffffff');
      });
    }
  }

  triggerRecoil(amount = 7) {
    this.recoilKick = Math.min(15, this.recoilKick + amount);
  }

  addScorchMark(x, y, radius = 24, color = '#ffaa00') {
    if (!this.scorchMarks) this.scorchMarks = [];
    if (this.scorchMarks.length > 36) this.scorchMarks.shift();
    this.scorchMarks.push({
      x, y, radius, color, life: 9.0, maxLife: 9.0
    });
  }

  triggerWaveClear(wave, x = GAME_CONFIG.ARENA_WIDTH / 2, y = GAME_CONFIG.ARENA_HEIGHT / 2) {
    if (!isFinite(x) || !isFinite(y)) {
      x = GAME_CONFIG.ARENA_WIDTH / 2;
      y = GAME_CONFIG.ARENA_HEIGHT / 2;
    }
    const color = wave % 5 === 0 ? '#ffe600' : (wave % 2 === 0 ? '#00f0ff' : '#d000ff');
    this.waveClearShockwaves.push({
      x,
      y,
      radius: 40,
      maxRadius: 2400,
      speed: 1400,
      wave,
      color,
      life: 1.8,
      maxLife: 1.8,
      gridForce: 85
    });
    this.addTrauma(0.35);
    this.grid.applyExplosion(x, y, 95, 480);
    this.conduitPulse = (this.conduitPulse || 0) + 5.0;
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

    if (player2Distance > 400 && isFinite(player2Distance)) {
      // Dynamic Co-op Zoom: smoothly expand viewport when players split up
      const coopZoomFactor = Math.max(0.72, 1.0 - (player2Distance - 400) / 1800);
      baseZoom = Math.min(baseZoom, coopZoomFactor);
    }

    this.camera.targetZoom = (isFinite(baseZoom) && baseZoom > 0.2) ? baseZoom : 1.0;
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.12;
    if (!isFinite(this.camera.zoom) || this.camera.zoom <= 0.2) {
      this.camera.zoom = 1.0;
    }

    // Smoothly lerp camera center to target world position (strictly guarded against NaN)
    const validTargetX = (isFinite(targetX) && !isNaN(targetX)) ? targetX : (isFinite(this.camera.x) ? this.camera.x : GAME_CONFIG.ARENA_WIDTH / 2);
    const validTargetY = (isFinite(targetY) && !isNaN(targetY)) ? targetY : (isFinite(this.camera.y) ? this.camera.y : GAME_CONFIG.ARENA_HEIGHT / 2);

    const lerpSpeed = 0.16;
    this.camera.x += (validTargetX - this.camera.x) * lerpSpeed;
    this.camera.y += (validTargetY - this.camera.y) * lerpSpeed;

    if (!isFinite(this.camera.x) || isNaN(this.camera.x)) this.camera.x = GAME_CONFIG.ARENA_WIDTH / 2;
    if (!isFinite(this.camera.y) || isNaN(this.camera.y)) this.camera.y = GAME_CONFIG.ARENA_HEIGHT / 2;

    // Visible half-extent in world units
    const safeZoom = Math.max(0.4, Math.min(2.0, this.camera.zoom));
    const halfViewW = (this.width / 2) / safeZoom;
    const halfViewH = (this.height / 2) / safeZoom;

    // Clamp camera center so visible view never extends beyond arena boundaries
    if (halfViewW < GAME_CONFIG.ARENA_WIDTH / 2) {
      this.camera.x = Math.max(halfViewW, Math.min(GAME_CONFIG.ARENA_WIDTH - halfViewW, this.camera.x));
    } else {
      this.camera.x = GAME_CONFIG.ARENA_WIDTH / 2;
    }
    if (halfViewH < GAME_CONFIG.ARENA_HEIGHT / 2) {
      this.camera.y = Math.max(halfViewH, Math.min(GAME_CONFIG.ARENA_HEIGHT - halfViewH, this.camera.y));
    } else {
      this.camera.y = GAME_CONFIG.ARENA_HEIGHT / 2;
    }

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

  beginFrame(player = null, comboStreak = 0) {
    if (this.width <= 0 || this.height <= 0) return;
    const ctx = this.ctx;
    const isSurging = !!((player && player.isOverdrive) || (comboStreak >= 15));

    // Guaranteed transform reset: prevents any matrix scaling or translation leakage between frames
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);

    // Deep space background fill
    ctx.fillStyle = COLORS.BG_DARK;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();

    // Guard camera properties strictly against NaN/corrupt non-finite values
    if (!isFinite(this.camera.x) || isNaN(this.camera.x)) this.camera.x = GAME_CONFIG.ARENA_WIDTH / 2;
    if (!isFinite(this.camera.y) || isNaN(this.camera.y)) this.camera.y = GAME_CONFIG.ARENA_HEIGHT / 2;
    if (!isFinite(this.camera.zoom) || this.camera.zoom <= 0.2 || isNaN(this.camera.zoom)) this.camera.zoom = 1.0;

    // Camera transform with Trauma Shake & Rotation
    const shake = isFinite(this.camera.trauma) ? (this.camera.trauma * this.camera.trauma) : 0;
    const maxOffset = isFinite(this.camera.maxShakeOffset) ? this.camera.maxShakeOffset : 18;
    const maxAngle = isFinite(this.camera.maxShakeAngle) ? this.camera.maxShakeAngle : 0.05;
    const shakeX = (Math.random() - 0.5) * shake * maxOffset;
    const shakeY = (Math.random() - 0.5) * shake * maxOffset;
    const shakeAngle = (Math.random() - 0.5) * shake * maxAngle;

    const tx = this.width / 2 + (isFinite(shakeX) ? shakeX : 0);
    const ty = this.height / 2 + (isFinite(shakeY) ? shakeY : 0);
    ctx.translate(tx, ty);
    if (shakeAngle !== 0 && isFinite(shakeAngle)) {
      ctx.rotate(shakeAngle);
    }
    const safeZoom = Math.max(0.4, Math.min(2.0, this.camera.zoom));
    ctx.scale(safeZoom, safeZoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    const halfViewW = (this.width / 2) / safeZoom;
    const halfViewH = (this.height / 2) / safeZoom;

    // 1. Volumetric Deep Indigo Center Illumination (Matching Reference Image)
    try {
      const spaceGrad = ctx.createRadialGradient(
        GAME_CONFIG.ARENA_WIDTH / 2, GAME_CONFIG.ARENA_HEIGHT / 2, 80,
        GAME_CONFIG.ARENA_WIDTH / 2, GAME_CONFIG.ARENA_HEIGHT / 2, GAME_CONFIG.ARENA_WIDTH * 0.58
      );
      spaceGrad.addColorStop(0, isSurging ? 'rgba(50, 20, 96, 0.65)' : 'rgba(20, 36, 96, 0.52)');
      spaceGrad.addColorStop(0.35, 'rgba(12, 22, 64, 0.35)');
      spaceGrad.addColorStop(0.7, 'rgba(6, 12, 34, 0.22)');
      spaceGrad.addColorStop(1, 'rgba(2, 5, 14, 0)');
      ctx.fillStyle = spaceGrad;
      ctx.fillRect(0, 0, GAME_CONFIG.ARENA_WIDTH, GAME_CONFIG.ARENA_HEIGHT);
    } catch (e) { /* gradient guard */ }

    // 2. Persistent Ground Combat Scorch Marks (fading impact burns)
    try {
      this._drawScorchMarks(ctx, halfViewW, halfViewH);
    } catch (e) { /* scorch guard */ }

    // 3. Ambient 3D Hexagonal Floor Pavers & Debris (Matching Reference Background)
    try {
      this._drawFloatingHexagons(ctx, halfViewW, halfViewH);
    } catch (e) { /* hex guard */ }

    // 4. Elastic Grid, Holographic Nexus & Cyber Architecture
    try {
      const pulseMult = isSurging ? 2.4 : 1.0;
      const pulseAlpha = isSurging ? (0.24 + Math.sin(this.gridPulse * pulseMult) * 0.08) : (0.14 + Math.sin(this.gridPulse) * 0.04);
      const gridColor = isSurging ? '#ffe600' : this.sectorAccent;
      this.grid.draw(ctx, this.camera.x - halfViewW, this.camera.y - halfViewH, halfViewW * 2, halfViewH * 2, pulseAlpha, gridColor);
      this._drawTacticalFloorNexus(ctx, halfViewW, halfViewH, isSurging);
      this._drawAtmosphericSweeper(ctx, halfViewW, halfViewH);
      this._drawCyberConduits(ctx, halfViewW, halfViewH, isSurging);
      this._drawBorders(ctx);
      this._drawBattlegroundArchitecture(ctx, halfViewW, halfViewH);
      this._drawAtmosphericVents(ctx, halfViewW, halfViewH);
      this._drawWaveClearShockwaves(ctx, halfViewW, halfViewH, 0.016);
    } catch (e) { /* grid/border guard */ }

    // 5. Ambient Glowing 3D Faceted Crystal Clusters (Central & Bastion Formations)
    try {
      this._drawCrystalClusters(ctx, halfViewW, halfViewH);
    } catch (e) { /* crystal cluster guard */ }

    // 6. Atmospheric Floating Cyber Motes (Volumetric Parallax Embers)
    try {
      this._drawAmbientMotes(ctx, halfViewW, halfViewH);
    } catch (e) { /* motes guard */ }
  }

  _drawScorchMarks(ctx, halfViewW, halfViewH) {
    if (!this.scorchMarks || this.scorchMarks.length === 0) return;
    const minX = this.camera.x - halfViewW - 100;
    const maxX = this.camera.x + halfViewW + 100;
    const minY = this.camera.y - halfViewH - 100;
    const maxY = this.camera.y + halfViewH + 100;

    for (let i = this.scorchMarks.length - 1; i >= 0; i--) {
      const sm = this.scorchMarks[i];
      sm.life -= 0.016;
      if (sm.life <= 0) {
        this.scorchMarks.splice(i, 1);
        continue;
      }
      if (sm.x < minX || sm.x > maxX || sm.y < minY || sm.y > maxY) continue;

      const alpha = sm.life / sm.maxLife;
      ctx.save();
      // Dark carbon burn center
      ctx.fillStyle = `rgba(3, 6, 16, ${alpha * 0.68})`;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.radius, 0, Math.PI * 2);
      ctx.fill();

      // Glowing cooling edge rim
      ctx.strokeStyle = sm.color;
      ctx.globalAlpha = alpha * 0.38;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(sm.x, sm.y, sm.radius * 0.95, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawFloatingHexagons(ctx, halfViewW, halfViewH) {
    const pad = 120;
    const minX = this.camera.x - halfViewW - pad;
    const maxX = this.camera.x + halfViewW + pad;
    const minY = this.camera.y - halfViewH - pad;
    const maxY = this.camera.y + halfViewH + pad;

    ctx.save();
    try {
      for (let i = 0; i < this.bgHexagons.length; i++) {
        const hex = this.bgHexagons[i];
        if (hex.x < minX || hex.x > maxX || hex.y < minY || hex.y > maxY) continue;

        const bob = Math.sin(this.gridPulse * hex.pulseSpeed + hex.offset) * 4;
        const hx = hex.x;
        const hy = hex.y + bob;
        const size = hex.size;

        ctx.save();
        ctx.translate(hx, hy);
        ctx.rotate(hex.rotation);

        // 1. Soft Floor Shadow Beneath
        ctx.fillStyle = 'rgba(2, 5, 14, 0.65)';
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const px = Math.cos(a) * (size * 1.05);
          const py = Math.sin(a) * (size * 0.88) + 8;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 2. Beveled Dark Stone Side Rim (3D Thickness)
        ctx.fillStyle = '#0a1020';
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const px = Math.cos(a) * size;
          const py = Math.sin(a) * (size * 0.85) + 5;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 3. Top Hexagonal Platform Plate
        ctx.fillStyle = 'rgba(18, 28, 54, 0.85)';
        ctx.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = (s * Math.PI) / 3;
          const px = Math.cos(a) * size;
          const py = Math.sin(a) * (size * 0.85);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Top edge bevel highlight
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Inset decorative cyber micro-channel
        ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.beginPath();
        ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    } finally {
      ctx.restore();
    }
  }

  _drawTacticalFloorNexus(ctx, halfViewW, halfViewH, isSurging = false) {
    const cx = GAME_CONFIG.ARENA_WIDTH / 2;
    const cy = GAME_CONFIG.ARENA_HEIGHT / 2;
    const d = Math.hypot(this.camera.x - cx, this.camera.y - cy);
    if (d > Math.max(halfViewW, halfViewH) + 380) return;

    ctx.save();
    try {
      ctx.translate(cx, cy);

      // 1. Concentric Holographic Range Perimeter
      ctx.strokeStyle = isSurging ? 'rgba(255, 230, 0, 0.45)' : 'rgba(0, 200, 255, 0.22)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([14, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 180, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Secondary Telemetry Arc Ring with Cardinal Nodes
      ctx.strokeStyle = isSurging ? 'rgba(255, 230, 0, 0.35)' : 'rgba(0, 200, 255, 0.12)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.arc(0, 0, 230, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal tick marks
      ctx.strokeStyle = isSurging ? '#ffe600' : 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.8;
      for (let a = 0; a < 4; a++) {
        const ang = (a * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * 165, Math.sin(ang) * 165);
        ctx.lineTo(Math.cos(ang) * 195, Math.sin(ang) * 195);
        ctx.stroke();

        ctx.fillStyle = isSurging ? '#ffe600' : '#00f0ff';
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 180, Math.sin(ang) * 180, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Tactical Corner Framing Brackets [ ]
      const bDist = 260;
      const bLen = 22;
      ctx.strokeStyle = isSurging ? 'rgba(255, 230, 0, 0.65)' : 'rgba(0, 220, 255, 0.35)';
      ctx.lineWidth = 2;
      // Top-Left
      ctx.beginPath();
      ctx.moveTo(-bDist + bLen, -bDist); ctx.lineTo(-bDist, -bDist); ctx.lineTo(-bDist, -bDist + bLen);
      // Top-Right
      ctx.moveTo(bDist - bLen, -bDist); ctx.lineTo(bDist, -bDist); ctx.lineTo(bDist, -bDist + bLen);
      // Bottom-Left
      ctx.moveTo(-bDist + bLen, bDist); ctx.lineTo(-bDist, bDist); ctx.lineTo(-bDist, bDist - bLen);
      // Bottom-Right
      ctx.moveTo(bDist - bLen, bDist); ctx.lineTo(bDist, bDist); ctx.lineTo(bDist, bDist - bLen);
      ctx.stroke();

      // 4. Central Reactor Core Emblem
      ctx.strokeStyle = isSurging ? '#ffe600' : 'rgba(0, 240, 255, 0.5)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = isSurging ? 'rgba(255, 230, 0, 0.16)' : 'rgba(0, 240, 255, 0.08)';
      ctx.fill();

      // Rotating core reticle (faster during Arena Surge)
      ctx.rotate(this.gridPulse * (isSurging ? 0.9 : 0.3));
      ctx.strokeStyle = isSurging ? '#ffe600' : 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const ra = (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, 36, ra, ra + 0.6);
        ctx.stroke();
      }

      if (isSurging) {
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 1.8;
        for (let s = 0; s < 6; s++) {
          const sa = (s * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(sa) * 50, Math.sin(sa) * 50);
          ctx.lineTo(Math.cos(sa) * 110, Math.sin(sa) * 110);
          ctx.stroke();
        }
        ctx.font = 'bold 12px monospace';
        ctx.fillStyle = '#ffe600';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ ARENA OVERCHARGE // 240Hz', 0, 75);
      }
    } finally {
      ctx.restore();
    }
  }

  _drawAtmosphericSweeper(ctx, halfViewW, halfViewH) {
    this.sweeperAngle = (this.sweeperAngle || 0) + 0.016 * 0.28;
    const cx = GAME_CONFIG.ARENA_WIDTH / 2;
    const cy = GAME_CONFIG.ARENA_HEIGHT / 2;
    const distToCenter = Math.hypot(this.camera.x - cx, this.camera.y - cy);
    if (distToCenter > Math.max(halfViewW, halfViewH) + 900) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.sweeperAngle);

    // Soft volumetric atmospheric searchlight cone sweeping across the floor
    const beamLength = 850;
    const beamSpread = 0.45; // ~26 degrees
    const grad = ctx.createRadialGradient(0, 0, 40, 0, 0, beamLength);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0.08)');
    grad.addColorStop(0.4, 'rgba(0, 180, 255, 0.035)');
    grad.addColorStop(0.85, 'rgba(140, 0, 255, 0.015)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, beamLength, -beamSpread / 2, beamSpread / 2);
    ctx.closePath();
    ctx.fill();

    // Subtle edge laser lines
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-beamSpread / 2) * beamLength, Math.sin(-beamSpread / 2) * beamLength);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(beamSpread / 2) * beamLength, Math.sin(beamSpread / 2) * beamLength);
    ctx.stroke();

    ctx.restore();
  }

  _drawAtmosphericVents(ctx, halfViewW, halfViewH) {
    if (!this.exhaustVents) return;
    const dt = 0.016;

    ctx.save();
    try {
      for (let i = 0; i < this.exhaustVents.length; i++) {
        const v = this.exhaustVents[i];
        v.timer = (v.timer || 0) + dt;

        // Viewport culling
        if (v.x < this.camera.x - halfViewW - 120 || v.x > this.camera.x + halfViewW + 120 ||
            v.y < this.camera.y - halfViewH - 120 || v.y > this.camera.y + halfViewH + 120) continue;

        ctx.save();
        ctx.translate(v.x, v.y);
        ctx.rotate(v.angle);

        // 1. Recessed Grate Housing
        ctx.fillStyle = '#060a18';
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.35)';
        ctx.lineWidth = 1.4;
        ctx.fillRect(-22, -14, 44, 28);
        ctx.strokeRect(-22, -14, 44, 28);

        // 2. Glowing Amber/Cyan Furnace Underglow
        const glowPulse = 0.5 + Math.sin(v.timer * 4) * 0.25;
        ctx.fillStyle = `rgba(0, 240, 255, ${glowPulse * 0.45})`;
        ctx.fillRect(-18, -10, 36, 20);

        // 3. Metallic Slotted Grate Slats
        ctx.fillStyle = '#10172e';
        for (let s = -14; s <= 14; s += 7) {
          ctx.fillRect(s, -12, 3, 24);
        }

        ctx.restore();

        // Spawn drifting steam puff
        if (v.timer >= 2.2) {
          v.timer = 0;
          for (let p = 0; p < 4; p++) {
            this.steamParticles.push({
              x: v.x + (Math.random() - 0.5) * 16,
              y: v.y + (Math.random() - 0.5) * 16,
              vx: Math.cos(v.angle + Math.PI / 2) * (15 + Math.random() * 25) + (Math.random() - 0.5) * 10,
              vy: Math.sin(v.angle + Math.PI / 2) * (15 + Math.random() * 25) + (Math.random() - 0.5) * 10,
              size: 14 + Math.random() * 12,
              maxSize: 38 + Math.random() * 24,
              life: 1.8,
              maxLife: 1.8,
              color: i % 2 === 0 ? 'rgba(0, 240, 255,' : 'rgba(210, 0, 255,'
            });
          }
        }
      }

      // Update & render steam particles
      if (this.steamParticles) {
        for (let p = this.steamParticles.length - 1; p >= 0; p--) {
          const sp = this.steamParticles[p];
          sp.life -= dt;
          if (sp.life <= 0) {
            this.steamParticles.splice(p, 1);
            continue;
          }
          sp.x += sp.vx * dt;
          sp.y += sp.vy * dt;
          const progress = 1 - (sp.life / sp.maxLife);
          const currentSize = sp.size + (sp.maxSize - sp.size) * progress;
          const currentAlpha = Math.sin(progress * Math.PI) * 0.12;

          ctx.fillStyle = `${sp.color} ${currentAlpha})`;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, currentSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } finally {
      ctx.restore();
    }
  }

  _drawCrystalClusters(ctx, halfViewW, halfViewH) {
    const pad = 160;
    const minX = this.camera.x - halfViewW - pad;
    const maxX = this.camera.x + halfViewW + pad;
    const minY = this.camera.y - halfViewH - pad;
    const maxY = this.camera.y + halfViewH + pad;

    ctx.save();
    try {
      for (let f = 0; f < this.crystalFormations.length; f++) {
        const form = this.crystalFormations[f];
        if (form.x < minX || form.x > maxX || form.y < minY || form.y > maxY) continue;

        const cColor = form.color;
        const scale = form.scale || 1.0;

        // Determine shading tones based on base color
        const isCyan = cColor.includes('00f') || cColor.includes('cyan') || cColor.includes('00ffff');
        const isGold = cColor.includes('ffe') || cColor.includes('ffb');
        const shadeColor = isCyan ? '#005b94' : isGold ? '#b37700' : '#60008f';
        const specColor = isCyan ? '#c2f8ff' : isGold ? '#fff8cc' : '#f5c2ff';

        // 1. Radiant Ambient Floor Glow (Illuminating the floor grid)
        glowCache.drawGlow(ctx, form.x, form.y, 65 * scale, cColor, 0.7);

        // Ground drop occlusion shadow under formation
        ctx.fillStyle = 'rgba(2, 4, 12, 0.75)';
        ctx.beginPath();
        ctx.ellipse(form.x, form.y + 12 * scale, 34 * scale, 14 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // 2. Ground Mineral Rubble & Micro-Shards scattered around base
        const groundPebbles = [
          { dx: -28, dy: 14, r: 4.5, rot: 0.3 },
          { dx: 26, dy: 16, r: 5, rot: -0.4 },
          { dx: -12, dy: 20, r: 3.5, rot: 0.8 },
          { dx: 14, dy: 22, r: 4, rot: -0.6 },
        ];
        for (let p = 0; p < groundPebbles.length; p++) {
          const pb = groundPebbles[p];
          const px = form.x + pb.dx * scale;
          const py = form.y + pb.dy * scale;
          const pr = pb.r * scale;
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(pb.rot);
          ctx.fillStyle = shadeColor;
          ctx.beginPath();
          ctx.moveTo(-pr, 0); ctx.lineTo(0, -pr * 1.3); ctx.lineTo(pr, 0); ctx.lineTo(0, pr * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = specColor;
          ctx.lineWidth = 0.8;
          ctx.stroke();
          ctx.restore();
        }

        // 3. Multi-Faceted 3D Crystal Obelisks (Matching Reference Image)
        const shards = [
          { dx: 0, dy: 0, w: 18, h: 56, tilt: -0.06 },
          { dx: -18, dy: 12, w: 14, h: 42, tilt: -0.22 },
          { dx: 16, dy: 10, w: 15, h: 46, tilt: 0.18 },
          { dx: -32, dy: 24, w: 10, h: 28, tilt: -0.38 },
          { dx: 28, dy: 22, w: 11, h: 32, tilt: 0.35 },
          { dx: -6, dy: 18, w: 12, h: 36, tilt: 0.05 },
        ];

        for (let s = 0; s < shards.length; s++) {
          const sh = shards[s];
          const sx = form.x + sh.dx * scale;
          const sy = form.y + sh.dy * scale;
          const sw = sh.w * scale;
          const shh = sh.h * scale;

          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(sh.tilt);

          // Left facet: Primary saturated bright crystal face with top specular
          const leftGrad = ctx.createLinearGradient(-sw / 2, 0, 0, -shh);
          leftGrad.addColorStop(0, cColor);
          leftGrad.addColorStop(1, specColor);
          ctx.fillStyle = leftGrad;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.moveTo(0, -shh);
          ctx.lineTo(-sw / 2, -shh * 0.2);
          ctx.lineTo(-sw * 0.35, 6);
          ctx.lineTo(0, 10);
          ctx.closePath();
          ctx.fill();

          // Right facet: Deep ambient shaded crystal face
          ctx.fillStyle = shadeColor;
          ctx.globalAlpha = 0.92;
          ctx.beginPath();
          ctx.moveTo(0, -shh);
          ctx.lineTo(0, 10);
          ctx.lineTo(sw * 0.35, 6);
          ctx.lineTo(sw / 2, -shh * 0.2);
          ctx.closePath();
          ctx.fill();

          // Center spine ridge line (Crisp gleaming facet edge)
          ctx.strokeStyle = specColor;
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(0, -shh);
          ctx.lineTo(0, 10);
          ctx.stroke();

          // Top facet glint gleam
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 1.0;
          ctx.beginPath();
          ctx.arc(0, -shh, 1.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }
    } finally {
      ctx.restore();
    }
  }

  endFrame(player = null) {
    try {
      this.ctx.restore();
    } catch (e) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    this._drawVignette(this.ctx, player);
    if (this.glitchTimer > 0) {
      this._drawGlitch(this.ctx);
    }
  }

  _drawWaveClearShockwaves(ctx, halfViewW, halfViewH, dt = 0.016) {
    if (!this.waveClearShockwaves || this.waveClearShockwaves.length === 0) return;
    for (let i = this.waveClearShockwaves.length - 1; i >= 0; i--) {
      const sw = this.waveClearShockwaves[i];
      sw.life -= dt;
      sw.radius += sw.speed * dt;
      if (sw.life <= 0 || sw.radius >= sw.maxRadius) {
        this.waveClearShockwaves.splice(i, 1);
        continue;
      }
      const progress = 1 - (sw.life / sw.maxLife);
      const alpha = Math.max(0, sw.life / sw.maxLife);

      // Displace grid nodes along the shock wavefront
      if (this.grid) {
        this.grid.applyExplosion(sw.x, sw.y, sw.gridForce * dt * 4, sw.radius);
      }

      ctx.save();
      // Outer expanding EMP resonance ring
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = Math.max(2, 8 * (1 - progress));
      ctx.globalAlpha = alpha * 0.75;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Inner high-voltage harmonic ring with dashed hex modulation
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 4 * (1 - progress));
      ctx.globalAlpha = alpha * 0.95;
      ctx.setLineDash([24, 16, 8, 16]);
      ctx.lineDashOffset = -sw.radius * 0.5;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, Math.max(0, sw.radius - 18), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Secondary trailing ionization glow
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 14;
      ctx.globalAlpha = alpha * 0.25;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, Math.max(0, sw.radius - 10), 0, Math.PI * 2);
      ctx.stroke();

      // Energy spokes / electric ionization ticks
      const spokes = 16;
      ctx.globalAlpha = alpha * 0.6;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      for (let s = 0; s < spokes; s++) {
        const ang = (s * Math.PI * 2) / spokes + progress * 1.5;
        const innerR = Math.max(0, sw.radius - 28);
        const outerR = sw.radius + 14;
        ctx.beginPath();
        ctx.moveTo(sw.x + Math.cos(ang) * innerR, sw.y + Math.sin(ang) * innerR);
        ctx.lineTo(sw.x + Math.cos(ang) * outerR, sw.y + Math.sin(ang) * outerR);
        ctx.stroke();
      }
      ctx.restore();
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

  _drawCyberConduits(ctx, halfViewW, halfViewH, isSurging = false) {
    this.conduitPulse = (this.conduitPulse || 0) + 0.016 * (isSurging ? 3.5 : 1.5);
    ctx.save();
    try {
      for (let i = 0; i < this.cyberConduits.length; i++) {
        const c = this.cyberConduits[i];
        const minX = Math.min(c.from.x, c.to.x) - 40;
        const maxX = Math.max(c.from.x, c.to.x) + 40;
        const minY = Math.min(c.from.y, c.to.y) - 40;
        const maxY = Math.max(c.from.y, c.to.y) + 40;

        if (this.camera.x + halfViewW < minX || this.camera.x - halfViewW > maxX ||
            this.camera.y + halfViewH < minY || this.camera.y - halfViewH > maxY) continue;

        // Recessed dark floor groove
        ctx.strokeStyle = 'rgba(6, 14, 32, 0.75)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(c.from.x, c.from.y);
        ctx.lineTo(c.to.x, c.to.y);
        ctx.stroke();

        // Glowing neon energy core rail
        ctx.strokeStyle = isSurging ? '#ffe600' : c.color;
        ctx.globalAlpha = isSurging ? 0.65 : 0.35;
        ctx.lineWidth = isSurging ? 3.2 : 2.4;
        ctx.beginPath();
        ctx.moveTo(c.from.x, c.from.y);
        ctx.lineTo(c.to.x, c.to.y);
        ctx.stroke();

        // Traveling electric energy packets
        const dx = c.to.x - c.from.x;
        const dy = c.to.y - c.from.y;
        const pips = (c.pips || 3) * (isSurging ? 2 : 1);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.85;

        for (let p = 0; p < pips; p++) {
          const t = ((this.conduitPulse + p / pips) % 1);
          const px = c.from.x + dx * t;
          const py = c.from.y + dy * t;
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } finally {
      ctx.restore();
    }
  }

  _drawBattlegroundArchitecture(ctx, halfViewW, halfViewH) {
    const W = GAME_CONFIG.ARENA_WIDTH;
    const H = GAME_CONFIG.ARENA_HEIGHT;

    ctx.save();
    try {
      // 1. Sector Trench Bastions (Framing Combat Viewport in All Sectors)
      if (this.sectorBastions) {
        for (let i = 0; i < this.sectorBastions.length; i++) {
          const b = this.sectorBastions[i];
          const pad = b.length;
          if (b.x < this.camera.x - halfViewW - pad || b.x > this.camera.x + halfViewW + pad ||
              b.y < this.camera.y - halfViewH - pad || b.y > this.camera.y + halfViewH + pad) continue;
          this._renderTrenchWallSegment(ctx, b);
        }
      }

      // 2. Corner Massive Industrial Bulkheads (Matching Storyboard Corners)
      if (this.camera.x - halfViewW < 520 && this.camera.y - halfViewH < 520) {
        this._renderBulkheadUnit(ctx, 0, 0, 1, 1);
      }
      if (this.camera.x + halfViewW > W - 520 && this.camera.y + halfViewH > H - 520) {
        this._renderBulkheadUnit(ctx, W, H, -1, -1);
      }
      if (this.camera.x + halfViewW > W - 520 && this.camera.y - halfViewH < 520) {
        this._renderBulkheadUnit(ctx, W, 0, -1, 1);
      }
      if (this.camera.x - halfViewW < 520 && this.camera.y + halfViewH > H - 520) {
        this._renderBulkheadUnit(ctx, 0, H, 1, -1);
      }
    } finally {
      ctx.restore();
    }
  }

  _renderTrenchWallSegment(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);

    const halfL = b.length / 2;
    const depth = 58;
    const bevel = 24;
    const accent = b.color || '#ff00aa';

    // 1. Floor Drop-Shadow
    ctx.fillStyle = 'rgba(2, 4, 12, 0.65)';
    ctx.beginPath();
    ctx.moveTo(-halfL - 12, depth / 2 + 12);
    ctx.lineTo(halfL + 12, depth / 2 + 12);
    ctx.lineTo(halfL + 6, depth / 2 - 4);
    ctx.lineTo(-halfL - 6, depth / 2 - 4);
    ctx.closePath();
    ctx.fill();

    // 2. Base Dark Metallic Armor Chassis
    ctx.fillStyle = '#080d1c';
    ctx.beginPath();
    ctx.moveTo(-halfL, -depth / 2);
    ctx.lineTo(halfL, -depth / 2);
    ctx.lineTo(halfL + 16, depth / 2);
    ctx.lineTo(-halfL - 16, depth / 2);
    ctx.closePath();
    ctx.fill();

    // 3. Elevated Top Plate with Metallic Chamfer
    ctx.fillStyle = '#121b36';
    ctx.beginPath();
    ctx.moveTo(-halfL, -depth / 2);
    ctx.lineTo(halfL, -depth / 2);
    ctx.lineTo(halfL, depth / 2 - bevel);
    ctx.lineTo(-halfL, depth / 2 - bevel);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#223460';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 4. Recessed Neon Channel with Slanted Louvers (///)
    if (b.hasVents) {
      // Dark inset slot
      ctx.fillStyle = 'rgba(6, 10, 24, 0.95)';
      ctx.fillRect(-halfL + 30, -depth / 2 + 8, b.length - 60, 14);

      // Slanted glowing ventilation louvers
      ctx.strokeStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 8;
      ctx.lineWidth = 2.4;
      const ventCount = Math.floor((b.length - 70) / 16);
      for (let v = 0; v < ventCount; v++) {
        const vx = -halfL + 42 + v * 16;
        ctx.beginPath();
        ctx.moveTo(vx - 4, -depth / 2 + 20);
        ctx.lineTo(vx + 4, -depth / 2 + 10);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    // 5. Diagonal Yellow/Black Hazard Caution Stripes
    if (b.hasCaution) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-halfL, depth / 2 - bevel);
      ctx.lineTo(halfL, depth / 2 - bevel);
      ctx.lineTo(halfL + 16, depth / 2);
      ctx.lineTo(-halfL - 16, depth / 2);
      ctx.closePath();
      ctx.clip();

      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(-halfL - 30, depth / 2 - bevel - 4, b.length + 60, bevel + 10);

      ctx.fillStyle = '#080d1a';
      for (let s = -halfL - 40; s < halfL + 40; s += 22) {
        ctx.beginPath();
        ctx.moveTo(s, depth / 2 - bevel - 4);
        ctx.lineTo(s + 18, depth / 2 + 8);
        ctx.lineTo(s + 6, depth / 2 + 8);
        ctx.lineTo(s - 12, depth / 2 - bevel - 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Glowing Neon Edge Rail along bottom
    ctx.strokeStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-halfL - 16, depth / 2);
    ctx.lineTo(halfL + 16, depth / 2);
    ctx.stroke();

    // Structural endcap brackets
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-halfL, -depth / 2); ctx.lineTo(-halfL - 16, depth / 2);
    ctx.moveTo(halfL, -depth / 2); ctx.lineTo(halfL + 16, depth / 2);
    ctx.stroke();

    // 7. Defensive Tesla Core Caps on Bastion Chokepoints
    ctx.fillStyle = '#0a1020';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.8;
    for (const offset of [-halfL + 18, halfL - 18]) {
      ctx.beginPath();
      ctx.arc(offset, -depth / 2 + 14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(offset, -depth / 2 + 14, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _renderBulkheadUnit(ctx, originX, originY, dirX, dirY) {
    ctx.save();
    ctx.translate(originX, originY);
    ctx.scale(dirX, dirY);

    // Dark metallic chassis plate
    ctx.fillStyle = '#0a1024';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(440, 0);
    ctx.lineTo(340, 120);
    ctx.lineTo(200, 220);
    ctx.lineTo(120, 340);
    ctx.lineTo(0, 440);
    ctx.closePath();
    ctx.fill();

    // Secondary armored rim
    ctx.fillStyle = '#111a36';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(380, 0);
    ctx.lineTo(300, 95);
    ctx.lineTo(170, 190);
    ctx.lineTo(95, 300);
    ctx.lineTo(0, 380);
    ctx.closePath();
    ctx.fill();

    // Hazard Caution Striping Segment (Matching Reference Screenshot)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(340, 120);
    ctx.lineTo(200, 220);
    ctx.lineTo(170, 190);
    ctx.lineTo(300, 95);
    ctx.closePath();
    ctx.clip();

    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(150, 80, 220, 160);

    ctx.fillStyle = '#080d1a';
    ctx.lineWidth = 12;
    for (let s = -60; s < 300; s += 24) {
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(s + 120, 260);
      ctx.lineTo(s + 104, 260);
      ctx.lineTo(s - 16, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Glowing Neon Edge Rail & Cyber Seams
    ctx.strokeStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(440, 0);
    ctx.lineTo(340, 120);
    ctx.lineTo(200, 220);
    ctx.lineTo(120, 340);
    ctx.lineTo(0, 440);
    ctx.stroke();

    // Cyan status ventilation louvers
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
    ctx.lineWidth = 2.2;
    for (let v = 0; v < 4; v++) {
      const vx = 65 + v * 20;
      const vy = 65 + v * 20;
      ctx.beginPath();
      ctx.moveTo(vx - 14, vy + 14);
      ctx.lineTo(vx + 14, vy - 14);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawAmbientMotes(ctx, halfViewW, halfViewH) {
    const W = GAME_CONFIG.ARENA_WIDTH;
    const H = GAME_CONFIG.ARENA_HEIGHT;
    const minX = this.camera.x - halfViewW - 60;
    const maxX = this.camera.x + halfViewW + 60;
    const minY = this.camera.y - halfViewH - 60;
    const maxY = this.camera.y + halfViewH + 60;

    ctx.save();
    try {
      for (let i = 0; i < this.ambientMotes.length; i++) {
        const m = this.ambientMotes[i];
        m.x += m.vx * 0.016;
        m.y += m.vy * 0.016;

        // Wrap around arena
        if (m.x < 0) m.x += W;
        if (m.x > W) m.x -= W;
        if (m.y < 0) m.y += H;
        if (m.y > H) m.y -= H;

        if (m.x < minX || m.x > maxX || m.y < minY || m.y > maxY) continue;

        const pulse = 0.5 + Math.sin(this.gridPulse * m.pulseSpeed + m.offset) * 0.5;
        const alpha = m.baseAlpha * (0.6 + pulse * 0.4);

        ctx.fillStyle = m.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();

        // Hot center
        if (m.size > 2) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = alpha * 0.8;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } finally {
      ctx.restore();
    }
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
    if (this.width <= 0 || this.height <= 0) return;
    ctx.save();
    try {
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
      if (player && player.maxHealth > 0 && (player.health / player.maxHealth < 0.35)) {
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

        // Industrial Hazard Caution Stripes along Top & Bottom screen borders when critical (<30%)
        if (player.health / player.maxHealth < 0.3) {
          const stripeH = 14;
          const flash = (Math.sin(this.gridPulse * 6) > 0);
          ctx.fillStyle = flash ? 'rgba(255, 23, 79, 0.75)' : 'rgba(20, 6, 12, 0.85)';
          ctx.fillRect(0, 0, this.width, stripeH);
          ctx.fillRect(0, this.height - stripeH, this.width, stripeH);

          // Diagonal caution hazard hashes
          ctx.strokeStyle = flash ? '#ffe600' : '#ff174f';
          ctx.lineWidth = 3;
          const offset = (performance.now() * 0.05) % 24;
          ctx.beginPath();
          for (let x = -24; x < this.width + 24; x += 24) {
            ctx.moveTo(x + offset, 0); ctx.lineTo(x + offset + 12, stripeH);
            ctx.moveTo(x - offset, this.height - stripeH); ctx.lineTo(x - offset + 12, this.height);
          }
          ctx.stroke();

          // Emergency telemetry warning badge
          ctx.font = '900 12px Rajdhani, monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = flash ? '#ffffff' : '#ffe600';
          ctx.fillText('⚠️ CRITICAL HULL INTEGRITY // EMERGENCY PROTOCOL ACTIVE ⚠️', this.width / 2, stripeH + 12);
        }
      }
    } finally {
      ctx.restore();
    }
  }

  // ---- HOLOGRAPHIC TACTICAL RADAR (MINIMAP) ----
  drawRadar(player, enemies, powerupPool, activeBoss, teammate = null, hazardManager = null) {
    if (!player || !isFinite(player.x) || !isFinite(player.y) || this.width <= 0 || this.height <= 0) return;

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

    // 1.5 Draw Tactical Hazards & Environmental Features
    if (hazardManager) {
      // Energy Pylons (cyan diamond)
      for (let i = 0; i < hazardManager.pylons.length; i++) {
        const py = hazardManager.pylons[i];
        if (!py.active) continue;
        const pdx = py.x - player.x;
        const pdy = py.y - player.y;
        if (Math.hypot(pdx, pdy) < radarRange) {
          const rx = cx + (pdx / radarRange) * radius;
          const ry = cy + (pdy / radarRange) * radius;
          ctx.fillStyle = '#00f0ff';
          ctx.beginPath();
          ctx.moveTo(rx, ry - 3.5); ctx.lineTo(rx + 3.5, ry); ctx.lineTo(rx, ry + 3.5); ctx.lineTo(rx - 3.5, ry);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Volatile Barrels (small square)
      for (let i = 0; i < hazardManager.barrels.length; i++) {
        const br = hazardManager.barrels[i];
        if (!br.active) continue;
        const bdx = br.x - player.x;
        const bdy = br.y - player.y;
        if (Math.hypot(bdx, bdy) < radarRange) {
          const rx = cx + (bdx / radarRange) * radius;
          const ry = cy + (bdy / radarRange) * radius;
          ctx.fillStyle = br.type === 'cryo' ? '#00f0ff' : '#ff4400';
          ctx.fillRect(rx - 2, ry - 2, 4, 4);
        }
      }

      // Orbital Drop Pods (Pulsing Golden Beacon)
      for (let i = 0; i < hazardManager.dropPods.length; i++) {
        const pod = hazardManager.dropPods[i];
        if (!pod.active) continue;
        const odx = pod.x - player.x;
        const ody = pod.y - player.y;
        const odist = Math.hypot(odx, ody);
        if (odist < radarRange) {
          const rx = cx + (odx / radarRange) * radius;
          const ry = cy + (ody / radarRange) * radius;
          ctx.fillStyle = '#ffe600';
          ctx.beginPath();
          ctx.arc(rx, ry, 5 + Math.sin(this.radarSweep * 3) * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
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
    if (teammate && (teammate.active !== false)) {
      const tdx = teammate.x - player.x;
      const tdy = teammate.y - player.y;
      const tdist = Math.hypot(tdx, tdy);
      const tColor = (teammate.id === 2 || teammate.playerIndex === 2) ? '#ff00aa' : '#00f0ff';
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
    ctx.fillStyle = (player.id === 2 || player.playerIndex === 2) ? '#ff00aa' : '#00ffff';
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

    // 4.5 Off-screen Orbital Supply Pod Indicator Chevron
    if (hazardManager && hazardManager.dropPods) {
      for (let i = 0; i < hazardManager.dropPods.length; i++) {
        const pod = hazardManager.dropPods[i];
        if (!pod.active) continue;
        const odx = pod.x - player.x;
        const ody = pod.y - player.y;
        const odist = Math.hypot(odx, ody);
        if (odist > radarRange * 0.75) {
          const oAngle = Math.atan2(ody, odx);
          const indX = cx + Math.cos(oAngle) * (radius + 12);
          const indY = cy + Math.sin(oAngle) * (radius + 12);

          ctx.save();
          ctx.fillStyle = '#ffe600';
          ctx.translate(indX, indY);
          ctx.rotate(oAngle);
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
    }

    // 5. Off-Screen Teammate Direction Indicator on HUD (Multi-Device Freedom)
    if (teammate && (teammate.active !== false)) {
      const tScreen = this.getScreenPos(teammate.x, teammate.y);
      const margin = 50;
      const isOffScreen = tScreen.x < margin || tScreen.x > this.width - margin || tScreen.y < margin || tScreen.y > this.height - margin;

      if (isOffScreen) {
        const tColor = (teammate.id === 2 || teammate.playerIndex === 2) ? '#ff00aa' : '#00f0ff';
        const tName = (teammate.id === 2 || teammate.playerIndex === 2) ? 'NOVA-02' : 'SPARK-01';
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
