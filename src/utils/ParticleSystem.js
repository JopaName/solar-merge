export default class ParticleSystem {
  constructor(scene) {
    this.scene = scene
  }

  /**
   * Взрыв частиц — квадратики разлетаются из точки
   * @param {number} x - центр X
   * @param {number} y - центр Y
   * @param {number} color - цвет 0xRRGGBB
   * @param {number} count - количество частиц
   * @param {object} opts - { speed, size, duration }
   */
  burst(x, y, color, count = 8, opts = {}) {
    const speed = opts.speed || 100
    const size = opts.size || 6
    const duration = opts.duration || 500

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5
      const particle = this.scene.add.rectangle(x, y, size, size, color, 1).setDepth(150)
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: duration,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      })
    }
  }

  /**
   * Вспышка света — белый круг, расширяется и исчезает
   */
  flash(x, y) {
    const circle = this.scene.add.circle(x, y, 10, 0xffffff, 0.8).setDepth(150)
    this.scene.tweens.add({
      targets: circle,
      scale: 2,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => circle.destroy(),
    })
  }

  /**
   * Летящая частица к цели по прямой
   * @param {number} fromX
   * @param {number} fromY
   * @param {number} toX
   * @param {number} toY
   * @param {number} color
   * @param {function} onReach - колбэк при достижении цели
   */
  flyTo(fromX, fromY, toX, toY, color = 0xffd700, onReach = null) {
    const p = this.scene.add.circle(fromX, fromY, 4, color, 1).setDepth(150)
    this.scene.tweens.add({
      targets: p,
      x: toX,
      y: toY,
      alpha: 0,
      duration: 400,
      ease: 'Sine.easeIn',
      onComplete: () => {
        p.destroy()
        if (onReach) onReach()
      },
    })
  }

  /**
   * Текст "+X монет!" взлетает вверх и исчезает
   */
  floatingText(x, y, text, color = '#4caf50') {
    const t = this.scene.add.text(x, y, text, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200)

    this.scene.tweens.add({
      targets: t,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => t.destroy(),
    })
  }
}
