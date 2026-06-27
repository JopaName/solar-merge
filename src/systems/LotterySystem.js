const LOTTERY_PRIZES = [
  { weight: 50, name: '200 монет', icon: '🪙', coins: 200 },
  { weight: 30, name: 'Панель T2', icon: '🟦', panel: { tier: 2, count: 1 } },
  { weight: 15, name: 'Золотая панель', icon: '✨', panel: { tier: 1, count: 1, type: 'golden' } },
  { weight: 4, name: 'Бустер-панель', icon: '🟣', panel: { tier: 1, count: 1, type: 'booster' } },
  { weight: 1, name: 'Джекпот! 1000🪙 + все бусты', icon: '👑', coins: 1000, boostAll: true },
]

export default class LotterySystem {
  constructor(scene) {
    this.scene = scene
    this.lastSpinTime = 0
    this.spinCooldown = 5 * 60 * 1000 // 5 min
  }

  canSpin() {
    return Date.now() - this.lastSpinTime >= this.spinCooldown
  }

  getRemainingSeconds() {
    return Math.max(0, Math.floor((this.spinCooldown - (Date.now() - this.lastSpinTime)) / 1000))
  }

  spin() {
    if (!this.canSpin()) return null
    this.lastSpinTime = Date.now()

    // Weighted random
    const total = LOTTERY_PRIZES.reduce((s, p) => s + p.weight, 0)
    let r = Math.random() * total
    for (const prize of LOTTERY_PRIZES) {
      r -= prize.weight
      if (r <= 0) return this.apply(prize)
    }
    return this.apply(LOTTERY_PRIZES[0])
  }

  apply(prize) {
    const scene = this.scene
    if (prize.coins) scene.coins += prize.coins
    if (prize.panel) {
      for (let i = 0; i < prize.panel.count; i++) {
        const e = []; for (let r = 0; r < scene.ROWS; r++) for (let c = 0; c < scene.COLS; c++) if (!scene.gridCells[r][c].occupied) e.push({ row: r, col: c })
        if (e.length === 0) break
        const cell = Phaser.Math.RND.pick(e)
        scene.spawnPanelAt(prize.panel.tier, cell.row, cell.col, prize.panel.type)
      }
    }
    if (prize.boostAll) {
      scene.boostSystem.activate('energy_x2', true)
      scene.boostSystem.activate('coins_x3', true)
    }
    scene.refreshCoinsUI()
    scene.saveGame()
    return prize
  }

  /** Анимация колеса — просто быстро меняем текст 10 раз */
  spinAnimation(onFinish) {
    let count = 0
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * LOTTERY_PRIZES.length)
      const p = LOTTERY_PRIZES[idx]
      if (this.scene.lotteryPopupText) {
        this.scene.lotteryPopupText.setText(`${p.icon} ${p.name}`)
      }
      count++
      if (count >= 15) {
        clearInterval(interval)
        if (onFinish) onFinish()
      }
    }, 80)
  }

  static getPrizes() { return LOTTERY_PRIZES }
}
