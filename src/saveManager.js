// NEON HAVOC — Save Manager (LocalStorage & JSON Persistence)

const SAVE_KEY = 'neon_havoc_save_v1';

const DEFAULT_SAVE = {
  version: 1,
  spectrumShards: 150, // Starting bonus shards
  unlockedSectors: ['sector_1'],
  metaUpgrades: {
    meta_health: 0,
    meta_speed: 0,
    meta_damage: 0,
    meta_magnet: 0,
    meta_dash: 0,
    meta_harvest: 0,
  },
  stats: {
    totalRuns: 0,
    totalKills: 0,
    totalCrystals: 0,
    bossesDefeated: 0,
    bestTime: 0,
    highestWave: 1,
    bestScore: 0,
  },
  settings: {
    masterVolume: 0.7,
    sfxVolume: 0.8,
    musicVolume: 0.45,
    screenShake: true,
    autoFire: true,
    autoAim: true,
    laserSight: false,
    damageNumbers: true,
  },
};

class SaveManager {
  constructor() {
    this.data = this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SAVE));
      const parsed = JSON.parse(raw);
      // Merge with defaults in case of new fields
      return {
        ...DEFAULT_SAVE,
        ...parsed,
        metaUpgrades: { ...DEFAULT_SAVE.metaUpgrades, ...(parsed.metaUpgrades || {}) },
        stats: { ...DEFAULT_SAVE.stats, ...(parsed.stats || {}) },
        settings: { ...DEFAULT_SAVE.settings, ...(parsed.settings || {}) },
        unlockedSectors: parsed.unlockedSectors || DEFAULT_SAVE.unlockedSectors,
      };
    } catch (e) {
      console.warn('Failed to load save file, using default', e);
      return JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  addShards(amount) {
    this.data.spectrumShards = Math.max(0, (this.data.spectrumShards || 0) + amount);
    this.save();
    return this.data.spectrumShards;
  }

  getMetaRank(upgradeId) {
    return this.data.metaUpgrades[upgradeId] || 0;
  }

  upgradeMeta(upgradeId, cost) {
    if (this.data.spectrumShards < cost) return false;
    this.data.spectrumShards -= cost;
    this.data.metaUpgrades[upgradeId] = (this.data.metaUpgrades[upgradeId] || 0) + 1;
    this.save();
    return true;
  }

  refundMetaUpgrades(metaUpgradesDef) {
    if (!metaUpgradesDef || !Array.isArray(metaUpgradesDef)) return 0;
    let totalRefund = 0;

    metaUpgradesDef.forEach((meta) => {
      const currentRank = this.data.metaUpgrades[meta.id] || 0;
      if (currentRank > 0 && Array.isArray(meta.costs)) {
        for (let r = 0; r < currentRank; r++) {
          totalRefund += meta.costs[r] || 0;
        }
      }
      this.data.metaUpgrades[meta.id] = 0;
    });

    this.data.spectrumShards = (this.data.spectrumShards || 0) + totalRefund;
    this.save();
    return totalRefund;
  }

  recordRunResult({ time, kills, crystals, wave, score, bossKilled, sectorId }) {
    this.data.stats.totalRuns += 1;
    this.data.stats.totalKills += kills;
    this.data.stats.totalCrystals += crystals;
    if (bossKilled) this.data.stats.bossesDefeated += 1;

    if (time > this.data.stats.bestTime) this.data.stats.bestTime = time;
    if (wave > this.data.stats.highestWave) this.data.stats.highestWave = wave;
    if (score > this.data.stats.bestScore) this.data.stats.bestScore = score;

    // Unlock next sector on completing wave 10 or beating boss
    if (sectorId === 'sector_1' && (bossKilled || wave >= 10)) {
      if (!this.data.unlockedSectors.includes('sector_2')) {
        this.data.unlockedSectors.push('sector_2');
      }
    } else if (sectorId === 'sector_2' && (bossKilled || wave >= 10)) {
      if (!this.data.unlockedSectors.includes('sector_3')) {
        this.data.unlockedSectors.push('sector_3');
      }
    }

    this.save();
  }

  exportSaveString() {
    return btoa(JSON.stringify(this.data));
  }

  importSaveString(encodedStr) {
    try {
      const decoded = atob(encodedStr);
      const parsed = JSON.parse(decoded);
      this.data = { ...DEFAULT_SAVE, ...parsed };
      this.save();
      return true;
    } catch (e) {
      return false;
    }
  }

  resetAll() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE));
    this.save();
  }
}

export const saveManager = new SaveManager();

