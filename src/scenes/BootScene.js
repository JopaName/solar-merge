import Panel from '../entities/Panel.js'
import CloudSaveManager from '../utils/CloudSaveManager.js'
import yandexManager from '../utils/YandexManager.js'
import OrderSystem from '../systems/OrderSystem.js'
import ParticleSystem from '../utils/ParticleSystem.js'
import Toast from '../utils/Toast.js'
import Tutorial from '../systems/Tutorial.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  preload() {
    for (let i = 1; i <= 10; i++) {
      this.load.image(`panel_${i}`, `assets/panels/panel_${i}.png`)
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e')

    this.particles = new ParticleSystem(this)
    this.toast = new Toast(this)

    this.energy = 0
    this.coins = 100
    this.completedOrders = 0
    this.lastSaveTime = Date.now()
    this.soundEnabled = true
    this.musicEnabled = true

    this.orderSystem = new OrderSystem(this)
    this.tutorial = new Tutorial(this)

    this.COLS = 5
    this.ROWS = 5
    this.CELL_SIZE = 72
    this.GRID_X = 195
    this.GRID_Y = 85

    this.gridCells = []
    for (let row = 0; row < this.ROWS; row++) {
      this.gridCells[row] = []
      for (let col = 0; col < this.COLS; col++) {
        const cx = this.GRID_X + col * this.CELL_SIZE + this.CELL_SIZE / 2
        const cy = this.GRID_Y + row * this.CELL_SIZE + this.CELL_SIZE / 2
        this.gridCells[row][col] = { x: cx, y: cy, occupied: false, panel: null }
      }
    }

    this.createTopBar()
    this.createLeftPanel()
    this.drawGrid()
    this.createOrdersUI()
    this.createShopBottom()

    this.loadLocalGame()

    if (this.orderSystem.orders.length === 0) {
      this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    }

    this.refreshOrdersUI()
    this.refreshCityVisualization()
    this.refreshTopBarUI()

    this.draggedPanel = null
    this.dragOffsetX = 0
    this.dragOffsetY = 0
    this.input.on('pointerdown', (ptr) => this.onPointerDown(ptr))
    this.input.on('pointermove', (ptr) => this.onPointerMove(ptr))
    this.input.on('pointerup', (ptr) => this.onPointerUp(ptr))

    this.spawnStartingPanels()
    this.initSdkAndCloud()

    this.energyTimer = this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => this.collectEnergyParticles(),
    })

    // Туториал после небольшой задержки
    this.time.delayedCall(500, () => this.tutorial.start())
  }

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

  /* ==================== TOP BAR (высота 60px) ==================== */
  createTopBar() {
    const bar = this.add.rectangle(400, 30, 800, 60, 0x2c3e50).setDepth(0)

    // Слева: Energy ⚡
    this.topEnergyText = this.add.text(20, 30, '⚡ 0', {
      fontSize: '18px', fontFamily: 'Arial', color: '#4fc3f7', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(1)

    // Центр: название города
    this.topCityText = this.add.text(400, 20, 'Деревня Солнечная', {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(1)

    this.topLevelText = this.add.text(400, 40, 'Уровень 1', {
      fontSize: '11px', fontFamily: 'Arial', color: '#888888',
    }).setOrigin(0.5, 0.5).setDepth(1)

    // Справа: Coins 🪙
    this.topCoinsText = this.add.text(700, 30, '🪙 100', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(1)

    // Кнопка настроек ⚙️
    const settingsBtn = this.add.text(775, 30, '⚙️', {
      fontSize: '18px', fontFamily: 'Arial',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1)
    settingsBtn.on('pointerdown', () => this.showSettings())

    // SDK индикатор
    this.sdkIndicator = this.add.text(775, 55, '⏳', {
      fontSize: '10px', fontFamily: 'Arial', color: '#ffaa00',
    }).setOrigin(0.5).setDepth(1)
  }

  refreshSdkIndicator() {
    if (yandexManager.isReady()) { this.sdkIndicator.setText('✓').setColor('#4caf50') }
    else { this.sdkIndicator.setText('✗').setColor('#ff4444') }
  }

  refreshTopBarUI() {
    this.topEnergyText.setText(`⚡ ${this.energy}`)
    this.topCoinsText.setText(`🪙 ${this.coins}`)

    const level = Math.min(Math.floor(this.completedOrders / 3) + 1, 10)
    const cities = ['Деревня Солнечная', 'Посёлок Энергетик', 'Город Лучезарный', 'Мегаполис Гелиос']
    const cityIndex = Math.min(Math.floor(this.completedOrders / 5), cities.length - 1)
    this.topCityText.setText(cities[cityIndex])
    this.topLevelText.setText(`Уровень ${level}`)
  }

  refreshCoinsUI() {
    this.topCoinsText.setText(`🪙 ${this.coins}`)
    this.refreshShopButtons()
  }

  /* ==================== LEFT PANEL (180px) ==================== */
  createLeftPanel() {
    const x = 15, y = 455, w = 160, h = 130

    this.leftBg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.4).setStrokeStyle(1, 0x4a90e2, 0.2)

    this.cityTitle = this.add.text(x + w / 2, y + 8, 'Ваш город', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    this.cityBuilding = this.add.rectangle(x + w / 2, y + 42, 20, 20, 0x4a90e2).setStrokeStyle(1, 0x6ab0ff)

    this.cityOrdersText = this.add.text(x + w / 2, y + 65, 'Заказов: 0', {
      fontSize: '10px', fontFamily: 'Arial', color: '#aaaaaa',
    }).setOrigin(0.5, 0)

    this.cityLevelText = this.add.text(x + w / 2, y + 80, 'Уровень города: 1', {
      fontSize: '10px', fontFamily: 'Arial', color: '#ffd700',
    }).setOrigin(0.5, 0)

    // Прогресс-бар
    this.progressBg = this.add.rectangle(x + w / 2, y + 100, 140, 8, 0x333333, 0.8)
    this.progressFill = this.add.rectangle(x + w / 2 - 69, y + 100, 0, 6, 0x4caf50).setOrigin(0, 0.5)
    this.progressText = this.add.text(x + w / 2, y + 115, '0/3 до след. уровня', {
      fontSize: '8px', fontFamily: 'Arial', color: '#888888',
    }).setOrigin(0.5, 0)
  }

  refreshCityVisualization() {
    if (!this.cityBuilding) return
    const count = this.completedOrders
    let size = 20
    if (count >= 16) size = 80; else if (count >= 6) size = 60; else if (count >= 1) size = 40

    this.cityBuilding.setSize(size, size)
    this.cityOrdersText.setText(`Заказов: ${count}`)

    const level = Math.min(Math.floor(count / 3) + 1, 10)
    this.cityLevelText.setText(`Уровень города: ${level}`)

    // Прогресс-бар
    const progressInLevel = count % 3
    this.progressFill.setSize((progressInLevel / 3) * 138, 6)
    this.progressText.setText(`${progressInLevel}/3 до след. уровня`)
  }

  /* ==================== GRID ==================== */
  drawGrid() {
    const g = this.add.graphics()
    g.lineStyle(1, 0x888888, 0.2)
    for (let row = 0; row <= this.ROWS; row++) {
      const y = this.GRID_Y + row * this.CELL_SIZE
      g.moveTo(this.GRID_X, y); g.lineTo(this.GRID_X + this.COLS * this.CELL_SIZE, y)
    }
    for (let col = 0; col <= this.COLS; col++) {
      const x = this.GRID_X + col * this.CELL_SIZE
      g.moveTo(x, this.GRID_Y); g.lineTo(x, this.GRID_Y + this.ROWS * this.CELL_SIZE)
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
    this.updateEnergy(); this.saveGame()
    return true
  }

  updateEnergy() {
    this.energy = 0
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) { this.energy += this.gridCells[r][c].panel.power } } }
    this.refreshTopBarUI()
    this.refreshOrdersUI()
  }

  collectEnergyParticles() {
    const target = this.topEnergyText
    if (!target) return
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) {
          const p = this.gridCells[r][c].panel
          this.particles.flyTo(p.x, p.y - 10, target.x + 40, target.y, 0x4fc3f7, () => {
            this.tweens.add({ targets: target, scale: { from: 1, to: 1.2 }, duration: 100, yoyo: true, ease: 'Power2' })
          })
          return
        }
      }
    }
  }

  /* ==================== ORDERS (правая панель 220px) ==================== */
  createOrdersUI() {
    const x = 585, y = 65, w = 210, h = 380

    this.ordersBg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.4).setStrokeStyle(1, 0x4a90e2, 0.2)
    this.ordersTitle = this.add.text(x + w / 2, y + 12, 'Заказы', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    this.ordersContainer = this.add.container()
    this.ordersContainer.setPosition(x, y + 30)
  }

  refreshOrdersUI() {
    if (!this.ordersContainer) return
    this.ordersContainer.removeAll(true)
    const orders = this.orderSystem.orders
    const yOffset = 115

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i], cy = 10 + i * yOffset
      const canComplete = this.energy >= o.requiredEnergy

      const bg = this.add.rectangle(105, cy, 200, 105, 0x1a1a3e, 0.7).setStrokeStyle(1, canComplete ? 0x4caf50 : 0x333333, 0.5)

      this.add.text(15, cy - 38, o.city, {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
      })
      this.add.text(15, cy - 18, `⚡ ${o.requiredEnergy}`, {
        fontSize: '11px', fontFamily: 'Arial', color: '#4fc3f7',
      })
      this.add.text(15, cy + 2, `🪙 ${o.rewardCoins}`, {
        fontSize: '11px', fontFamily: 'Arial', color: '#4caf50',
      })

      // Кнопка "Выполнить"
      const btnColor = canComplete ? 0x4caf50 : 0x444444
      const btn = this.add.rectangle(170, cy + 30, 60, 24, btnColor, 0.9).setStrokeStyle(1, canComplete ? 0x66bb6a : 0x555555)
      this.add.text(170, cy + 30, 'Вып.', { fontSize: '10px', fontFamily: 'Arial', color: canComplete ? '#ffffff' : '#666666' }).setOrigin(0.5)

      // x2 кнопка
      const x2Btn = this.add.rectangle(170, cy + 58, 48, 20, canComplete ? 0xff9800 : 0x444444, 0.9).setStrokeStyle(1, canComplete ? 0xffb74d : 0x555555)
      this.add.text(170, cy + 58, '▶ x2', { fontSize: '9px', fontFamily: 'Arial', color: canComplete ? '#ffffff' : '#666666' }).setOrigin(0.5)

      if (canComplete) {
        btn.setInteractive({ useHandCursor: true })
        this.tweens.add({ targets: btn, scale: { from: 1, to: 1.05 }, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        btn.on('pointerover', () => btn.setFillStyle(0x66bb6a))
        btn.on('pointerout', () => btn.setFillStyle(0x4caf50))
        btn.on('pointerdown', () => this.completeOrderAction(i, false))

        x2Btn.setInteractive({ useHandCursor: true })
        this.tweens.add({ targets: x2Btn, scale: { from: 1, to: 1.05 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' })
        x2Btn.on('pointerover', () => x2Btn.setFillStyle(0xffb74d))
        x2Btn.on('pointerout', () => x2Btn.setFillStyle(0xff9800))
        x2Btn.on('pointerdown', () => {
          yandexManager.showRewardedVideo(() => this.completeOrderAction(i, true))
        })
      }

      this.ordersContainer.add([bg, btn, x2Btn])
    }

    // Сохраняем первую кнопку для туториала
    if (orders.length > 0) {
      this.firstOrderBtn = this.ordersContainer.list[2]
    }
  }

  completeOrderAction(index, doubled) {
    const result = this.orderSystem.completeOrder(index)
    if (!result) return

    const multiplier = doubled ? 2 : 1
    const reward = result.rewardCoins * multiplier

    this.particles.burst(585 + 105, 40 + index * 115, doubled ? 0xff9800 : 0x4caf50, 10, { speed: 60, size: 4 })
    const ft = this.add.text(585 + 105, 20 + index * 115, `+${reward} монет!`, {
      fontSize: '14px', fontFamily: 'Arial', color: doubled ? '#ff9800' : '#4caf50', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(200)
    this.tweens.add({ targets: ft, y: ft.y - 40, alpha: 0, duration: 800, ease: 'Power2', onComplete: () => ft.destroy() })

    for (let j = 0; j < (doubled ? 5 : 3); j++) {
      this.time.delayedCall(j * 60, () => {
        this.particles.flyTo(585 + 105, 40 + index * 115, this.topCoinsText.x + 10, this.topCoinsText.y, 0xffd700)
      })
    }

    this.coins += reward
    this.completedOrders++
    if (doubled) this.orderSystem.totalRewardedAdsWatched++

    this.refreshCoinsUI(); this.refreshOrdersUI(); this.refreshCityVisualization()
    this.refreshTopBarUI()
    if (this.orderSystem.shouldShowInterstitial()) yandexManager.showInterstitial()
    this.saveGame()
  }

  /* ==================== SHOP (нижняя панель) ==================== */
  createShopBottom() {
    const y = 555

    this.shopBg = this.add.rectangle(400, y, 800, 50, 0x000000, 0.5).setDepth(0)

    this.shopContainer = this.add.container(0, 0).setDepth(1)

    // T1 кнопка
    this.t1BtnBg = this.add.rectangle(230, y, 160, 34, 0x4a90e2, 0.9).setStrokeStyle(1, 0x6ab0ff).setInteractive({ useHandCursor: true })
    this.add.text(230, y, '🟦 T1 (50)', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.t1BtnBg.on('pointerover', () => { if (this.t1BtnBg.input.enabled) this.t1BtnBg.setFillStyle(0x5aa0f2) })
    this.t1BtnBg.on('pointerout', () => { if (this.t1BtnBg.input.enabled) this.t1BtnBg.setFillStyle(0x4a90e2) })
    this.t1BtnBg.on('pointerdown', () => this.buyPanel(1, 50))

    // T2 кнопка
    this.t2BtnBg = this.add.rectangle(410, y, 160, 34, 0x4a90e2, 0.9).setStrokeStyle(1, 0x6ab0ff).setInteractive({ useHandCursor: true })
    this.add.text(410, y, '🟦 T2 (150)', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.t2BtnBg.on('pointerover', () => { if (this.t2BtnBg.input.enabled) this.t2BtnBg.setFillStyle(0x5aa0f2) })
    this.t2BtnBg.on('pointerout', () => { if (this.t2BtnBg.input.enabled) this.t2BtnBg.setFillStyle(0x4a90e2) })
    this.t2BtnBg.on('pointerdown', () => this.buyPanel(2, 150))

    // Бонус кнопка
    this.bonusBtnBg = this.add.rectangle(580, y, 100, 34, 0xf39c12, 0.9).setStrokeStyle(1, 0xf5b842).setInteractive({ useHandCursor: true })
    const bonusTxt = this.add.text(580, y, '🎁 Бонус', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.bonusBtnBg.on('pointerdown', () => this.toast.show('Бонус будет доступен каждые 24ч!', 'info'))
  }

  refreshShopButtons() {
    const t1ok = this.coins >= 50, t2ok = this.coins >= 150
    this.t1BtnBg.setFillStyle(t1ok ? 0x4a90e2 : 0x444444)
    if (!t1ok) this.t1BtnBg.disableInteractive(); else this.t1BtnBg.setInteractive({ useHandCursor: true })
    this.t2BtnBg.setFillStyle(t2ok ? 0x4a90e2 : 0x444444)
    if (!t2ok) this.t2BtnBg.disableInteractive(); else this.t2BtnBg.setInteractive({ useHandCursor: true })
  }

  buyPanel(tier, cost) {
    if (this.coins < cost) { this.toast.show('Недостаточно монет!', 'error'); return }
    const empty = []
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { if (!this.gridCells[r][c].occupied) empty.push({ row: r, col: c }) } }
    if (empty.length === 0) { this.toast.show('Сетка заполнена!', 'error'); return }

    this.coins -= cost; this.refreshCoinsUI()
    const cell = Phaser.Math.RND.pick(empty)
    const pos = this.getCellCenter(cell.row, cell.col)

    const panel = new Panel(this, pos.x, -50, tier)
    panel.setGridPos(cell.row, cell.col)
    panel.setScale(0.7)
    this.gridCells[cell.row][cell.col].occupied = true; this.gridCells[cell.row][cell.col].panel = panel
    this.tweens.add({ targets: panel, y: pos.y, scale: 1, duration: 400, ease: 'Back.easeOut' })

    for (let j = 0; j < 3; j++) {
      this.time.delayedCall(j * 100, () => this.particles.flyTo(this.topCoinsText.x + 10, this.topCoinsText.y, pos.x + Phaser.Math.Between(-15, 15), pos.y, 0xffd700))
    }

    this.updateEnergy(); this.saveGame()
    this.toast.show(`Куплена панель T${tier}!`, 'success')
  }

  getCellCenter(row, col) {
    return { x: this.GRID_X + col * this.CELL_SIZE + this.CELL_SIZE / 2, y: this.GRID_Y + row * this.CELL_SIZE + this.CELL_SIZE / 2 }
  }

  /* ==================== SETTINGS ==================== */
  showSettings() {
    const popup = this.add.container(400, 300).setDepth(300)
    const bg = this.add.rectangle(0, 0, 300, 240, 0x1a1a3e, 0.95).setStrokeStyle(2, 0x4a90e2, 0.8)
    const title = this.add.text(0, -95, 'Настройки', { fontSize: '18px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)

    // Звуки
    const soundTxt = this.add.text(-100, -50, `Звуки: ${this.soundEnabled ? 'Вкл' : 'Выкл'}`, { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0, 0.5)
    const soundBtn = this.add.rectangle(80, -50, 60, 24, this.soundEnabled ? 0x4caf50 : 0x555555, 0.9).setInteractive({ useHandCursor: true })
    soundBtn.on('pointerdown', () => { this.soundEnabled = !this.soundEnabled; soundTxt.setText(`Звуки: ${this.soundEnabled ? 'Вкл' : 'Выкл'}`); soundBtn.setFillStyle(this.soundEnabled ? 0x4caf50 : 0x555555) })

    // Музыка
    const musicTxt = this.add.text(-100, -10, `Музыка: ${this.musicEnabled ? 'Вкл' : 'Выкл'}`, { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0, 0.5)
    const musicBtn = this.add.rectangle(80, -10, 60, 24, this.musicEnabled ? 0x4caf50 : 0x555555, 0.9).setInteractive({ useHandCursor: true })
    musicBtn.on('pointerdown', () => { this.musicEnabled = !this.musicEnabled; musicTxt.setText(`Музыка: ${this.musicEnabled ? 'Вкл' : 'Выкл'}`); musicBtn.setFillStyle(this.musicEnabled ? 0x4caf50 : 0x555555) })

    // Сбросить прогресс
    const resetBtn = this.add.rectangle(0, 50, 160, 30, 0xff4444, 0.9).setInteractive({ useHandCursor: true })
    this.add.text(0, 50, 'Сбросить прогресс', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    resetBtn.on('pointerdown', () => {
      const confirmBg = this.add.rectangle(0, 0, 800, 600, 0x000000, 0.7).setDepth(399).setInteractive()
      const confirmPopup = this.add.container(0, 0).setDepth(400)
      const cb = this.add.rectangle(0, 0, 280, 120, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xff4444)
      const ct = this.add.text(0, -30, 'Точно сбросить прогресс?\nЭто действие нельзя отменить!', { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', align: 'center' }).setOrigin(0.5)
      const yesBtn = this.add.rectangle(-50, 30, 80, 28, 0xff4444, 0.9).setInteractive({ useHandCursor: true })
      this.add.text(-50, 30, 'Да', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      const noBtn = this.add.rectangle(50, 30, 80, 28, 0x555555, 0.9).setInteractive({ useHandCursor: true })
      this.add.text(50, 30, 'Нет', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5)
      confirmPopup.add([cb, ct, yesBtn, noBtn])

      yesBtn.on('pointerdown', () => {
        CloudSaveManager.reset()
        this.scene.restart()
      })
      noBtn.on('pointerdown', () => { confirmBg.destroy(); confirmPopup.destroy() })
    })

    // О игре
    this.add.text(0, 90, 'Solar Merge v1.0', { fontSize: '11px', fontFamily: 'Arial', color: '#555555' }).setOrigin(0.5)

    // Закрыть
    const closeBtn = this.add.rectangle(0, 120, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true })
    this.add.text(0, 120, 'Закрыть', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    closeBtn.on('pointerdown', () => popup.destroy())

    popup.add([bg, title, soundTxt, soundBtn, musicTxt, musicBtn, resetBtn, closeBtn])
  }

  /* ==================== SAVE/LOAD ==================== */
  async saveGame() {
    const panels = []
    for (let r = 0; r < this.ROWS; r++) { for (let c = 0; c < this.COLS; c++) { const p = this.gridCells[r][c].panel; if (p) panels.push({ row: r, col: c, tier: p.tier }) } }
    this.lastSaveTime = Date.now()
    await CloudSaveManager.save({ panels, coins: this.coins, completedOrders: this.completedOrders, lastSaveTime: this.lastSaveTime, orders: this.orderSystem.orders, completedCount: this.orderSystem.completedCount, totalRewardedAdsWatched: this.orderSystem.totalRewardedAdsWatched })
  }

  loadLocalGame() {
    const data = CloudSaveManager.loadLocalSnapshot()
    if (!data) { this.orderSystem.refillOrders(1); return }
    this.coins = data.coins || 100; this.completedOrders = data.completedOrders || 0; this.lastSaveTime = data.lastSaveTime || Date.now()
    if (data.panels) { for (const p of data.panels) { if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col) } }
    if (data.orders && data.orders.length > 0) { this.orderSystem.orders = data.orders } else { this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier()) }
    if (data.completedCount !== undefined) this.orderSystem.completedCount = data.completedCount
    if (data.totalRewardedAdsWatched !== undefined) this.orderSystem.totalRewardedAdsWatched = data.totalRewardedAdsWatched
  }

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
      closePopup(); this.toast.show(`+${finalEnergy} энергии (офлайн)!`, 'success'); this.saveGame()
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

  /* ==================== DRAG-AND-DROP ==================== */
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

  merge(p1, p2, row, col) {
    const cell = this.gridCells[row][col]
    const newTier = p1.tier + 1
    const targetX = cell.x, targetY = cell.y

    this.tweens.add({ targets: p1, x: targetX, y: targetY, scale: 0, duration: 200, ease: 'Power2', onComplete: () => p1.destroy() })
    this.tweens.add({ targets: p2, x: targetX, y: targetY, scale: 0, duration: 200, ease: 'Power2', onComplete: () => p2.destroy() })

    this.time.delayedCall(180, () => {
      this.particles.flash(targetX, targetY)
      this.particles.burst(targetX, targetY, 0xffd700, 8, { speed: 80, size: 6 })
    })

    this.time.delayedCall(200, () => {
      const newPanel = new Panel(this, targetX, targetY, newTier)
      newPanel.setGridPos(row, col)
      cell.occupied = true; cell.panel = newPanel
      newPanel.setScale(0)
      this.tweens.add({
        targets: newPanel,
        scale: { from: 0, to: 1.2 },
        duration: 250, ease: 'Back.easeOut',
        onComplete: () => { this.tweens.add({ targets: newPanel, scale: 1, duration: 100, ease: 'Power2' }) },
      })
      this.updateEnergy(); this.saveGame()
    })
  }
}
