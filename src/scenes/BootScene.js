import Panel from '../entities/Panel.js'
import CloudSaveManager from '../utils/CloudSaveManager.js'
import yandexManager from '../utils/YandexManager.js'
import OrderSystem from '../systems/OrderSystem.js'
import ParticleSystem from '../utils/ParticleSystem.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  /* ───── PRELOAD ───── */
  preload() {
    for (let i = 1; i <= 10; i++) {
      this.load.image(`panel_${i}`, `assets/panels/panel_${i}.png`)
    }
  }

  /* ───── CREATE ───── */
  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e')

    this.particles = new ParticleSystem(this)

    this.GRID_X = 30
    this.GRID_Y = 90
    this.CELL_SIZE = 80
    this.COLS = 5
    this.ROWS = 5

    this.gridCells = []
    for (let row = 0; row < this.ROWS; row++) {
      this.gridCells[row] = []
      for (let col = 0; col < this.COLS; col++) {
        const cx = this.GRID_X + col * this.CELL_SIZE + this.CELL_SIZE / 2
        const cy = this.GRID_Y + row * this.CELL_SIZE + this.CELL_SIZE / 2
        this.gridCells[row][col] = { x: cx, y: cy, occupied: false, panel: null }
      }
    }

    this.energy = 0
    this.coins = 100
    this.completedOrders = 0
    this.lastSaveTime = Date.now()

    this.orderSystem = new OrderSystem(this)

    this.drawGrid()
    this.createUI()
    this.createIndicators()
    this.createShareButton()
    this.createShop()
    this.createCityVisualization()

    this.loadLocalGame()

    if (this.orderSystem.orders.length === 0) {
      this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    }

    this.refreshOrdersUI()
    this.refreshCityVisualization()

    this.draggedPanel = null
    this.dragOffsetX = 0
    this.dragOffsetY = 0
    this.input.on('pointerdown', (ptr) => this.onPointerDown(ptr))
    this.input.on('pointermove', (ptr) => this.onPointerMove(ptr))
    this.input.on('pointerup', (ptr) => this.onPointerUp(ptr))

    this.spawnStartingPanels()

    this.initSdkAndCloud()

    // Таймер сбора энергии — каждую секунду
    this.energyTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.collectEnergyParticles(),
    })
  }

  /* ───── SDK ───── */
  async initSdkAndCloud() {
    await yandexManager.init()
    this.refreshSdkIndicator()

    const cloudData = await CloudSaveManager.load()
    if (cloudData) {
      this.coins = cloudData.coins !== undefined ? cloudData.coins : this.coins
      this.completedOrders = cloudData.completedOrders || 0
      this.lastSaveTime = cloudData.lastSaveTime || Date.now()
      this.orderSystem.completedCount = cloudData.completedCount || 0
      this.orderSystem.totalRewardedAdsWatched = cloudData.totalRewardedAdsWatched || 0

      if (cloudData.panels) {
        for (let r = 0; r < this.ROWS; r++) {
          for (let c = 0; c < this.COLS; c++) {
            if (this.gridCells[r][c].panel) { this.gridCells[r][c].panel.destroy(); this.gridCells[r][c].panel = null; this.gridCells[r][c].occupied = false }
          }
        }
        for (const p of cloudData.panels) {
          if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col)
        }
      }

      if (cloudData.orders && cloudData.orders.length > 0) { this.orderSystem.orders = cloudData.orders }
      else { this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier()) }

      this.refreshOrdersUI(); this.refreshCoinsUI(); this.refreshCityVisualization()
    }

    this.checkOfflineBonus()
  }

  createIndicators() {
    this.sdkIndicator = this.add.text(780, 10, 'SDK: ⏳', { fontSize: '11px', fontFamily: 'Arial', color: '#ffaa00' }).setOrigin(1, 0)
  }

  refreshSdkIndicator() {
    if (yandexManager.isReady()) { this.sdkIndicator.setText('SDK: ✓').setColor('#4caf50') }
    else { this.sdkIndicator.setText('SDK: ✗').setColor('#ff4444') }
  }

  createShareButton() {
    const btn = this.add.rectangle(780, 35, 100, 24, 0x4a90e2, 0.8).setStrokeStyle(1, 0x6ab0ff).setOrigin(1, 0.5).setInteractive({ useHandCursor: true })
    this.add.text(780, 35, 'Поделиться', { fontSize: '11px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(1, 0.5)
    btn.on('pointerdown', async () => { if (!(await yandexManager.share())) this.showNotification('Функция недоступна', 0xff4444) })
  }

  /* ───── СЕТКА ───── */
  drawGrid() {
    const g = this.add.graphics()
    g.lineStyle(1, 0x888888, 0.3)
    for (let row = 0; row <= this.ROWS; row++) {
      const y = this.GRID_Y + row * this.CELL_SIZE; g.moveTo(this.GRID_X, y); g.lineTo(this.GRID_X + this.COLS * this.CELL_SIZE, y)
    }
    for (let col = 0; col <= this.COLS; col++) {
      const x = this.GRID_X + col * this.CELL_SIZE; g.moveTo(x, this.GRID_Y); g.lineTo(x, this.GRID_Y + this.ROWS * this.CELL_SIZE)
    }
    g.strokePath()
  }

  spawnStartingPanels() {
    let count = 0
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { if (this.gridCells[r][c].occupied) count++ } }
    if (count > 0) return
    const positions = []
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) positions.push({ row: r, col: c }) }
    Phaser.Utils.Array.Shuffle(positions)
    for (let i = 0; i < 3 && i < positions.length; i++) this.spawnPanelAt(1, positions[i].row, positions[i].col)
  }

  spawnPanelAt(tier, row, col) {
    if (this.gridCells[row][col].occupied) return false
    const cell = this.gridCells[row][col]
    const panel = new Panel(this, cell.x, cell.y, tier)
    panel.setGridPos(row, col)
    cell.occupied = true; cell.panel = panel
    panel.setScale(0.5)
    this.tweens.add({ targets: panel, scale: 1, duration: 250, ease: 'Back.easeOut' })
    this.updateEnergy()
    this.saveGame()
    return true
  }

  updateEnergy() {
    this.energy = 0
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) { this.energy += this.gridCells[r][c].panel.power } } }
    this.energyText.setText(`Energy: ${this.energy}`)
    this.refreshOrdersUI()
  }

  /* ───── АНИМАЦИЯ СБОРА ЭНЕРГИИ ───── */
  collectEnergyParticles() {
    const target = this.energyText
    if (!target) return
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) {
          const p = this.gridCells[r][c].panel
          this.particles.flyTo(p.x, p.y - 10, target.x + 50, target.y, 0x4fc3f7, () => {
            // Мигание счётчика при достижении
            this.tweens.add({ targets: target, scale: { from: 1, to: 1.3 }, duration: 100, yoyo: true, ease: 'Power2' })
          })
          // Только одна частица в тик (первая найденная)
          return
        }
      }
    }
  }

  /* ───── UI ───── */
  createUI() {
    this.energyText = this.add.text(10, 10, 'Energy: 0', { fontSize: '16px', fontFamily: 'Arial', color: '#4fc3f7' })
    this.coinsText = this.add.text(10, 30, 'Coins: 100', { fontSize: '16px', fontFamily: 'Arial', color: '#ffd700' })
  }

  refreshCoinsUI() {
    this.coinsText.setText(`Coins: ${this.coins}`)
    this.refreshShopButtons()
  }

  /* ───── ЗАКАЗЫ ───── */
  createOrdersUI() {
    const x = 460, y = 50, w = 310, h = 410
    this.ordersBg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.5)
    this.ordersTitle = this.add.text(x + w / 2, y + 15, 'Заказы городов', { fontSize: '15px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.ordersContainer = this.add.container()
    this.ordersContainer.setPosition(x, y)
  }

  refreshOrdersUI() {
    if (!this.ordersContainer) return
    this.ordersContainer.removeAll(true)
    const orders = this.orderSystem.orders
    const startY = 40, yOffset = 120

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i], cy = startY + i * yOffset
      const canComplete = this.energy >= o.requiredEnergy

      const bg = this.add.rectangle(155, cy, 290, 110, 0x1a1a3e, 0.8).setStrokeStyle(1, 0x4a90e2, 0.5)

      this.add.text(20, cy - 38, o.city, { fontSize: '14px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold' })
      this.add.text(20, cy - 18, `Нужно: ${o.requiredEnergy} энергии`, { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' })
      this.add.text(20, cy + 2, `Награда: ${o.rewardCoins} монет`, { fontSize: '12px', fontFamily: 'Arial', color: '#4caf50' })

      // Кнопка "Выполнить" с пульсацией
      const btnColor = canComplete ? 0x4caf50 : 0x555555
      const btn = this.add.rectangle(235, cy + 40, 90, 26, btnColor, 0.9).setStrokeStyle(1, canComplete ? 0x66bb6a : 0x777777)
      const btnText = this.add.text(235, cy + 40, 'Выполнить', { fontSize: '11px', fontFamily: 'Arial', color: canComplete ? '#ffffff' : '#888888' }).setOrigin(0.5)

      if (canComplete) {
        btn.setInteractive({ useHandCursor: true })
        btn.on('pointerover', () => btn.setFillStyle(0x66bb6a))
        btn.on('pointerout', () => btn.setFillStyle(0x4caf50))

        // Пульсация активной кнопки
        this.tweens.add({ targets: btn, scale: { from: 1, to: 1.05 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

        btn.on('pointerdown', () => {
          const result = this.orderSystem.completeOrder(i)
          if (result) {
            // Анимация выполнения заказа
            this.particles.burst(btn.x, btn.y, 0x4caf50, 10, { speed: 80, size: 5 })
            this.particles.flyingText = this.add.text(btn.x, btn.y - 20, `+${result.rewardCoins} монет!`, { fontSize: '16px', fontFamily: 'Arial', color: '#4caf50', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200)
            this.tweens.add({ targets: this.particles.flyingText, y: this.particles.flyingText.y - 50, alpha: 0, duration: 1000, ease: 'Power2', onComplete: () => { if (this.particles.flyingText) this.particles.flyingText.destroy() } })

            // Монеты летят к счётчику
            for (let j = 0; j < 3; j++) {
              this.time.delayedCall(j * 80, () => {
                this.particles.flyTo(btn.x + Phaser.Math.Between(-20, 20), btn.y, this.coinsText.x + 40, this.coinsText.y, 0xffd700)
              })
            }

            this.coins += result.rewardCoins
            this.completedOrders++
            this.refreshCoinsUI()
            this.refreshOrdersUI()
            this.refreshCityVisualization()
            if (this.orderSystem.shouldShowInterstitial()) yandexManager.showInterstitial()
            this.saveGame()
          }
        })
      }

      // Кнопка "▶ x2"
      const x2Color = canComplete ? 0xff9800 : 0x555555
      const x2Btn = this.add.rectangle(235, cy + 70, 90, 22, x2Color, 0.9).setStrokeStyle(1, canComplete ? 0xffb74d : 0x777777)
      const x2Text = this.add.text(235, cy + 70, '▶ x2', { fontSize: '11px', fontFamily: 'Arial', color: canComplete ? '#ffffff' : '#888888' }).setOrigin(0.5)

      if (canComplete) {
        x2Btn.setInteractive({ useHandCursor: true })
        x2Btn.on('pointerover', () => x2Btn.setFillStyle(0xffb74d))
        x2Btn.on('pointerout', () => x2Btn.setFillStyle(0xff9800))

        // Пульсация x2
        this.tweens.add({ targets: x2Btn, scale: { from: 1, to: 1.05 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })

        x2Btn.on('pointerdown', () => {
          yandexManager.showRewardedVideo(() => {
            const result = this.orderSystem.completeOrder(i)
            if (result) {
              // Анимация x2
              this.particles.burst(x2Btn.x, x2Btn.y, 0xff9800, 12, { speed: 90, size: 5 })
              const ft = this.add.text(x2Btn.x, x2Btn.y - 20, `+${result.rewardCoins * 2} монет!`, { fontSize: '16px', fontFamily: 'Arial', color: '#ff9800', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200)
              this.tweens.add({ targets: ft, y: ft.y - 50, alpha: 0, duration: 1000, ease: 'Power2', onComplete: () => ft.destroy() })
              for (let j = 0; j < 5; j++) {
                this.time.delayedCall(j * 60, () => this.particles.flyTo(x2Btn.x + Phaser.Math.Between(-20, 20), x2Btn.y, this.coinsText.x + 40, this.coinsText.y, 0xffd700))
              }
              this.coins += result.rewardCoins * 2
              this.completedOrders++
              this.orderSystem.totalRewardedAdsWatched++
              this.refreshCoinsUI(); this.refreshOrdersUI(); this.refreshCityVisualization()
              if (this.orderSystem.shouldShowInterstitial()) yandexManager.showInterstitial()
              this.saveGame()
            }
          })
        })
      }

      this.ordersContainer.add([bg, btn, btnText, x2Btn, x2Text])
    }
  }

  /* ───── МАГАЗИН ───── */
  createShop() {
    this.shopBg = this.add.rectangle(230, 530, 430, 55, 0x000000, 0.5)
    this.shopTitle = this.add.text(30, 505, 'Магазин', { fontSize: '13px', fontFamily: 'Arial', color: '#aaaaaa' })
    this.tier1Btn = this.createShopButton(120, 530, 'Панель T1 (50)', () => this.buyPanel(1, 50))
    this.tier2Btn = this.createShopButton(280, 530, 'Панель T2 (150)', () => this.buyPanel(2, 150))
    this.notificationText = this.add.text(400, 570, '', { fontSize: '12px', fontFamily: 'Arial', color: '#ff4444' }).setOrigin(0.5)
  }

  createShopButton(x, y, label, callback) {
    const btn = this.add.rectangle(x, y, 140, 32, 0x4a90e2, 0.8).setStrokeStyle(1, 0x6ab0ff).setInteractive({ useHandCursor: true })
    const txt = this.add.text(x, y, label, { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5)
    btn.on('pointerover', () => { if (btn.input.enabled) btn.setFillStyle(0x5aa0f2) })
    btn.on('pointerout', () => { if (btn.input.enabled) btn.setFillStyle(0x4a90e2) })
    btn.on('pointerdown', callback)
    btn._label = txt
    return btn
  }

  refreshShopButtons() {
    const t1ok = this.coins >= 50, t2ok = this.coins >= 150
    this.tier1Btn.setFillStyle(t1ok ? 0x4a90e2 : 0x555555); this.tier1Btn._label.setColor(t1ok ? '#ffffff' : '#888888')
    if (!t1ok) this.tier1Btn.disableInteractive(); else this.tier1Btn.setInteractive({ useHandCursor: true })
    this.tier2Btn.setFillStyle(t2ok ? 0x4a90e2 : 0x555555); this.tier2Btn._label.setColor(t2ok ? '#ffffff' : '#888888')
    if (!t2ok) this.tier2Btn.disableInteractive(); else this.tier2Btn.setInteractive({ useHandCursor: true })
  }

  buyPanel(tier, cost) {
    if (this.coins < cost) { this.showNotification('Недостаточно монет!', 0xff4444); return }
    const empty = []
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { if (!this.gridCells[r][c].occupied) empty.push({ row: r, col: c }) } }
    if (empty.length === 0) { this.showNotification('Сетка заполнена!', 0xff4444); return }

    this.coins -= cost; this.refreshCoinsUI()
    const cell = Phaser.Math.RND.pick(empty)
    const pos = this.getCellCenter(cell.row, cell.col)

    // Анимация slide-in панели: появляется сверху экрана
    const panel = new Panel(this, pos.x, -50, tier)
    panel.setGridPos(cell.row, cell.col)
    panel.setScale(0.7)
    this.gridCells[cell.row][cell.col].occupied = true; this.gridCells[cell.row][cell.col].panel = panel

    this.tweens.add({ targets: panel, y: pos.y, scale: 1, duration: 400, ease: 'Back.easeOut' })

    // Монеты вылетают из счётчика
    for (let j = 0; j < 3; j++) {
      this.time.delayedCall(j * 100, () => {
        this.particles.flyTo(this.coinsText.x + 40, this.coinsText.y, pos.x + Phaser.Math.Between(-20, 20), pos.y, 0xffd700)
      })
    }

    this.updateEnergy(); this.saveGame()
    this.showNotification(`Куплена панель T${tier}!`, 0x4caf50)
  }

  getCellCenter(row, col) {
    return { x: this.GRID_X + col * this.CELL_SIZE + this.CELL_SIZE / 2, y: this.GRID_Y + row * this.CELL_SIZE + this.CELL_SIZE / 2 }
  }

  showNotification(msg, color) {
    this.notificationText.setText(msg)
    this.notificationText.setColor('#' + color.toString(16).padStart(6, '0'))
    this.notificationText.setAlpha(1)
    this.tweens.add({ targets: this.notificationText, alpha: 0, duration: 2000, ease: 'Power2' })
  }

  /* ───── ГОРОД ───── */
  createCityVisualization() {
    const x = 30, y = 430, w = 150, h = 100
    this.cityBg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.5).setStrokeStyle(1, 0x4a90e2, 0.3)
    this.cityTitle = this.add.text(x + w / 2, y + 8, 'Ваш город', { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.cityBuilding = this.add.rectangle(x + w / 2, y + 52, 20, 20, 0x4a90e2).setStrokeStyle(1, 0x6ab0ff)
    this.cityOrdersText = this.add.text(x + w / 2, y + 80, 'Выполнено заказов: 0', { fontSize: '10px', fontFamily: 'Arial', color: '#aaaaaa' }).setOrigin(0.5, 0)
  }

  refreshCityVisualization() {
    if (!this.cityBuilding) return
    const count = this.completedOrders
    let size = 20
    if (count >= 16) size = 80; else if (count >= 6) size = 60; else if (count >= 1) size = 40
    this.cityBuilding.setSize(size, size)
    this.cityOrdersText.setText(`Выполнено заказов: ${count}`)
  }

  /* ───── СОХРАНЕНИЕ ───── */
  async saveGame() {
    const panels = []
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { const p = this.gridCells[r][c].panel; if (p) panels.push({ row: r, col: c, tier: p.tier }) } }
    this.lastSaveTime = Date.now()
    await CloudSaveManager.save({ panels, coins: this.coins, completedOrders: this.completedOrders, lastSaveTime: this.lastSaveTime, orders: this.orderSystem.orders, completedCount: this.orderSystem.completedCount, totalRewardedAdsWatched: this.orderSystem.totalRewardedAdsWatched })
  }

  loadLocalGame() {
    const data = CloudSaveManager.loadLocalSnapshot()
    if (!data) { this.orderSystem.refillOrders(1); this.createOrdersUI(); this.refreshOrdersUI(); return }
    this.coins = data.coins || 100; this.completedOrders = data.completedOrders || 0; this.lastSaveTime = data.lastSaveTime || Date.now()
    if (data.panels) { for (const p of data.panels) { if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col) } }
    if (data.orders && data.orders.length > 0) { this.orderSystem.orders = data.orders } else { this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier()) }
    if (data.completedCount !== undefined) this.orderSystem.completedCount = data.completedCount
    if (data.totalRewardedAdsWatched !== undefined) this.orderSystem.totalRewardedAdsWatched = data.totalRewardedAdsWatched
    this.createOrdersUI(); this.refreshOrdersUI(); this.refreshCoinsUI()
  }

  /* ───── ОФЛАЙН-БОНУС ───── */
  checkOfflineBonus() {
    const now = Date.now(), elapsed = now - this.lastSaveTime, hoursAway = Math.floor(elapsed / (1000 * 60 * 60))
    if (hoursAway < 2) return
    const bonusEnergy = hoursAway * 10

    const closePopup = () => { popupBg.destroy(); popupTitle.destroy(); popupText.destroy(); adBtn.destroy(); adTxt.destroy(); takeBtn.destroy(); takeTxt.destroy(); closeBtn.destroy(); closeTxt.destroy() }
    const giveBonus = (mult) => {
      if (claimed) return; claimed = true
      const finalEnergy = bonusEnergy * mult
      const panelsToAdd = Math.ceil(finalEnergy / 10)
      for (let i = 0; i < panelsToAdd; i++) {
        const empty = []; for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { if (!this.gridCells[r][c].occupied) empty.push({ row: r, col: c }) } }
        if (empty.length === 0) break
        const cell = Phaser.Math.RND.pick(empty); this.spawnPanelAt(1, cell.row, cell.col)
      }
      closePopup(); this.showNotification(`+${finalEnergy} энергии (офлайн)!`, 0x4fc3f7); this.saveGame()
    }
    let claimed = false

    const popupBg = this.add.rectangle(400, 300, 350, 160, 0x000000, 0.85).setDepth(200)
    const popupTitle = this.add.text(400, 240, `Вы отсутствовали ${hoursAway} ч.`, { fontSize: '16px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201)
    const popupText = this.add.text(400, 265, `Бонус: ${bonusEnergy} энергии!`, { fontSize: '14px', fontFamily: 'Arial', color: '#4fc3f7' }).setOrigin(0.5).setDepth(201)
    const adBtn = this.add.rectangle(400, 310, 220, 30, 0xff9800, 0.9).setStrokeStyle(1, 0xffb74d).setInteractive({ useHandCursor: true }).setDepth(202)
    const adTxt = this.add.text(400, 310, 'Реклама → x3 бонус', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    const takeBtn = this.add.rectangle(300, 355, 100, 26, 0x4caf50, 0.9).setStrokeStyle(1, 0x66bb6a).setInteractive({ useHandCursor: true }).setDepth(202)
    const takeTxt = this.add.text(300, 355, 'Забрать', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    const closeBtn = this.add.rectangle(500, 355, 100, 26, 0x888888, 0.9).setInteractive({ useHandCursor: true }).setDepth(202)
    const closeTxt = this.add.text(500, 355, 'Закрыть', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    adBtn.on('pointerdown', () => yandexManager.showRewardedVideo(() => giveBonus(3)))
    takeBtn.on('pointerdown', () => giveBonus(1))
    closeBtn.on('pointerdown', closePopup)
  }

  /* ───── DRAG-AND-DROP ───── */
  onPointerDown(pointer) {
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cell = this.gridCells[r][c]
        if (!cell.occupied || !cell.panel) continue
        const panel = cell.panel
        if (Math.abs(pointer.x - panel.x) <= 32 && Math.abs(pointer.y - panel.y) <= 32) {
          this.draggedPanel = panel; this.dragOffsetX = pointer.x - panel.x; this.dragOffsetY = pointer.y - panel.y
          cell.occupied = false; cell.panel = null; panel.setDepth(100); return
        }
      }
    }
  }

  onPointerMove(pointer) {
    if (!this.draggedPanel) return
    this.draggedPanel.setPanelPosition(pointer.x - this.dragOffsetX, pointer.y - this.dragOffsetY)
  }

  onPointerUp(pointer) {
    if (!this.draggedPanel) return
    const panel = this.draggedPanel; this.draggedPanel = null; panel.setDepth(1)
    let minDist = Infinity, targetRow = -1, targetCol = -1
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) {
      const cell = this.gridCells[r][c]; const d = (panel.x - cell.x) ** 2 + (panel.y - cell.y) ** 2
      if (d < minDist) { minDist = d; targetRow = r; targetCol = c }
    }}
    if (targetRow === -1 || targetCol === -1) { this.returnToOriginalCell(panel); return }
    const targetCell = this.gridCells[targetRow][targetCol]
    if (targetCell.occupied && targetCell.panel) {
      const tp = targetCell.panel
      if (tp.tier === panel.tier && panel.tier < 10) { this.merge(panel, tp, targetRow, targetCol) }
      else { this.returnToOriginalCell(panel) }
    } else {
      panel.setGridPos(targetRow, targetCol); targetCell.occupied = true; targetCell.panel = panel
      this.tweens.add({ targets: panel, x: targetCell.x, y: targetCell.y, duration: 150, ease: 'Power2' })
    }
  }

  returnToOriginalCell(panel) {
    const row = panel.gridX, col = panel.gridY
    if (row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS && !this.gridCells[row][col].occupied) {
      const cell = this.gridCells[row][col]; cell.occupied = true; cell.panel = panel
      this.tweens.add({ targets: panel, x: cell.x, y: cell.y, duration: 150, ease: 'Power2' })
    } else { panel.destroy() }
  }

  /* ───── MERGE (СЛИЯНИЕ) ───── */
  merge(p1, p2, row, col) {
    const cell = this.gridCells[row][col]
    const newTier = p1.tier + 1
    const targetX = cell.x, targetY = cell.y

    // Двигаем обе панели к центру
    this.tweens.add({ targets: p1, x: targetX, y: targetY, scale: 0, duration: 200, ease: 'Power2', onComplete: () => p1.destroy() })
    this.tweens.add({ targets: p2, x: targetX, y: targetY, scale: 0, duration: 200, ease: 'Power2', onComplete: () => p2.destroy() })

    // Вспышка света
    this.time.delayedCall(180, () => {
      this.particles.flash(targetX, targetY)
    })

    // Жёлтые частицы разлетаются
    this.time.delayedCall(180, () => {
      this.particles.burst(targetX, targetY, 0xffd700, 8, { speed: 80, size: 6 })
    })

    // Новая панель через 200ms с bounce-эффектом
    this.time.delayedCall(200, () => {
      const newPanel = new Panel(this, targetX, targetY, newTier)
      newPanel.setGridPos(row, col)
      cell.occupied = true; cell.panel = newPanel
      newPanel.setScale(0)
      this.tweens.add({
        targets: newPanel,
        scale: { from: 0, to: 1.2 },
        duration: 250,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({ targets: newPanel, scale: 1, duration: 100, ease: 'Power2' })
        },
      })

      this.updateEnergy()
      this.saveGame()
    })
  }
}
