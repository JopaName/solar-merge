const BOOSTS = {
  ENERGY_X2: {
    id: 'energy_x2',
    name: 'x2 Энергия',
    icon: '⚡',
    desc: 'Вся энергия ×2 на 5 мин',
    adCost: 0,
    coinCost: 200,
    duration: 5 * 60 * 1000,
  },
  COINS_X3: {
    id: 'coins_x3',
    name: 'x3 Монеты',
    icon: '🪙',
    desc: 'Награды за заказы ×3 на 5 мин',
    adCost: 0,
    coinCost: 300,
    duration: 5 * 60 * 1000,
  },
  INSTANT_MERGE: {
    id: 'instant_merge',
    name: 'Мгновенное слияние',
    icon: '💫',
    desc: 'Автослияние при касании на 5 мин',
    adCost: 0,
    coinCost: 250,
    duration: 5 * 60 * 1000,
  },
}

export default class BoostSystem {
  constructor(scene) {
    this.scene = scene
    // Активные бусты: { id: 'energy_x2', expiresAt: timestamp }
    this.activeBoosts = []
  }

  /** Активировать буст */
  activate(boostId, fromAd = false) {
    const def = Object.values(BOOSTS).find(b => b.id === boostId)
    if (!def) return false

    if (!fromAd) {
      if (this.scene.coins < def.coinCost) return false
      this.scene.coins -= def.coinCost
      this.scene.refreshCoinsUI()
    }

    // Удаляем старый буст этого же типа
    this.activeBoosts = this.activeBoosts.filter(b => b.id !== boostId)

    this.activeBoosts.push({
      id: boostId,
      expiresAt: Date.now() + def.duration,
    })

    this.scene.toast.show(`Буст ${def.name} активирован на 5 мин!`, 'success')
    this.scene.saveGame()

    // Применяем эффекты
    if (boostId === 'energy_x2') this.scene.updateEnergy()
    if (boostId === 'coins_x3') this.scene.refreshOrdersUI()

    return true
  }

  /** Проверить активен ли буст */
  isActive(boostId) {
    const now = Date.now()
    this.activeBoosts = this.activeBoosts.filter(b => b.expiresAt > now)
    return this.activeBoosts.some(b => b.id === boostId)
  }

  /** Получить множитель энергии */
  getEnergyMultiplier() {
    return this.isActive('energy_x2') ? 2 : 1
  }

  /** Получить множитель монет */
  getCoinMultiplier() {
    return this.isActive('coins_x3') ? 3 : 1
  }

  /** Проверить мгновенное слияние */
  hasInstantMerge() {
    return this.isActive('instant_merge')
  }

  /** Получить оставшееся время буста в секундах */
  getRemainingSeconds(boostId) {
    const boost = this.activeBoosts.find(b => b.id === boostId)
    if (!boost) return 0
    return Math.max(0, Math.floor((boost.expiresAt - Date.now()) / 1000))
  }

  /** Очистить истёкшие */
  cleanExpired() {
    const now = Date.now()
    this.activeBoosts = this.activeBoosts.filter(b => b.expiresAt > now)
  }

  static getBoostDef(boostId) {
    return Object.values(BOOSTS).find(b => b.id === boostId)
  }

  static getAllBoosts() {
    return Object.values(BOOSTS)
  }
}
