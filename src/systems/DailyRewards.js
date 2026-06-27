const DAYS = [
  { day: 1, reward: { coins: 100 }, icon: '🪙', desc: '100 монет' },
  { day: 2, reward: { panels: 2, tier: 1 }, icon: '🟦', desc: '2 панели T1' },
  { day: 3, reward: { coins: 200 }, icon: '🪙', desc: '200 монет' },
  { day: 4, reward: { panels: 1, tier: 2 }, icon: '🟦', desc: '1 панель T2' },
  { day: 5, reward: { coins: 300 }, icon: '🪙', desc: '300 монет' },
  { day: 6, reward: { boost: 'energy_x2' }, icon: '⚡', desc: 'Буст x2 Энергия' },
  { day: 7, reward: { coins: 500, golden: 1 }, icon: '✨', desc: '500🪙 + Золотая панель' },
  { day: 8, reward: { coins: 150 }, icon: '🪙', desc: '150 монет' },
  { day: 9, reward: { panels: 2, tier: 1 }, icon: '🟦', desc: '2 панели T1' },
  { day: 10, reward: { coins: 300 }, icon: '🪙', desc: '300 монет' },
  { day: 11, reward: { panels: 1, tier: 3 }, icon: '🟦', desc: '1 панель T3' },
  { day: 12, reward: { coins: 450 }, icon: '🪙', desc: '450 монет' },
  { day: 13, reward: { boost: 'coins_x3' }, icon: '🪙', desc: 'Буст x3 Монеты' },
  { day: 14, reward: { coins: 750, golden: 1 }, icon: '✨', desc: '750🪙 + Золотая панель' },
  { day: 15, reward: { coins: 1000, booster: 1 }, icon: '🟣', desc: '1000🪙 + Бустер' },
  { day: 16, reward: { coins: 200 }, icon: '🪙', desc: '200 монет' },
  { day: 17, reward: { panels: 3, tier: 1 }, icon: '🟦', desc: '3 панели T1' },
  { day: 18, reward: { coins: 400 }, icon: '🪙', desc: '400 монет' },
  { day: 19, reward: { panels: 1, tier: 4 }, icon: '🟦', desc: '1 панель T4' },
  { day: 20, reward: { coins: 600 }, icon: '🪙', desc: '600 монет' },
  { day: 21, reward: { boost: 'energy_x2' }, icon: '⚡', desc: 'Буст x2 Энергия' },
  { day: 22, reward: { coins: 1000, golden: 1 }, icon: '✨', desc: '1000🪙 + Золотая панель' },
  { day: 23, reward: { coins: 300 }, icon: '🪙', desc: '300 монет' },
  { day: 24, reward: { panels: 2, tier: 2 }, icon: '🟦', desc: '2 панели T2' },
  { day: 25, reward: { coins: 500 }, icon: '🪙', desc: '500 монет' },
  { day: 26, reward: { panels: 1, tier: 5 }, icon: '🟦', desc: '1 панель T5' },
  { day: 27, reward: { boost: 'coins_x3' }, icon: '🪙', desc: 'Буст x3 Монеты' },
  { day: 28, reward: { coins: 1500, golden: 1 }, icon: '✨', desc: '1500🪙 + Золотая панель' },
  { day: 29, reward: { coins: 2000, booster: 1 }, icon: '🟣', desc: '2000🪙 + Бустер' },
  { day: 30, reward: { coins: 5000, golden: 3, boostAll: true }, icon: '👑', desc: '5000🪙 + 3✨ + Все бусты' },
]

export default class DailyRewards {
  constructor(scene) {
    this.scene = scene
    this.claimedDays = []
    this.lastClaimDate = null
    this.currentDay = 1
  }

  getDateStr() {
    return new Date().toISOString().split('T')[0]
  }

  checkDaily() {
    const today = this.getDateStr()
    if (this.lastClaimDate === today) return false
    if (this.lastClaimDate !== null) {
      const last = new Date(this.lastClaimDate)
      const diff = Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24))
      if (diff > 1) {
        this.currentDay = 1
        this.claimedDays = []
      }
    }
    return true
  }

  canClaim() {
    return this.checkDaily()
  }

  getCurrentDayIndex() {
    this.checkDaily()
    return Math.min(this.currentDay - 1, 29)
  }

  getCurrentDayData() {
    return DAYS[this.getCurrentDayIndex()]
  }

  claim(x2 = false) {
    if (!this.canClaim()) return null
    const data = this.getCurrentDayData()
    const reward = this.applyReward(data, x2)
    this.claimedDays.push(this.currentDay)
    this.lastClaimDate = this.getDateStr()
    this.currentDay = Math.min(this.currentDay + 1, 30)
    return reward
  }

  applyReward(data, x2) {
    const mult = x2 ? 2 : 1
    const scene = this.scene

    if (data.reward.coins) {
      scene.coins += data.reward.coins * mult
    }
    if (data.reward.panels) {
      for (let i = 0; i < data.reward.panels; i++) {
        const e = []; for (let r = 0; r < scene.ROWS; r++) for (let c = 0; c < scene.COLS; c++) if (!scene.gridCells[r][c].occupied) e.push({ row: r, col: c })
        if (e.length === 0) break
        const cell = Phaser.Math.RND.pick(e)
        scene.spawnPanelAt(data.reward.tier, cell.row, cell.col)
      }
    }
    if (data.reward.golden) {
      for (let i = 0; i < data.reward.golden * mult; i++) {
        const e = []; for (let r = 0; r < scene.ROWS; r++) for (let c = 0; c < scene.COLS; c++) if (!scene.gridCells[r][c].occupied) e.push({ row: r, col: c })
        if (e.length === 0) break
        const cell = Phaser.Math.RND.pick(e)
        scene.spawnPanelAt(1, cell.row, cell.col, 'golden')
      }
    }
    if (data.reward.booster) {
      for (let i = 0; i < data.reward.booster * mult; i++) {
        const e = []; for (let r = 0; r < scene.ROWS; r++) for (let c = 0; c < scene.COLS; c++) if (!scene.gridCells[r][c].occupied) e.push({ row: r, col: c })
        if (e.length === 0) break
        const cell = Phaser.Math.RND.pick(e)
        scene.spawnPanelAt(1, cell.row, cell.col, 'booster')
      }
    }
    if (data.reward.boost) {
      scene.boostSystem.activate(data.reward.boost, true)
    }
    if (data.reward.boostAll) {
      scene.boostSystem.activate('energy_x2', true)
      scene.boostSystem.activate('coins_x3', true)
    }

    scene.refreshCoinsUI()
    scene.refreshTopBarUI()
    return { description: data.desc, coins: (data.reward.coins || 0) * mult }
  }

  static getDayData(day) {
    return DAYS.find(d => d.day === day) || DAYS[0]
  }

  static getAllDays() {
    return DAYS
  }
}
