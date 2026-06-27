const ALL_ACHIEVEMENTS = [
  // Слияние
  {
    id: 'first_merge', category: 'merge', name: 'Первое слияние',
    desc: 'Объедини 2 панели', icon: '🔀',
    target: 1, reward: { coins: 50 },
  },
  {
    id: 'merge_master', category: 'merge', name: 'Мастер слияния',
    desc: 'Выполни 100 слияний', icon: '🔀',
    target: 100, reward: { coins: 500 },
  },
  {
    id: 'merge_legend', category: 'merge', name: 'Легенда слияния',
    desc: 'Выполни 1000 слияний', icon: '🔀',
    target: 1000, reward: { coins: 2000 },
  },
  {
    id: 'max_tier', category: 'merge', name: 'Максимальный уровень',
    desc: 'Создай панель tier 10', icon: '💎',
    target: 1, reward: { coins: 1000, golden: 1 },
  },
  {
    id: 'fast_merge', category: 'merge', name: 'Скоростное слияние',
    desc: '10 слияний за 1 минуту', icon: '⚡',
    target: 1, reward: { boost: 'coins_x3' },
  },
  // Энергия
  {
    id: 'first_energy', category: 'energy', name: 'Первая энергия',
    desc: 'Накопи 100 энергии', icon: '⚡',
    target: 100, reward: { coins: 50 },
  },
  {
    id: 'energy_mid', category: 'energy', name: 'Энергетик',
    desc: 'Накопи 10000 энергии', icon: '⚡',
    target: 10000, reward: { coins: 500 },
  },
  {
    id: 'energy_master', category: 'energy', name: 'Магнат энергии',
    desc: 'Накопи 100000 энергии', icon: '⚡',
    target: 100000, reward: { coins: 2000 },
  },
  {
    id: 'offline_hero', category: 'energy', name: 'Офлайн-герой',
    desc: 'Получи 5000 энергии офлайн', icon: '💤',
    target: 5000, reward: { boost: 'energy_x2' },
  },
  {
    id: 'energy_burst', category: 'energy', name: 'Энергетический взрыв',
    desc: '1000 энергии за 1 минуту', icon: '🔥',
    target: 1, reward: { coins: 1000 },
  },
  // Заказы
  {
    id: 'first_order', category: 'orders', name: 'Первый заказ',
    desc: 'Выполни 1 заказ', icon: '📋',
    target: 1, reward: { coins: 50 },
  },
  {
    id: 'orders_mid', category: 'orders', name: 'Надежный партнер',
    desc: 'Выполни 50 заказов', icon: '📋',
    target: 50, reward: { coins: 500 },
  },
  {
    id: 'orders_master', category: 'orders', name: 'Легендарный поставщик',
    desc: 'Выполни 500 заказов', icon: '📋',
    target: 500, reward: { coins: 2000 },
  },
  {
    id: 'generous', category: 'orders', name: 'Щедрый',
    desc: '10 заказов с x2 наградой', icon: '🪙',
    target: 10, reward: { boost: 'coins_x3' },
  },
  {
    id: 'speed_orders', category: 'orders', name: 'Скоростной',
    desc: '5 заказов за 2 минуты', icon: '⏱️',
    target: 1, reward: { coins: 1000 },
  },
  // Город
  {
    id: 'city_2', category: 'city', name: 'Первый город',
    desc: 'Достигни уровня 2', icon: '🏘️',
    target: 2, reward: { coins: 100 },
  },
  {
    id: 'city_5', category: 'city', name: 'Мэр',
    desc: 'Достигни уровня 5', icon: '🏘️',
    target: 5, reward: { coins: 500 },
  },
  {
    id: 'city_10', category: 'city', name: 'Губернатор',
    desc: 'Достигни уровня 10', icon: '🏘️',
    target: 10, reward: { coins: 2000 },
  },
  {
    id: 'city_20', category: 'city', name: 'Президент',
    desc: 'Достигни уровня 20', icon: '🏘️',
    target: 20, reward: { coins: 5000 },
  },
  {
    id: 'city_50', category: 'city', name: 'Император',
    desc: 'Достигни уровня 50', icon: '👑',
    target: 50, reward: { coins: 10000, golden: 3 },
  },
]

export default class AchievementSystem {
  constructor(scene) {
    this.scene = scene
    this.progress = {}
    this.unlocked = []
    for (const a of ALL_ACHIEVEMENTS) {
      this.progress[a.id] = 0
    }
  }

  getAchievements() { return ALL_ACHIEVEMENTS }

  getByCategory(cat) { return ALL_ACHIEVEMENTS.filter(a => a.category === cat) }

  isUnlocked(id) { return this.unlocked.includes(id) }

  getProgress(id) { return this.progress[id] || 0 }

  getDef(id) { return ALL_ACHIEVEMENTS.find(a => a.id === id) }

  /** Добавить прогресс к ачивке */
  addProgress(id, amount = 1) {
    if (this.isUnlocked(id)) return
    const def = this.getDef(id)
    if (!def) return

    this.progress[id] = Math.min((this.progress[id] || 0) + amount, def.target)
    if (this.progress[id] >= def.target) {
      this.unlock(id)
    }
  }

  /** Проверить условие ачивки (для булевых) */
  checkCondition(id, value) {
    if (this.isUnlocked(id)) return
    const def = this.getDef(id)
    if (!def) return
    if (value >= def.target) {
      this.unlock(id)
    }
  }

  unlock(id) {
    if (this.unlocked.includes(id)) return
    this.unlocked.push(id)
    const def = this.getDef(id)

    // Сразу выдаём награду
    if (def.reward.coins) this.scene.coins += def.reward.coins
    if (def.reward.golden) {
      for (let i = 0; i < def.reward.golden; i++) {
        const e = []; for (let r = 0; r < this.scene.ROWS; r++) for (let c = 0; c < this.scene.COLS; c++) if (!this.scene.gridCells[r][c].occupied) e.push({ row: r, col: c })
        if (e.length === 0) break
        const cell = Phaser.Math.RND.pick(e)
        this.scene.spawnPanelAt(1, cell.row, cell.col, 'golden')
      }
    }
    if (def.reward.boost) {
      this.scene.boostSystem.activate(def.reward.boost, true)
    }

    this.scene.refreshCoinsUI()
    this.scene.saveGame()

    // Попап
    this.scene.showAchievementPopup(def)
  }

  /** Обновить всё (вызывается после загрузки) */
  refreshAll() {
    this.checkCityLevel()
    this.checkEnergyAchievements()
  }

  checkCityLevel() {
    const level = Math.min(Math.floor(this.scene.completedOrders / 3) + 1, 10)
    this.checkCondition('city_2', level)
    this.checkCondition('city_5', level)
    this.checkCondition('city_10', level)
  }

  checkEnergyAchievements() {
    this.addProgress('first_energy', 0)
    this.addProgress('energy_mid', 0)
    this.addProgress('energy_master', 0)
  }
}
