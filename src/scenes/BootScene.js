import Panel from '../entities/Panel.js'
import CloudSaveManager from '../utils/CloudSaveManager.js'
import yandexManager from '../utils/YandexManager.js'
import OrderSystem from '../systems/OrderSystem.js'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene')
  }

  /* ───── CREATE ───── */
  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e')

    // Параметры сетки
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

    // Загружаем локальный снимок для быстрого старта, потом обновим из облака
    this.loadLocalGame()

    if (this.orderSystem.orders.length === 0) {
      this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    }

    this.refreshOrdersUI()
    this.refreshCityVisualization()

    // Drag-and-Drop
    this.draggedPanel = null
    this.dragOffsetX = 0
    this.dragOffsetY = 0
    this.input.on('pointerdown', (ptr) => this.onPointerDown(ptr))
    this.input.on('pointermove', (ptr) => this.onPointerMove(ptr))
    this.input.on('pointerup', (ptr) => this.onPointerUp(ptr))

    this.spawnStartingPanels()

    // Асинхронная инициализация SDK и загрузка из облака
    this.initSdkAndCloud()
  }

  async initSdkAndCloud() {
    await yandexManager.init()
    this.refreshSdkIndicator()

    // Загружаем из облака (перезаписывает локальные данные)
    const cloudData = await CloudSaveManager.load()
    if (cloudData) {
      this.coins = cloudData.coins !== undefined ? cloudData.coins : this.coins
      this.completedOrders = cloudData.completedOrders || 0
      this.lastSaveTime = cloudData.lastSaveTime || Date.now()
      this.orderSystem.completedCount = cloudData.completedCount || 0
      this.orderSystem.totalRewardedAdsWatched = cloudData.totalRewardedAdsWatched || 0

      if (cloudData.panels) {
        // Удаляем старые панели
        for (let r = 0; r < this.ROWS; r++) {
          for (let c = 0; c < this.COLS; c++) {
            if (this.gridCells[r][c].panel) {
              this.gridCells[r][c].panel.destroy()
              this.gridCells[r][c].panel = null
              this.gridCells[r][c].occupied = false
            }
          }
        }
        for (const p of cloudData.panels) {
          if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) {
            this.spawnPanelAt(p.tier, p.row, p.col)
          }
        }
      }

      if (cloudData.orders && cloudData.orders.length > 0) {
        this.orderSystem.orders = cloudData.orders
      } else {
        this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
      }

      this.refreshOrdersUI()
      this.refreshCoinsUI()
      this.refreshCityVisualization()
    }

    // Проверяем офлайн-бонус
    this.checkOfflineBonus()
  }

  /* ───── ИНДИКАТОР SDK ───── */
  createIndicators() {
    this.sdkIndicator = this.add.text(780, 10, 'SDK: ⏳', {
      fontSize: '11px', fontFamily: 'Arial', color: '#ffaa00',
    }).setOrigin(1, 0)
  }

  refreshSdkIndicator() {
    if (yandexManager.isReady()) {
      this.sdkIndicator.setText('SDK: ✓').setColor('#4caf50')
    } else {
      this.sdkIndicator.setText('SDK: ✗').setColor('#ff4444')
    }
  }

  /* ───── КНОПКА ПОДЕЛИТЬСЯ ───── */
  createShareButton() {
    const btn = this.add.rectangle(780, 35, 100, 24, 0x4a90e2, 0.8)
      .setStrokeStyle(1, 0x6ab0ff)
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true })

    const txt = this.add.text(780, 35, 'Поделиться', {
      fontSize: '11px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(1, 0.5)

    btn.on('pointerdown', async () => {
      const ok = await yandexManager.share()
      if (!ok) {
        this.showNotification('Функция недоступна', 0xff4444)
      }
    })
  }

  /* ───── СЕТКА ───── */
  drawGrid() {
    const g = this.add.graphics()
    g.lineStyle(1, 0x888888, 0.3)
    for (let row = 0; row <= this.ROWS; row++) {
      const y = this.GRID_Y + row * this.CELL_SIZE
      g.moveTo(this.GRID_X, y)
      g.lineTo(this.GRID_X + this.COLS * this.CELL_SIZE, y)
    }
    for (let col = 0; col <= this.COLS; col++) {
      const x = this.GRID_X + col * this.CELL_SIZE
      g.moveTo(x, this.GRID_Y)
      g.lineTo(x, this.GRID_Y + this.ROWS * this.CELL_SIZE)
    }
    g.strokePath()
  }

  spawnStartingPanels() {
    let count = 0
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.gridCells[r][c].occupied) count++
      }
    }
    if (count > 0) return

    const positions = []
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) positions.push({ row: r, col: c })
    }
    Phaser.Utils.Array.Shuffle(positions)
    for (let i = 0; i < 3 && i < positions.length; i++) {
      this.spawnPanelAt(1, positions[i].row, positions[i].col)
    }
  }

  spawnPanelAt(tier, row, col) {
    if (this.gridCells[row][col].occupied) return false
    const cell = this.gridCells[row][col]
    const panel = new Panel(this, cell.x, cell.y, tier)
    panel.setGridPos(row, col)
    cell.occupied = true
    cell.panel = panel
    panel.setScale(0.5)
    this.tweens.add({ targets: panel, scale: 1, duration: 250, ease: 'Back.easeOut' })
    this.updateEnergy()
    this.saveGame()
    return true
  }

  updateEnergy() {
    this.energy = 0
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) {
          this.energy += this.gridCells[r][c].panel.power
        }
      }
    }
    this.energyText.setText(`Energy: ${this.energy}`)
    this.refreshOrdersUI()
  }

  /* ───── UI ───── */
  createUI() {
    this.energyText = this.add.text(10, 10, 'Energy: 0', {
      fontSize: '16px', fontFamily: 'Arial', color: '#4fc3f7',
    })
    this.coinsText = this.add.text(10, 30, 'Coins: 100', {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffd700',
    })
  }

  refreshCoinsUI() {
    this.coinsText.setText(`Coins: ${this.coins}`)
    this.refreshShopButtons()
  }

  /* ───── ЗАКАЗЫ ───── */
  createOrdersUI() {
    const x = 460, y = 50, w = 310, h = 410

    this.ordersBg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.5)
    this.ordersTitle = this.add.text(x + w / 2, y + 15, 'Заказы городов', {
      fontSize: '15px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    this.ordersContainer = this.add.container()
    this.ordersContainer.setPosition(x, y)
  }

  refreshOrdersUI() {
    if (!this.ordersContainer) return

    this.ordersContainer.removeAll(true)
    const orders = this.orderSystem.orders
    const startY = 40
    const yOffset = 120

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i]
      const cy = startY + i * yOffset

      const bg = this.add.rectangle(155, cy, 290, 110, 0x1a1a3e, 0.8)
        .setStrokeStyle(1, 0x4a90e2, 0.5)

      const cityText = this.add.text(20, cy - 38, o.city, {
        fontSize: '14px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
      })

      const needText = this.add.text(20, cy - 18, `Нужно: ${o.requiredEnergy} энергии`, {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
      })

      const rewardText = this.add.text(20, cy + 2, `Награда: ${o.rewardCoins} монет`, {
        fontSize: '12px', fontFamily: 'Arial', color: '#4caf50',
      })

      const canComplete = this.energy >= o.requiredEnergy

      // Кнопка "Выполнить"
      const btnColor = canComplete ? 0x4caf50 : 0x555555
      const btn = this.add.rectangle(235, cy + 40, 90, 26, btnColor, 0.9)
        .setStrokeStyle(1, canComplete ? 0x66bb6a : 0x777777)

      const btnText = this.add.text(235, cy + 40, 'Выполнить', {
        fontSize: '11px', fontFamily: 'Arial', color: canComplete ? '#ffffff' : '#888888',
      }).setOrigin(0.5)

      if (canComplete) {
        btn.setInteractive({ useHandCursor: true })
        btn.on('pointerover', () => btn.setFillStyle(0x66bb6a))
        btn.on('pointerout', () => btn.setFillStyle(0x4caf50))
        btn.on('pointerdown', () => {
          const result = this.orderSystem.completeOrder(i)
          if (result) {
            this.coins += result.rewardCoins
            this.completedOrders++
            this.refreshCoinsUI()
            this.refreshOrdersUI()
            this.refreshCityVisualization()

            // Interstitial каждый 2 заказ
            if (this.orderSystem.shouldShowInterstitial()) {
              yandexManager.showInterstitial()
            }

            this.saveGame()
          }
        })
      }

      // Кнопка "▶ x2" (rewarded video)
      const x2Color = canComplete ? 0xff9800 : 0x555555
      const x2Btn = this.add.rectangle(235, cy + 70, 90, 22, x2Color, 0.9)
        .setStrokeStyle(1, canComplete ? 0xffb74d : 0x777777)

      const x2Text = this.add.text(235, cy + 70, '▶ x2', {
        fontSize: '11px', fontFamily: 'Arial', color: canComplete ? '#ffffff' : '#888888',
      }).setOrigin(0.5)

      if (canComplete) {
        x2Btn.setInteractive({ useHandCursor: true })
        x2Btn.on('pointerover', () => x2Btn.setFillStyle(0xffb74d))
        x2Btn.on('pointerout', () => x2Btn.setFillStyle(0xff9800))
        x2Btn.on('pointerdown', () => {
          yandexManager.showRewardedVideo(() => {
            const result = this.orderSystem.completeOrder(i)
            if (result) {
              this.coins += result.rewardCoins * 2
              this.completedOrders++
              this.orderSystem.totalRewardedAdsWatched++
              this.refreshCoinsUI()
              this.refreshOrdersUI()
              this.refreshCityVisualization()

              if (this.orderSystem.shouldShowInterstitial()) {
                yandexManager.showInterstitial()
              }

              this.saveGame()
            }
          })
        })
      }

      this.ordersContainer.add([bg, cityText, needText, rewardText, btn, btnText, x2Btn, x2Text])
    }
  }

  /* ───── МАГАЗИН ───── */
  createShop() {
    this.shopBg = this.add.rectangle(230, 530, 430, 55, 0x000000, 0.5)
    this.shopTitle = this.add.text(30, 505, 'Магазин', {
      fontSize: '13px', fontFamily: 'Arial', color: '#aaaaaa',
    })

    this.tier1Btn = this.createShopButton(120, 530, 'Панель T1 (50)', () => this.buyPanel(1, 50))
    this.tier2Btn = this.createShopButton(280, 530, 'Панель T2 (150)', () => this.buyPanel(2, 150))

    this.notificationText = this.add.text(400, 570, '', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ff4444',
    }).setOrigin(0.5)
  }

  createShopButton(x, y, label, callback) {
    const btn = this.add.rectangle(x, y, 140, 32, 0x4a90e2, 0.8)
      .setStrokeStyle(1, 0x6ab0ff)
      .setInteractive({ useHandCursor: true })

    const txt = this.add.text(x, y, label, {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5)

    btn.on('pointerover', () => { if (btn.input.enabled) btn.setFillStyle(0x5aa0f2) })
    btn.on('pointerout', () => { if (btn.input.enabled) btn.setFillStyle(0x4a90e2) })
    btn.on('pointerdown', callback)

    btn._label = txt
    return btn
  }

  refreshShopButtons() {
    const t1ok = this.coins >= 50
    const t2ok = this.coins >= 150

    this.tier1Btn.setFillStyle(t1ok ? 0x4a90e2 : 0x555555)
    this.tier1Btn._label.setColor(t1ok ? '#ffffff' : '#888888')
    if (!t1ok) this.tier1Btn.disableInteractive()
    else this.tier1Btn.setInteractive({ useHandCursor: true })

    this.tier2Btn.setFillStyle(t2ok ? 0x4a90e2 : 0x555555)
    this.tier2Btn._label.setColor(t2ok ? '#ffffff' : '#888888')
    if (!t2ok) this.tier2Btn.disableInteractive()
    else this.tier2Btn.setInteractive({ useHandCursor: true })
  }

  buyPanel(tier, cost) {
    if (this.coins < cost) {
      this.showNotification('Недостаточно монет!', 0xff4444)
      return
    }

    const empty = []
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        if (!this.gridCells[r][c].occupied) empty.push({ row: r, col: c })
      }
    }

    if (empty.length === 0) {
      this.showNotification('Сетка заполнена!', 0xff4444)
      return
    }

    this.coins -= cost
    this.refreshCoinsUI()
    const cell = Phaser.Math.RND.pick(empty)
    this.spawnPanelAt(tier, cell.row, cell.col)
    this.saveGame()
    this.showNotification(`Куплена панель T${tier}!`, 0x4caf50)
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

    this.cityBg = this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.5)
      .setStrokeStyle(1, 0x4a90e2, 0.3)

    this.cityTitle = this.add.text(x + w / 2, y + 8, 'Ваш город', {
      fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0)

    this.cityBuilding = this.add.rectangle(x + w / 2, y + 52, 20, 20, 0x4a90e2)
      .setStrokeStyle(1, 0x6ab0ff)

    this.cityOrdersText = this.add.text(x + w / 2, y + 80, 'Выполнено заказов: 0', {
      fontSize: '10px', fontFamily: 'Arial', color: '#aaaaaa',
    }).setOrigin(0.5, 0)
  }

  refreshCityVisualization() {
    if (!this.cityBuilding) return
    const count = this.completedOrders
    let size = 20
    if (count >= 16) size = 80
    else if (count >= 6) size = 60
    else if (count >= 1) size = 40

    this.cityBuilding.setSize(size, size)
    this.cityOrdersText.setText(`Выполнено заказов: ${count}`)
  }

  /* ───── СОХРАНЕНИЕ ───── */
  async saveGame() {
    const panels = []
    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const p = this.gridCells[r][c].panel
        if (p) panels.push({ row: r, col: c, tier: p.tier })
      }
    }

    this.lastSaveTime = Date.now()

    await CloudSaveManager.save({
      panels,
      coins: this.coins,
      completedOrders: this.completedOrders,
      lastSaveTime: this.lastSaveTime,
      orders: this.orderSystem.orders,
      completedCount: this.orderSystem.completedCount,
      totalRewardedAdsWatched: this.orderSystem.totalRewardedAdsWatched,
    })
  }

  loadLocalGame() {
    const data = CloudSaveManager.loadLocalSnapshot()
    if (!data) {
      this.orderSystem.refillOrders(1)
      this.createOrdersUI()
      this.refreshOrdersUI()
      return
    }

    this.coins = data.coins || 100
    this.completedOrders = data.completedOrders || 0
    this.lastSaveTime = data.lastSaveTime || Date.now()

    if (data.panels) {
      for (const p of data.panels) {
        if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) {
          this.spawnPanelAt(p.tier, p.row, p.col)
        }
      }
    }

    if (data.orders && data.orders.length > 0) {
      this.orderSystem.orders = data.orders
    } else {
      this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    }

    if (data.completedCount !== undefined) this.orderSystem.completedCount = data.completedCount
    if (data.totalRewardedAdsWatched !== undefined) this.orderSystem.totalRewardedAdsWatched = data.totalRewardedAdsWatched

    this.createOrdersUI()
    this.refreshOrdersUI()
    this.refreshCoinsUI()
  }

  /* ───── ОФЛАЙН-БОНУС ───── */
  checkOfflineBonus() {
    const now = Date.now()
    const elapsed = now - this.lastSaveTime
    const hoursAway = Math.floor(elapsed / (1000 * 60 * 60))

    if (hoursAway < 2) return // меньше 2 часов — без бонуса

    // Рассчитываем бонус: (часов * 10) энергии
    const bonusEnergy = hoursAway * 10

    // Показываем попап
    const popupBg = this.add.rectangle(400, 300, 350, 160, 0x000000, 0.85)
      .setDepth(200)
    const popupTitle = this.add.text(400, 240, `Вы отсутствовали ${hoursAway} ч.`, {
      fontSize: '16px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201)

    const popupText = this.add.text(400, 265, `Бонус: ${bonusEnergy} энергии!`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#4fc3f7',
    }).setOrigin(0.5).setDepth(201)

    // Кнопка "Посмотреть рекламу → x3"
    const adBtn = this.add.rectangle(400, 310, 220, 30, 0xff9800, 0.9)
      .setStrokeStyle(1, 0xffb74d)
      .setInteractive({ useHandCursor: true })
      .setDepth(202)

    const adTxt = this.add.text(400, 310, 'Реклама → x3 бонус', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203)

    // Кнопка "Забрать"
    const takeBtn = this.add.rectangle(300, 355, 100, 26, 0x4caf50, 0.9)
      .setStrokeStyle(1, 0x66bb6a)
      .setInteractive({ useHandCursor: true })
      .setDepth(202)

    const takeTxt = this.add.text(300, 355, 'Забрать', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203)

    // Кнопка закрыть
    const closeBtn = this.add.rectangle(500, 355, 100, 26, 0x888888, 0.9)
      .setInteractive({ useHandCursor: true })
      .setDepth(202)

    const closeTxt = this.add.text(500, 355, 'Закрыть', {
      fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(203)

    let claimed = false

    const closePopup = () => {
      popupBg.destroy()
      popupTitle.destroy()
      popupText.destroy()
      adBtn.destroy()
      adTxt.destroy()
      takeBtn.destroy()
      takeTxt.destroy()
      closeBtn.destroy()
      closeTxt.destroy()
    }

    const giveBonus = (multiplier) => {
      if (claimed) return
      claimed = true

      const finalEnergy = bonusEnergy * multiplier
      // Добавляем энергию — распределяем как панели tier 1
      const panelsToAdd = Math.ceil(finalEnergy / 10)
      for (let i = 0; i < panelsToAdd; i++) {
        const empty = []
        for (let r = 0; r < this.ROWS; r++) {
          for (let c = 0; c < this.COLS; c++) {
            if (!this.gridCells[r][c].occupied) empty.push({ row: r, col: c })
          }
        }
        if (empty.length === 0) break
        const cell = Phaser.Math.RND.pick(empty)
        this.spawnPanelAt(1, cell.row, cell.col)
      }

      closePopup()
      this.showNotification(`+${finalEnergy} энергии (офлайн)!`, 0x4fc3f7)
      this.saveGame()
    }

    adBtn.on('pointerdown', () => {
      yandexManager.showRewardedVideo(() => {
        giveBonus(3)
      })
    })

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
        const half = 32
        const dx = pointer.x - panel.x
        const dy = pointer.y - panel.y
        if (Math.abs(dx) <= half && Math.abs(dy) <= half) {
          this.draggedPanel = panel
          this.dragOffsetX = dx
          this.dragOffsetY = dy
          cell.occupied = false
          cell.panel = null
          panel.setDepth(100)
          return
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
    const panel = this.draggedPanel
    this.draggedPanel = null
    panel.setDepth(1)

    let minDist = Infinity
    let targetRow = -1, targetCol = -1

    for (let r = 0; r < this.ROWS; r++) {
      for (let c = 0; c < this.COLS; c++) {
        const cell = this.gridCells[r][c]
        const dx = panel.x - cell.x
        const dy = panel.y - cell.y
        const dist = dx * dx + dy * dy
        if (dist < minDist) { minDist = dist; targetRow = r; targetCol = c }
      }
    }

    if (targetRow === -1 || targetCol === -1) { this.returnToOriginalCell(panel); return }

    const targetCell = this.gridCells[targetRow][targetCol]

    if (targetCell.occupied && targetCell.panel) {
      const tp = targetCell.panel
      if (tp.tier === panel.tier && panel.tier < 10) {
        this.merge(panel, tp, targetRow, targetCol)
      } else {
        this.returnToOriginalCell(panel)
      }
    } else {
      panel.setGridPos(targetRow, targetCol)
      targetCell.occupied = true
      targetCell.panel = panel
      this.tweens.add({ targets: panel, x: targetCell.x, y: targetCell.y, duration: 150, ease: 'Power2' })
      panel.label.setPosition(targetCell.x, targetCell.y)
    }
  }

  returnToOriginalCell(panel) {
    const row = panel.gridX, col = panel.gridY
    if (row >= 0 && row < this.ROWS && col >= 0 && col < this.COLS) {
      if (!this.gridCells[row][col].occupied) {
        const cell = this.gridCells[row][col]
        cell.occupied = true; cell.panel = panel
        this.tweens.add({ targets: panel, x: cell.x, y: cell.y, duration: 150, ease: 'Power2' })
        panel.label.setPosition(cell.x, cell.y)
        return
      }
    }
    panel.destroy()
  }

  merge(p1, p2, row, col) {
    const cell = this.gridCells[row][col]
    const newTier = p1.tier + 1
    console.log(`Merged to tier ${newTier}`)

    p1.destroy(); p2.destroy()
    const newPanel = new Panel(this, cell.x, cell.y, newTier)
    newPanel.setGridPos(row, col)
    cell.occupied = true; cell.panel = newPanel
    newPanel.setScale(0.5)
    this.tweens.add({ targets: newPanel, scale: 1, duration: 300, ease: 'Back.easeOut' })

    this.updateEnergy()
    this.saveGame()
  }
}
