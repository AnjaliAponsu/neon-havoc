// NEON HAVOC — Roguelite Upgrade Card Selector

import { UPGRADES_POOL } from '../constants.js';

export class UpgradeManager {
  constructor() {
    this.currentChoices = [];
  }

  generateChoices(player, count = 3) {
    // Filter available pool
    const available = UPGRADES_POOL.filter((u) => {
      if (u.condition && !u.condition(player)) return false;
      return true;
    });

    // Shuffle and pick
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    this.currentChoices = shuffled.slice(0, count);
    return this.currentChoices;
  }

  applyChoice(index, player) {
    if (index >= 0 && index < this.currentChoices.length) {
      const upgrade = this.currentChoices[index];
      upgrade.apply(player);
      this.currentChoices = [];
      return upgrade;
    }
    return null;
  }
}

export const upgradeManager = new UpgradeManager();

