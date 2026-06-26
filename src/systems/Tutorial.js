import CloudSaveManager from '../utils/CloudSaveManager.js'

export const TUTORIAL_KEY = 'tutorial_step'

export default class Tutorial {
  constructor(scene) {
    this.scene = scene
    this.steps = [
      {
        text: 'Добро пожаловать! Это солнечная панель.\nПеретащи её на другую такую же, чтобы объединить!',
        highlight: null,
        waitForAction: 'merge',
      },
      {
        text: 'Отлично! Панели объединились и стали мощнее.\nПродолжай объединять панели одного уровня!',
        highlight: null,
        waitForAction: 'click',
      },
      {
        text: 'Панели вырабатывают энергию.\nСмотри на счётчик ⚡ вверху слева!',
        highlight: () => scene.topEnergyText,
        waitForAction: 'click',
      },
      {
        text: 'Выполни заказ города, чтобы получить монеты.\nНажми "Выполнить" в панели заказов справа!',
        highlight: () => scene.firstOrderBtn,
        waitForAction: 'completeOrder',
      },
      {
        text: 'Купи новые панели в магазине внизу.\nУдачи в строительстве империи энергии!',
        highlight: () => scene.shopContainer,
        waitForAction: 'click',
      },
    ]
    this.currentStep = -1
    this.active = false
    this.overlay = null
    this.highlightZone = null
    this.textBox = null
    this.nextBtn = null
    this.skipBtn = null
    this.skipAllBtn = null
  }

  shouldStart() {
    const saved = CloudSaveManager.loadLocalSnapshot()
    if (!saved) return true
    return false
  }

  async start() {
    if (!this.shouldStart()) return
    this.active = true
    this.currentStep = -1
    this.showNextStep()
  }

  showNextStep() {
    this.currentStep++
    if (this.currentStep >= this.steps.length) {
      this.finish()
      return
    }

    this.clearHighlight()
    this.createOverlay()
    this.createTextBox(this.currentStep)
  }

  createOverlay() {
    this.overlay = this.scene.add.rectangle(400, 300, 800, 600, 0x000000, 0.6).setDepth(250).setInteractive()
    this.overlay.on('pointerdown', () => {})
  }

  createTextBox(stepIndex) {
    const step = this.steps[stepIndex]
    const cx = 400

    this.textBox = this.scene.add.container(cx, 460).setDepth(260)
    const bg = this.scene.add.rectangle(0, 0, 500, 100, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xffd700, 0.8)
    const text = this.scene.add.text(0, -25, step.text, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5)
    this.textBox.add([bg, text])

    if (stepIndex < this.steps.length - 1) {
      this.nextBtn = this.createButton(cx + 180, 480, 'Далее →', 0x4a90e2, () => this.showNextStep())
    } else {
      this.nextBtn = this.createButton(cx + 180, 480, 'Готово!', 0x4caf50, () => this.finish())
    }

    this.skipAllBtn = this.createButton(760, 20, 'Пропустить', 0x888888, () => this.finish())

    // Подсветка элемента
    if (step.highlight) {
      const target = step.highlight()
      if (target) {
        const hx = target.x, hy = target.y
        this.highlightZone = this.scene.add.rectangle(hx, hy, 160, 40, 0x000000, 0)
          .setStrokeStyle(2, 0xffd700, 1)
          .setDepth(255)

        this.scene.tweens.add({
          targets: this.highlightZone,
          alpha: { from: 1, to: 0.3 },
          duration: 600,
          yoyo: true,
          repeat: -1,
        })

        // Стрелка от текста к элементу
        const arrow = this.scene.add.graphics().setDepth(256)
        arrow.lineStyle(2, 0xffd700, 0.8)
        arrow.beginPath()
        arrow.moveTo(cx - 50, 410)
        const endX = hx < 400 ? hx + 80 : hx - 80
        arrow.lineTo(endX, hy - 20)
        arrow.strokePath()

        // Треугольник
        arrow.fillStyle(0xffd700, 0.8)
        arrow.fillTriangle(endX, hy - 20, endX - 8, hy - 10, endX + 8, hy - 10)
      }
    }
  }

  createButton(x, y, label, color, callback) {
    const btn = this.scene.add.rectangle(x, y, 130, 28, color, 0.9).setStrokeStyle(1, 0xffffff, 0.3).setInteractive({ useHandCursor: true }).setDepth(261)
    const txt = this.scene.add.text(x, y, label, { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(262)
    btn.on('pointerover', () => { if (btn.input.enabled) btn.setAlpha(0.8) })
    btn.on('pointerout', () => btn.setAlpha(1))
    btn.on('pointerdown', callback)
    return btn
  }

  clearHighlight() {
    if (this.overlay) { this.overlay.destroy(); this.overlay = null }
    if (this.textBox) { this.textBox.destroy(); this.textBox = null }
    if (this.highlightZone) { this.highlightZone.destroy(); this.highlightZone = null }
    if (this.nextBtn) { this.nextBtn.destroy(); this.nextBtn = null }
    if (this.skipAllBtn) { this.skipAllBtn.destroy(); this.skipAllBtn = null }
  }

  finish() {
    this.clearHighlight()
    this.active = false
    CloudSaveManager.save({ tutorialDone: true })
  }
}
