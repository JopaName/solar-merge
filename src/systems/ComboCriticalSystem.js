export default class ComboCriticalSystem {
  constructor(scene) {
    this.scene = scene
    this.comboCount = 0
    this.lastMergeTime = 0
    this.comboActive = false
    this.comboTimer = null
    this.autoMergeUses = 0
  }

  /** Вызывается при каждом слиянии */
  onMerge() {
    const now = Date.now()

    // Combo: 3 слияния за 10 секунд
    if (now - this.lastMergeTime < 10000) {
      this.comboCount++
    } else {
      this.comboCount = 1
    }
    this.lastMergeTime = now

    if (this.comboCount >= 3 && !this.comboActive) {
      this.activateCombo()
    }
  }

  activateCombo() {
    this.comboActive = true
    this.comboCount = 0

    const text = this.scene.add.text(400, 250, 'COMBO x2!', {
      fontSize: '36px', fontFamily: 'Arial', color: '#ff9800', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(250)

    this.scene.tweens.add({
      targets: text,
      scale: { from: 0.5, to: 1.5 },
      alpha: { from: 1, to: 0 },
      duration: 1500,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    })

    this.scene.toast.show('COMBO x2! Энергия удвоена на 30с!', 'success')

    // Активируем буст x2 на 30 секунд
    this.scene.boostSystem.activeBoosts.push({
      id: 'combo_x2',
      expiresAt: Date.now() + 30000,
    })
    this.scene.updateEnergy()

    if (this.comboTimer) clearTimeout(this.comboTimer)
    this.comboTimer = setTimeout(() => {
      this.comboActive = false
      this.scene.boostSystem.activeBoosts = this.scene.boostSystem.activeBoosts.filter(b => b.id !== 'combo_x2')
      this.scene.updateEnergy()
    }, 30000)
  }

  /** Проверка на критическое слияние (10% шанс → tier+2) */
  checkCritical() {
    if (Math.random() < 0.1) {
      const text = this.scene.add.text(400, 200, 'CRITICAL!', {
        fontSize: '40px', fontFamily: 'Arial', color: '#ff4444', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(250)

      this.scene.tweens.add({
        targets: text,
        y: 180, alpha: 0,
        duration: 1200,
        ease: 'Power2',
        onComplete: () => text.destroy(),
      })

      this.scene.particles.flash(400, 300)
      this.scene.particles.burst(400, 300, 0xff4444, 16, { speed: 120, size: 5 })
      return true
    }
    return false
  }

  /** Авто-сбор: каждые 30 секунд объединяет 2 случайные панели одного tier */
  tryAutoMerge() {
    if (this.autoMergeUses <= 0) return
    const cells = this.scene.gridCells
    if (!cells) return

    // Ищем пары одинакового tier
    const tierMap = {}
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < cells[r].length; c++) {
        if (cells[r][c].occupied && cells[r][c].panel) {
          const tier = cells[r][c].panel.tier
          if (!tierMap[tier]) tierMap[tier] = []
          tierMap[tier].push({ row: r, col: c })
        }
      }
    }

    let merged = false
    for (const tier of Object.keys(tierMap)) {
      const arr = tierMap[tier]
      if (arr.length >= 2) {
        const p1 = arr[0], p2 = arr[1]
        this.scene.merge(cells[p1.row][p1.col].panel, cells[p2.row][p2.col].panel, p1.row, p1.col)
        this.autoMergeUses--
        merged = true
        break
      }
    }

    if (!merged) {
      this.scene.toast.show('Нет панелей для авто-слияния', 'info')
    }
  }
}
