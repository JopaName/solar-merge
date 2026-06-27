export default class ParticlePool {
  constructor(scene, poolSize = 50) {
    this.scene = scene
    this.pool = []
    for (let i = 0; i < poolSize; i++) {
      const p = scene.add.circle(0, 0, 4, 0xffffff, 1)
      p.setVisible(false).setActive(false).setDepth(150)
      this.pool.push(p)
    }
  }

  get(x, y, color = 0xffffff, size = 4) {
    let p = this.pool.find(p => !p.active)
    if (!p) {
      p = this.scene.add.circle(0, 0, size, color, 1).setDepth(150)
      this.pool.push(p)
    }
    p.setPosition(x, y).setFillStyle(color).setRadius(size).setAlpha(1).setScale(1).setVisible(true).setActive(true)
    return p
  }

  release(p) {
    p.setVisible(false).setActive(false)
  }
}
