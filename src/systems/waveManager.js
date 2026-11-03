// NEON HAVOC — 30X Wave Progression, Elite Champions & Dual Boss Director

import { ENEMY_TYPES, GAME_CONFIG } from '../constants.js';
import { Enemy } from '../entities/enemy.js';

export class WaveManager {
  constructor(sector) {
    this.sector = sector;
    this.timer = 0;
    this.targetTime = sector.targetTime || GAME_CONFIG.DEFAULT_RUN_TIME;
    this.currentWave = 1;
    this.totalWaves = 20;

    this.spawnTimer = 0;
    this.spawnInterval = 1.6;
    this.boss1Spawned = false;
    this.boss1Defeated = false;
    this.boss2Spawned = false;
    this.boss2Defeated = false;
    this.isVictory = false;

    this.spawnQueue = [];
  }

  _getTargetPlayer(player) {
    if (Array.isArray(player)) {
      const alive = player.filter(p => p && !p.isDowned);
      if (alive.length > 0) {
        return alive[Math.floor(Math.random() * alive.length)];
      }
      return player[0] || null;
    }
    return player || null;
  }

  update(dt, player, enemies, soundEngine, particlePool, floatingTexts, onBossSpawn, onVictory) {
    this.timer += dt;

    const targetPlayer = this._getTargetPlayer(player);
    const targetX = targetPlayer ? targetPlayer.x : GAME_CONFIG.ARENA_WIDTH / 2;
    const targetY = targetPlayer ? targetPlayer.y : GAME_CONFIG.ARENA_HEIGHT / 2;

    const waveProgress = Math.min(1, this.timer / this.targetTime);
    const calculatedWave = Math.min(this.totalWaves, Math.floor(waveProgress * this.totalWaves) + 1);

    if (calculatedWave !== this.currentWave) {
      this.currentWave = calculatedWave;
      this.spawnInterval = Math.max(0.32, 1.6 - (this.currentWave - 1) * 0.065);
      floatingTexts.spawn(targetX, targetY - 45, `WAVE ${this.currentWave}!`, '#00f0ff', '#00f0ff', true, 20);
    }

    // Boss 1: Wave 10 (or 50% time)
    if (!this.boss1Spawned && (this.currentWave >= 10 || this.timer >= this.targetTime * 0.5)) {
      this.boss1Spawned = true;
      this._spawnBoss(player, enemies, soundEngine, onBossSpawn, ENEMY_TYPES.VOID_BOSS);
    }

    // Boss 2: Final Boss at Wave 20 (Only in Sector 3 or after target time)
    const isFinalSector = this.sector && this.sector.id === 'sector_3';
    if (isFinalSector && !this.boss2Spawned && (this.currentWave >= 20 || this.timer >= this.targetTime * 0.95)) {
      this.boss2Spawned = true;
      this._spawnBoss(player, enemies, soundEngine, onBossSpawn, ENEMY_TYPES.SINGULARITY_BOSS);
    }

    // Check Victory
    if (!this.isVictory) {
      if (isFinalSector) {
        if (this.boss2Defeated) {
          this.isVictory = true;
          onVictory();
          return;
        }
      } else {
        if (this.boss1Defeated && (this.timer >= this.targetTime || this.currentWave >= 20)) {
          this.isVictory = true;
          onVictory();
          return;
        }
      }
    }

    // 1. Process queued summons
    while (this.spawnQueue.length > 0) {
      const q = this.spawnQueue.shift();
      const waveMult = 1 + (this.currentWave - 1) * 0.12;
      enemies.push(new Enemy(q.type, q.x, q.y, waveMult));
    }

    // 2. Continuous arena spawning
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this._spawnWaveBatch(player, enemies);
    }
  }

  _spawnWaveBatch(player, enemies) {
    const baseCount = 2 + Math.floor(this.currentWave * 0.75);
    const count = Math.min(26, baseCount);
    const types = this._getEligibleTypes();

    const targetPlayer = this._getTargetPlayer(player);
    const centerX = targetPlayer ? targetPlayer.x : GAME_CONFIG.ARENA_WIDTH / 2;
    const centerY = targetPlayer ? targetPlayer.y : GAME_CONFIG.ARENA_HEIGHT / 2;

    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 720 + Math.random() * 240;
    const originX = centerX + Math.cos(spawnAngle) * spawnDist;
    const originY = centerY + Math.sin(spawnAngle) * spawnDist;

    const waveMult = 1 + (this.currentWave - 1) * 0.14;
    const eliteEligible = this.currentWave >= 4 && Math.random() < 0.16;
    const eliteIndex = eliteEligible ? Math.floor(Math.random() * count) : -1;
    const eliteAffixes = ['swift', 'shielded', 'mortar', 'splitter_king'];

    for (let i = 0; i < count; i++) {
      const enemyType = types[Math.floor(Math.random() * types.length)];
      const offsetX = (Math.random() - 0.5) * 180;
      const offsetY = (Math.random() - 0.5) * 180;

      const px = Math.max(50, Math.min(GAME_CONFIG.ARENA_WIDTH - 50, originX + offsetX));
      const py = Math.max(50, Math.min(GAME_CONFIG.ARENA_HEIGHT - 50, originY + offsetY));

      const isElite = i === eliteIndex;
      const eliteType = eliteAffixes[Math.floor(Math.random() * eliteAffixes.length)];

      enemies.push(new Enemy(enemyType, px, py, waveMult, isElite, eliteType));
    }
  }

  _getEligibleTypes() {
    if (this.currentWave <= 2) {
      return [ENEMY_TYPES.CHASER];
    } else if (this.currentWave <= 5) {
      return [ENEMY_TYPES.CHASER, ENEMY_TYPES.SPEEDER];
    } else if (this.currentWave <= 8) {
      return [ENEMY_TYPES.CHASER, ENEMY_TYPES.SPEEDER, ENEMY_TYPES.TANK, ENEMY_TYPES.SPLITTER];
    } else if (this.currentWave <= 12) {
      return [
        ENEMY_TYPES.CHASER,
        ENEMY_TYPES.SPEEDER,
        ENEMY_TYPES.TANK,
        ENEMY_TYPES.SPLITTER,
        ENEMY_TYPES.SNIPER,
      ];
    } else {
      return [
        ENEMY_TYPES.CHASER,
        ENEMY_TYPES.SPEEDER,
        ENEMY_TYPES.TANK,
        ENEMY_TYPES.SPLITTER,
        ENEMY_TYPES.SNIPER,
        ENEMY_TYPES.EXPLODER,
      ];
    }
  }

  _spawnBoss(player, enemies, soundEngine, onBossSpawn, bossType = ENEMY_TYPES.VOID_BOSS) {
    soundEngine.playBossAlert();
    soundEngine.setIntensity(3);

    const targetPlayer = this._getTargetPlayer(player);
    const centerX = targetPlayer ? targetPlayer.x : GAME_CONFIG.ARENA_WIDTH / 2;
    const centerY = targetPlayer ? targetPlayer.y : GAME_CONFIG.ARENA_HEIGHT / 2;

    const angle = Math.random() * Math.PI * 2;
    const bx = Math.max(120, Math.min(GAME_CONFIG.ARENA_WIDTH - 120, centerX + Math.cos(angle) * 650));
    const by = Math.max(120, Math.min(GAME_CONFIG.ARENA_HEIGHT - 120, centerY + Math.sin(angle) * 650));

    const boss = new Enemy(bossType, bx, by, 1 + this.currentWave * 0.12);
    enemies.push(boss);

    if (onBossSpawn) {
      onBossSpawn(boss);
    }
  }
}
