import Panel from './Panel.js'

/** Золотая панель — x5 энергии, tier+2 при слиянии, нельзя слить с другой золотой */
export class GoldenPanel extends Panel {
  constructor(scene, x, y, tier) {
    super(scene, x, y, tier)
    this.power = tier * 50
    this.isGolden = true

    // Золотой блеск
    if (this.fallbackRect) {
      this.fallbackRect.setFillStyle(0xffd700)
      this.fallbackRect.setStrokeStyle(3, 0xfff176)
    }
    if (this.label) this.label.setColor('#ffd700')

    scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.6 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    })

    this.label.setText('✨' + tier)
  }
}

/** Бустер-панель — tier+3 при слиянии, исчезает после использования */
export class BoosterPanel extends Panel {
  constructor(scene, x, y, tier) {
    super(scene, x, y, tier)
    this.isBooster = true

    if (this.fallbackRect) {
      this.fallbackRect.setFillStyle(0x9b59b6)
      this.fallbackRect.setStrokeStyle(3, 0xbb8fce)
    }
    if (this.label) this.label.setColor('#bb8fce')
    this.label.setText('⚡' + tier)
  }
}

/** Копилка — накапливает энергию, отдаёт монеты при слиянии с tier 5+ */
export class PiggyBankPanel extends Panel {
  constructor(scene, x, y, tier) {
    super(scene, x, y, tier)
    this.isPiggy = true
    this.savedCoins = 0

    if (this.fallbackRect) {
      this.fallbackRect.setFillStyle(0xff69b4)
      this.fallbackRect.setStrokeStyle(3, 0xffb6c1)
    }
    if (this.label) this.label.setColor('#ff69b4')

    this.label.setText('🐷' + tier)
  }

  addSavings(energyDelta) {
    this.savedCoins += Math.floor(energyDelta * 0.1)
    this.updateLabel()
  }

  updateLabel() {
    if (this.label) this.label.setText('🐷' + this.savedCoins)
  }
}
