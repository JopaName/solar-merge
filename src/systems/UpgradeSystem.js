export const UPGRADES = {
  PANEL_EFFICIENCY: {
    id: 'panel_efficiency',
    name: 'Эффективность панелей',
    icon: '⚡',
    desc: '+10% энергии за уровень',
    maxLevel: 10,
    getCost: (level) => 100 * (level + 1),
    apply: (level) => 1 + level * 0.1,
  },
  GENERATION_SPEED: {
    id: 'gen_speed',
    name: 'Скорость генерации',
    icon: '⏱️',
    desc: 'Энергия чаще (1000ms → 500ms)',
    maxLevel: 10,
    getCost: (level) => 150 * (level + 1),
    getDelay: (level) => Math.max(500, 1000 - level * 50),
  },
  GRID_SIZE: {
    id: 'grid_size',
    name: 'Размер сетки',
    icon: '🔲',
    desc: '+1 к размеру сетки за 2 уровня',
    maxLevel: 10,
    getCost: (level) => 500 * (level + 1),
    getGridSize: (level) => Math.min(9, 5 + Math.floor((level + 1) / 2)),
  },
  CITY_GENEROSITY: {
    id: 'city_gen',
    name: 'Щедрость городов',
    icon: '🏛️',
    desc: '+20% монет за заказ за уровень',
    maxLevel: 10,
    getCost: (level) => 200 * (level + 1),
    apply: (level) => 1 + level * 0.2,
  },
  MERGE_LUCK: {
    id: 'merge_luck',
    name: 'Удача слияния',
    icon: '🍀',
    desc: '5% шанс tier+2 при слиянии (tier 1-5)',
    maxLevel: 10,
    getCost: (level) => 300 * (level + 1),
    getChance: (level) => level * 0.05,
  },
}

export default class UpgradeSystem {
  constructor(scene) {
    this.scene = scene
    this.levels = {}
    for (const key of Object.keys(UPGRADES)) {
      this.levels[UPGRADES[key].id] = 0
    }
  }

  getLevel(upgradeId) {
    return this.levels[upgradeId] || 0
  }

  isMaxLevel(upgradeId) {
    const def = Object.values(UPGRADES).find(u => u.id === upgradeId)
    return this.getLevel(upgradeId) >= (def ? def.maxLevel : 10)
  }

  getCost(upgradeId) {
    const def = Object.values(UPGRADES).find(u => u.id === upgradeId)
    if (!def) return Infinity
    return def.getCost(this.getLevel(upgradeId))
  }

  buy(upgradeId) {
    const def = Object.values(UPGRADES).find(u => u.id === upgradeId)
    if (!def || this.isMaxLevel(upgradeId)) return false

    const cost = this.getCost(upgradeId)
    if (this.scene.coins < cost) return false

    this.scene.coins -= cost
    this.levels[upgradeId]++
    this.scene.saveGame()
    this.scene.refreshCoinsUI()
    this.scene.toast.show(`Апгрейд ${def.name} до ${this.levels[upgradeId]} уровня!`, 'success')

    // Специальные эффекты
    if (upgradeId === 'grid_size') {
      this.scene.rebuildGrid()
    }
    if (upgradeId === 'gen_speed') {
      this.scene.resetEnergyTimer()
    }
    if (upgradeId === 'panel_efficiency') {
      this.scene.updateEnergy()
    }

    return true
  }

  /** Получить множитель эффективности панелей */
  getPanelMultiplier() {
    return UPGRADES.PANEL_EFFICIENCY.apply(this.getLevel('panel_efficiency'))
  }

  /** Получить множитель наград заказов */
  getRewardMultiplier() {
    return UPGRADES.CITY_GENEROSITY.apply(this.getLevel('city_gen'))
  }

  /** Получить шанс удачного слияния */
  getMergeLuckChance() {
    return UPGRADES.MERGE_LUCK.getChance(this.getLevel('merge_luck'))
  }

  /** Задержка генерации энергии */
  getGenerationDelay() {
    return UPGRADES.GENERATION_SPEED.getDelay(this.getLevel('gen_speed'))
  }

  /** Размер сетки */
  getGridSize() {
    return UPGRADES.GRID_SIZE.getGridSize(this.getLevel('grid_size'))
  }
}
