// Цвета панелей в зависимости от уровня
const TIER_STYLES = {
  // tier 1-3: серый
  gray:  { fill: 0x808080, stroke: 0xa0a0a0 },
  // tier 4-6: синий
  blue:  { fill: 0x4a90e2, stroke: 0x6ab0ff },
  // tier 7-9: золотой
  gold:  { fill: 0xf39c12, stroke: 0xf5c842 },
}

function getStyle(tier) {
  if (tier <= 3) return TIER_STYLES.gray
  if (tier <= 6) return TIER_STYLES.blue
  if (tier <= 9) return TIER_STYLES.gold
  // tier 10 — вернём золотой, мигание сделаем в create()
  return TIER_STYLES.gold
}

export default class Panel extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, tier) {
    const style = getStyle(tier)
    super(scene, x, y, 64, 64, style.fill, 1)

    this.tier = tier
    this.power = tier * 10
    this.gridX = -1
    this.gridY = -1

    // Настройка визуала
    this.setStrokeStyle(2, style.stroke, 1)

    // Текст с номером уровня
    this.label = scene.add.text(x, y, `${tier}`, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Интерактивность
    this.setInteractive({ useHandCursor: true })
    this.setDepth(1)

    // Мигание для 10-го уровня
    if (tier === 10) {
      scene.tweens.add({
        targets: this,
        alpha: { from: 1, to: 0.3 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      })
    }

    scene.add.existing(this)
  }

  setGridPos(gx, gy) {
    this.gridX = gx
    this.gridY = gy
  }

  // Обновляем позицию и текст
  setPanelPosition(x, y) {
    this.setPosition(x, y)
    this.label.setPosition(x, y)
  }

  destroy() {
    this.label.destroy()
    super.destroy()
  }
}
