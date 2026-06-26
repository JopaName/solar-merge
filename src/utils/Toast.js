export default class Toast {
  constructor(scene) {
    this.scene = scene
    this.container = null
  }

  show(message, type = 'info') {
    const colors = { success: '#4caf50', error: '#ff4444', info: '#4fc3f7' }
    const bgColors = { success: 0x4caf50, error: 0xff4444, info: 0x4fc3f7 }
    const color = colors[type] || '#4fc3f7'
    const bgColor = bgColors[type] || 0x4fc3f7

    if (this.container) { this.container.destroy() }

    this.container = this.scene.add.container(400, 570).setDepth(300)

    const bg = this.scene.add.rectangle(0, 0, 400, 36, bgColor, 0.9).setStrokeStyle(1, 0xffffff, 0.3)
    const text = this.scene.add.text(0, 0, message, {
      fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.container.add([bg, text])
    this.container.setAlpha(0)

    this.scene.tweens.add({
      targets: this.container,
      y: 550, alpha: 1,
      duration: 300, ease: 'Power2',
      onComplete: () => {
        this.scene.time.delayedCall(3000, () => {
          if (this.container) {
            this.scene.tweens.add({
              targets: this.container,
              alpha: 0, duration: 300,
              onComplete: () => { if (this.container) { this.container.destroy(); this.container = null } },
            })
          }
        })
      },
    })
  }

  destroy() {
    if (this.container) { this.container.destroy(); this.container = null }
  }
}
