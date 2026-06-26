const TIER_STYLES = {
  gray:  { fill: 0x808080, stroke: 0xa0a0a0 },
  blue:  { fill: 0x4a90e2, stroke: 0x6ab0ff },
  gold:  { fill: 0xf39c12, stroke: 0xf5c842 },
}

function getStyle(tier) {
  if (tier <= 3) return TIER_STYLES.gray
  if (tier <= 6) return TIER_STYLES.blue
  if (tier <= 9) return TIER_STYLES.gold
  return TIER_STYLES.gold
}

export default class Panel extends Phaser.GameObjects.Container {
  constructor(scene, x, y, tier) {
    super(scene, x, y)

    this.tier = tier
    this.power = tier * 10
    this.gridX = -1
    this.gridY = -1
    this.label = null
    this.shadow = null
    this.sprite = null
    this.fallbackRect = null

    scene.add.existing(this)
    this.buildVisual(scene)
  }

  buildVisual(scene) {
    const key = `panel_${this.tier}`
    const hasSprite = scene.textures.exists(key)

    // Тень
    this.shadow = scene.add.ellipse(2, 66, 50, 12, 0x000000, 0.3)
    this.add(this.shadow)

    if (hasSprite) {
      this.sprite = scene.add.image(0, 0, key)
      this.sprite.setDisplaySize(64, 64)
      this.add(this.sprite)
      this.setSize(64, 64)
    } else {
      const style = getStyle(this.tier)
      this.fallbackRect = scene.add.rectangle(0, 0, 64, 64, style.fill, 1)
      this.fallbackRect.setStrokeStyle(2, style.stroke, 1)
      this.add(this.fallbackRect)
      this.setSize(64, 64)

      if (this.tier === 10) {
        scene.tweens.add({
          targets: this.fallbackRect,
          alpha: { from: 1, to: 0.3 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        })
      }
    }

    this.label = scene.add.text(0, hasSprite ? 36 : 0, `${this.tier}`, {
      fontSize: hasSprite ? '12px' : '20px',
      fontFamily: 'Arial',
      color: hasSprite ? '#ffffff' : '#ffffff',
      fontStyle: 'bold',
      stroke: hasSprite ? '#000000' : undefined,
      strokeThickness: hasSprite ? 3 : 0,
    }).setOrigin(0.5)
    this.add(this.label)

    this.setInteractive(new Phaser.Geom.Rectangle(-32, -32, 64, 64), Phaser.Geom.Rectangle.Contains)
    this.setDepth(1)
  }

  setGridPos(gx, gy) {
    this.gridX = gx
    this.gridY = gy
  }

  setPanelPosition(x, y) {
    this.setPosition(x, y)
  }

  /** Мощность с учётом апгрейда эффективности и буста x2 */
  getEffectivePower() {
    let p = this.power
    if (this.scene.upgradeSystem) {
      p *= this.scene.upgradeSystem.getPanelMultiplier()
    }
    if (this.scene.boostSystem && this.scene.boostSystem.getEnergyMultiplier() > 1) {
      p *= this.scene.boostSystem.getEnergyMultiplier()
    }
    return Math.floor(p)
  }

  destroy() {
    super.destroy()
  }
}
