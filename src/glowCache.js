// NEON HAVOC — Pre-rendered High-Performance Glow Sprite Cache
// Eliminates expensive real-time canvas shadowBlur filters for a 30x framerate boost!

export class GlowCache {
  constructor() {
    this.cache = new Map();
    this._initCommonSprites();
  }

  _initCommonSprites() {
    const colors = [
      '#00f0ff', // Cyan (Player, Crystals, Shockwave)
      '#ff0077', // Pink (Overdrive, Shotgun)
      '#ff2255', // Red (Chasers, Boss, HP)
      '#ffe600', // Yellow (Speeders, Crits, Powerups)
      '#aa00ff', // Purple (Tanks, Singularity)
      '#00ff66', // Green (Splitters)
      '#0099ff', // Blue (Snipers)
      '#ff6600', // Orange (Exploders)
      '#ffffff', // White (Bullet Cores, Spark Hotspots)
      '#00ff88', // Emerald (Invulnerability)
      '#ffaa00', // Gold (Elites, Large Crystals)
    ];

    const sizes = [16, 24, 32, 48, 64, 96, 140, 200, 280, 360];
    for (const c of colors) {
      for (const s of sizes) {
        this._generateSprite(c, s);
      }
    }
  }

  _generateSprite(color, size) {
    const key = `${color}_${size}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const center = size / 2;
    const radius = size * 0.45;

    // Multi-stop radial gradient for rich neon bloom
    const grad = ctx.createRadialGradient(center, center, 0, center, center, radius);
    grad.addColorStop(0, '#ffffff'); // Intense white core
    grad.addColorStop(0.2, color);   // Saturated neon midtone
    grad.addColorStop(0.65, color);  // Glowing outer aura
    grad.addColorStop(1, 'rgba(0,0,0,0)'); // Transparent falloff

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();

    this.cache.set(key, canvas);
    return canvas;
  }

  getSprite(color, targetRadius) {
    // Pick closest size
    const idealSize = Math.max(16, targetRadius * 3);
    const sizes = [16, 24, 32, 48, 64, 96, 140, 200, 280, 360];
    let chosenSize = sizes[sizes.length - 1];

    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] >= idealSize) {
        chosenSize = sizes[i];
        break;
      }
    }

    const key = `${color}_${chosenSize}`;
    if (!this.cache.has(key)) {
      return this._generateSprite(color, chosenSize);
    }
    return this.cache.get(key);
  }

  drawGlow(ctx, x, y, radius, color, alpha = 1.0) {
    const sprite = this.getSprite(color, radius);
    const drawSize = radius * 3;
    const half = drawSize / 2;

    if (alpha < 1.0) {
      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = prevAlpha * alpha;
      ctx.drawImage(sprite, x - half, y - half, drawSize, drawSize);
      ctx.globalAlpha = prevAlpha;
    } else {
      ctx.drawImage(sprite, x - half, y - half, drawSize, drawSize);
    }
  }
}

export const glowCache = new GlowCache();

