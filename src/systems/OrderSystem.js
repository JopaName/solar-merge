const CITIES = [
  'Деревня Солнечная',
  'Посёлок Энергетик',
  'Город Лучезарный',
  'Мегаполис Гелиос',
]

let nextOrderId = 1

export default class OrderSystem {
  constructor(scene) {
    this.scene = scene
    this.orders = []
    this.maxOrders = 3
    this.completedCount = 0 // сколько заказов выполнено за ВСЮ игру
    this.sinceLastInterstitial = 0 // заказов после последнего interstitial
    this.totalRewardedAdsWatched = 0
  }

  /** Генерация одного заказа */
  generateOrder(maxPanelTier) {
    const city = Phaser.Math.RND.pick(CITIES)
    const minEnergy = 50
    const maxEnergy = Math.max(minEnergy, (maxPanelTier || 1) * 100)
    const requiredEnergy = Phaser.Math.Between(minEnergy, maxEnergy)
    const rewardCoins = requiredEnergy * 2

    return {
      id: nextOrderId++,
      city,
      requiredEnergy,
      rewardCoins,
    }
  }

  /** Заполнить слоты заказов до максимума */
  refillOrders(maxPanelTier) {
    while (this.orders.length < this.maxOrders) {
      this.orders.push(this.generateOrder(maxPanelTier))
    }
  }

  /** Получить самый высокий tier на сетке */
  getMaxPanelTier() {
    let max = 1
    const cells = this.scene.gridCells
    if (!cells) return max
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        if (cells[r][c].occupied && cells[r][c].panel) {
          max = Math.max(max, cells[r][c].panel.tier)
        }
      }
    }
    return max
  }

  /** Выполнить заказ по индексу */
  completeOrder(index) {
    if (index < 0 || index >= this.orders.length) return null
    const order = this.orders[index]
    if (this.scene.energy < order.requiredEnergy) return null

    this.orders.splice(index, 1)
    this.completedCount++
    this.sinceLastInterstitial++

    // Новый заказ через 5 секунд
    this.scene.time.delayedCall(5000, () => {
      this.orders.push(this.generateOrder(this.getMaxPanelTier()))
    })

    return order
  }

  /** Проверка, нужно ли показать interstitial (каждые 2 заказа) */
  shouldShowInterstitial() {
    if (this.sinceLastInterstitial >= 2) {
      this.sinceLastInterstitial = 0
      return true
    }
    return false
  }
}
