import Panel from '../entities/Panel.js'
import { GoldenPanel, BoosterPanel, PiggyBankPanel } from '../entities/SpecialPanels.js'
import CloudSaveManager from '../utils/CloudSaveManager.js'
import yandexManager from '../utils/YandexManager.js'
import OrderSystem from '../systems/OrderSystem.js'
import ParticleSystem from '../utils/ParticleSystem.js'
import Toast from '../utils/Toast.js'
import Tutorial from '../systems/Tutorial.js'
import UpgradeSystem, { UPGRADES } from '../systems/UpgradeSystem.js'
import BoostSystem from '../systems/BoostSystem.js'
import ComboCriticalSystem from '../systems/ComboCriticalSystem.js'

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  preload() {
    for (let i = 1; i <= 10; i++) this.load.image(`panel_${i}`, `assets/panels/panel_${i}.png`)
  }

  create() {
    this.cameras.main.setBackgroundColor('#1a1a2e')
    this.particles = new ParticleSystem(this)
    this.toast = new Toast(this)
    this.energy = 0; this.coins = 100; this.completedOrders = 0; this.lastSaveTime = Date.now()
    this.soundEnabled = true; this.musicEnabled = true
    this.orderSystem = new OrderSystem(this)
    this.upgradeSystem = new UpgradeSystem(this)
    this.boostSystem = new BoostSystem(this)
    this.comboSystem = new ComboCriticalSystem(this)
    this.tutorial = new Tutorial(this)

    this.COLS = 5; this.ROWS = 5; this.CELL_SIZE = 72; this.GRID_X = 195; this.GRID_Y = 85
    this.gridCells = []
    for (let r = 0; r < this.ROWS; r++) {
      this.gridCells[r] = []
      for (let c = 0; c < this.COLS; c++) {
        const cx = this.GRID_X + c * this.CELL_SIZE + this.CELL_SIZE / 2
        const cy = this.GRID_Y + r * this.CELL_SIZE + this.CELL_SIZE / 2
        this.gridCells[r][c] = { x: cx, y: cy, occupied: false, panel: null }
      }
    }

    this.createTopBar(); this.createLeftPanel(); this.drawGrid(); this.createOrdersUI(); this.createShopBottom()
    this.loadLocalGame()
    if (this.orderSystem.orders.length === 0) this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    this.refreshOrdersUI(); this.refreshCityVisualization(); this.refreshTopBarUI()

    this.draggedPanel = null; this.dragOffsetX = 0; this.dragOffsetY = 0
    this.input.on('pointerdown', (ptr) => this.onPointerDown(ptr))
    this.input.on('pointermove', (ptr) => this.onPointerMove(ptr))
    this.input.on('pointerup', (ptr) => this.onPointerUp(ptr))
    this.spawnStartingPanels(); this.initSdkAndCloud()

    this.energyTimer = this.time.addEvent({ delay: 2000, loop: true, callback: () => this.collectEnergyParticles() })
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateBoostTimer() })
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.comboSystem.tryAutoMerge() })
    this.time.delayedCall(500, () => this.tutorial.start())
  }

  async initSdkAndCloud() {
    await yandexManager.init(); this.refreshSdkIndicator()
    const data = await CloudSaveManager.load()
    if (data) {
      this.coins = data.coins || 100; this.completedOrders = data.completedOrders || 0; this.lastSaveTime = data.lastSaveTime || Date.now()
      this.orderSystem.completedCount = data.completedCount || 0; this.orderSystem.totalRewardedAdsWatched = data.totalRewardedAdsWatched || 0
      if (data.panels) {
        for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { if (this.gridCells[r][c].panel) { this.gridCells[r][c].panel.destroy(); this.gridCells[r][c].panel = null; this.gridCells[r][c].occupied = false } }
        for (const p of data.panels) { if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col, p.type) }
      }
      if (data.orders && data.orders.length > 0) this.orderSystem.orders = data.orders
      else this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
      if (data.upgradeLevels) this.upgradeSystem.levels = data.upgradeLevels
      if (data.activeBoosts) this.boostSystem.activeBoosts = data.activeBoosts
      this.comboSystem.autoMergeUses = data.autoMergeUses || 0
      this.refreshOrdersUI(); this.refreshCoinsUI(); this.refreshCityVisualization()
    }
    this.checkOfflineBonus()
  }

  createTopBar() {
    this.add.rectangle(400, 30, 800, 60, 0x2c3e50).setDepth(0)
    this.topEnergyText = this.add.text(20, 30, '⚡ 0', { fontSize: '18px', fontFamily: 'Arial', color: '#4fc3f7', fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(1)
    this.comboCountText = this.add.text(20, 50, '', { fontSize: '10px', fontFamily: 'Arial', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(1)
    this.topCityText = this.add.text(400, 18, 'Деревня Солнечная', { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0.5).setDepth(1)
    this.topLevelText = this.add.text(400, 38, 'Уровень 1', { fontSize: '10px', fontFamily: 'Arial', color: '#888888' }).setOrigin(0.5, 0.5).setDepth(1)
    this.topCoinsText = this.add.text(700, 30, '🪙 100', { fontSize: '18px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(1)

    this.add.text(735, 18, '⬆️', { fontSize: '16px' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.showUpgrades())
    this.boostTimerText = this.add.text(735, 42, '', { fontSize: '8px', fontFamily: 'Arial', color: '#ff9800' }).setOrigin(0.5).setDepth(1)
    this.add.text(755, 30, '🚀', { fontSize: '16px' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.showBoosts())
    this.add.text(775, 30, '⚙️', { fontSize: '18px' }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.showSettings())
    this.sdkIndicator = this.add.text(775, 55, '⏳', { fontSize: '10px', color: '#ffaa00' }).setOrigin(0.5).setDepth(1)
  }

  refreshSdkIndicator() { this.sdkIndicator.setText(yandexManager.isReady() ? '✓' : '✗').setColor(yandexManager.isReady() ? '#4caf50' : '#ff4444') }

  refreshTopBarUI() {
    this.topEnergyText.setText(`⚡ ${this.energy}`)
    this.topCoinsText.setText(`🪙 ${this.coins}`)
    const level = Math.min(Math.floor(this.completedOrders / 3) + 1, 10)
    const cities = ['Деревня Солнечная', 'Посёлок Энергетик', 'Город Лучезарный', 'Мегаполис Гелиос']
    this.topCityText.setText(cities[Math.min(Math.floor(this.completedOrders / 5), cities.length - 1)])
    this.topLevelText.setText(`Уровень ${level}`)

    // Combo counter
    if (this.comboSystem && this.comboSystem.comboCount > 0) {
      this.comboCountText.setText(`🔥${this.comboSystem.comboCount}/3`)
    } else {
      this.comboCountText.setText('')
    }
  }

  refreshCoinsUI() { this.topCoinsText.setText(`🪙 ${this.coins}`); this.refreshShopButtons() }

  createLeftPanel() {
    const x = 15, y = 455, w = 160, h = 130
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.4).setStrokeStyle(1, 0x4a90e2, 0.2)
    this.cityTitle = this.add.text(x + w / 2, y + 8, 'Ваш город', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.cityBuilding = this.add.rectangle(x + w / 2, y + 42, 20, 20, 0x4a90e2).setStrokeStyle(1, 0x6ab0ff)
    this.cityOrdersText = this.add.text(x + w / 2, y + 65, 'Заказов: 0', { fontSize: '10px', color: '#aaaaaa' }).setOrigin(0.5, 0)
    this.cityLevelText = this.add.text(x + w / 2, y + 80, 'Уровень города: 1', { fontSize: '10px', color: '#ffd700' }).setOrigin(0.5, 0)
    this.add.rectangle(x + w / 2, y + 100, 140, 8, 0x333333, 0.8)
    this.progressFill = this.add.rectangle(x + w / 2 - 69, y + 100, 0, 6, 0x4caf50).setOrigin(0, 0.5)
    this.progressText = this.add.text(x + w / 2, y + 115, '0/3 до след. уровня', { fontSize: '8px', color: '#888888' }).setOrigin(0.5, 0)
    // Auto-merge button (visible at city level 10)
    this.autoMergeBtn = this.add.rectangle(x + w / 2, y + 145, 120, 24, 0x9b59b6, 0.9).setStrokeStyle(1, 0xbb8fce).setInteractive({ useHandCursor: true }).setDepth(1)
    this.autoMergeTxt = this.add.text(x + w / 2, y + 145, '🤖 Авто (0)', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1)
    this.autoMergeBtn.on('pointerdown', () => this.activateAutoMerge())
    this.refreshAutoMergeBtn()
  }

  refreshAutoMergeBtn() {
    const level = Math.min(Math.floor(this.completedOrders / 3) + 1, 10)
    if (level >= 10) {
      this.autoMergeBtn.setVisible(true); this.autoMergeTxt.setVisible(true)
      this.autoMergeTxt.setText(`🤖 Авто (${this.comboSystem.autoMergeUses})`)
    } else {
      this.autoMergeBtn.setVisible(false); this.autoMergeTxt.setVisible(false)
    }
  }

  activateAutoMerge() {
    if (this.comboSystem.autoMergeUses > 0) { this.comboSystem.tryAutoMerge(); this.refreshAutoMergeBtn(); this.saveGame(); return }
    yandexManager.showRewardedVideo(() => {
      this.comboSystem.autoMergeUses += 5
      this.toast.show('Авто-сбор активирован на 5 использований!', 'success')
      this.refreshAutoMergeBtn(); this.saveGame()
    })
  }

  refreshCityVisualization() {
    if (!this.cityBuilding) return
    const count = this.completedOrders
    let size = 20; if (count >= 16) size = 80; else if (count >= 6) size = 60; else if (count >= 1) size = 40
    this.cityBuilding.setSize(size, size)
    this.cityOrdersText.setText(`Заказов: ${count}`)
    const level = Math.min(Math.floor(count / 3) + 1, 10)
    this.cityLevelText.setText(`Уровень города: ${level}`)
    this.progressFill.setSize(((count % 3) / 3) * 138, 6)
    this.progressText.setText(`${count % 3}/3 до след. уровня`)
    this.refreshAutoMergeBtn()
  }

  drawGrid() {
    const g = this.add.graphics(); g.lineStyle(1, 0x888888, 0.2)
    for (let row = 0; row <= this.ROWS; row++) { const y = this.GRID_Y + row * this.CELL_SIZE; g.moveTo(this.GRID_X, y); g.lineTo(this.GRID_X + this.COLS * this.CELL_SIZE, y) }
    for (let col = 0; col <= this.COLS; col++) { const x = this.GRID_X + col * this.CELL_SIZE; g.moveTo(x, this.GRID_Y); g.lineTo(x, this.GRID_Y + this.ROWS * this.CELL_SIZE) }
    g.strokePath()
  }

  spawnStartingPanels() {
    let count = 0; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.gridCells[r][c].occupied) count++
    if (count > 0) return
    const p = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) p.push({ row: r, col: c })
    Phaser.Utils.Array.Shuffle(p)
    for (let i = 0; i < 3 && i < p.length; i++) this.spawnPanelAt(1, p[i].row, p[i].col)
  }

  spawnPanelAt(tier, row, col, type) {
    if (this.gridCells[row][col].occupied) return false
    const cell = this.gridCells[row][col]
    let panel
    if (type === 'golden') panel = new GoldenPanel(this, cell.x, cell.y, tier)
    else if (type === 'booster') panel = new BoosterPanel(this, cell.x, cell.y, tier)
    else if (type === 'piggy') panel = new PiggyBankPanel(this, cell.x, cell.y, tier)
    else panel = new Panel(this, cell.x, cell.y, tier)
    panel.setGridPos(row, col); cell.occupied = true; cell.panel = panel
    panel.setScale(0.5)
    this.tweens.add({ targets: panel, scale: 1, duration: 250, ease: 'Back.easeOut' })
    this.updateEnergy(); this.saveGame()
    return true
  }

  updateEnergy() {
    this.energy = 0
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) this.energy += this.gridCells[r][c].panel.getEffectivePower()
    this.refreshTopBarUI(); this.refreshOrdersUI()
  }

  collectEnergyParticles() {
    const t = this.topEnergyText; if (!t) return
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) {
        const p = this.gridCells[r][c].panel
        this.particles.flyTo(p.x, p.y - 10, t.x + 40, t.y, 0x4fc3f7, () => { this.tweens.add({ targets: t, scale: { from: 1, to: 1.2 }, duration: 100, yoyo: true, ease: 'Power2' }) })
        // Piggy bank savings
        if (p.isPiggy) { p.addSavings(p.getEffectivePower()) }
        return
      }
    }
  }

  createOrdersUI() {
    const x = 585, y = 65, w = 210, h = 380
    this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x000000, 0.4).setStrokeStyle(1, 0x4a90e2, 0.2)
    this.add.text(x + w / 2, y + 12, 'Заказы', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5, 0)
    this.ordersContainer = this.add.container(); this.ordersContainer.setPosition(x, y + 30)
  }

  refreshOrdersUI() {
    if (!this.ordersContainer) return; this.ordersContainer.removeAll(true)
    const orders = this.orderSystem.orders
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i], cy = 10 + i * 115, can = this.energy >= o.requiredEnergy
      this.add.rectangle(105, cy, 200, 105, 0x1a1a3e, 0.7).setStrokeStyle(1, can ? 0x4caf50 : 0x333333, 0.5)
      this.add.text(15, cy - 38, o.city, { fontSize: '12px', color: '#ffd700', fontStyle: 'bold' })
      this.add.text(15, cy - 18, `⚡ ${o.requiredEnergy}`, { fontSize: '11px', color: '#4fc3f7' })
      this.add.text(15, cy + 2, `🪙 ${o.rewardCoins}`, { fontSize: '11px', color: '#4caf50' })
      const btn = this.add.rectangle(170, cy + 30, 60, 24, can ? 0x4caf50 : 0x444444, 0.9).setStrokeStyle(1, can ? 0x66bb6a : 0x555555)
      this.add.text(170, cy + 30, 'Вып.', { fontSize: '10px', color: can ? '#ffffff' : '#666666' }).setOrigin(0.5)
      const x2Btn = this.add.rectangle(170, cy + 58, 48, 20, can ? 0xff9800 : 0x444444, 0.9).setStrokeStyle(1, can ? 0xffb74d : 0x555555)
      this.add.text(170, cy + 58, '▶ x2', { fontSize: '9px', color: can ? '#ffffff' : '#666666' }).setOrigin(0.5)
      if (can) {
        btn.setInteractive({ useHandCursor: true }); this.tweens.add({ targets: btn, scale: { from: 1, to: 1.05 }, duration: 1000, yoyo: true, repeat: -1 })
        btn.on('pointerdown', () => this.completeOrderAction(i, false))
        x2Btn.setInteractive({ useHandCursor: true }); this.tweens.add({ targets: x2Btn, scale: { from: 1, to: 1.05 }, duration: 800, yoyo: true, repeat: -1 })
        x2Btn.on('pointerdown', () => yandexManager.showRewardedVideo(() => this.completeOrderAction(i, true)))
      }
    }
  }

  completeOrderAction(index, doubled) {
    const result = this.orderSystem.completeOrder(index)
    if (!result) return
    const mult = doubled ? 2 : 1, reward = result.rewardCoins * mult
    this.particles.burst(585 + 105, 40 + index * 115, doubled ? 0xff9800 : 0x4caf50, 10, { speed: 60, size: 4 })
    const ft = this.add.text(585 + 105, 20 + index * 115, `+${reward} монет!`, { fontSize: '14px', color: doubled ? '#ff9800' : '#4caf50', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200)
    this.tweens.add({ targets: ft, y: ft.y - 40, alpha: 0, duration: 800, onComplete: () => ft.destroy() })
    for (let j = 0; j < (doubled ? 5 : 3); j++) this.time.delayedCall(j * 60, () => this.particles.flyTo(585 + 105, 40 + index * 115, this.topCoinsText.x + 10, this.topCoinsText.y, 0xffd700))
    this.coins += reward; this.completedOrders++
    if (doubled) this.orderSystem.totalRewardedAdsWatched++

    // 10% chance to spawn Piggy Bank
    if (Math.random() < 0.1) {
      const e = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) e.push({ row: r, col: c })
      if (e.length > 0) { const cell = Phaser.Math.RND.pick(e); this.spawnPanelAt(1, cell.row, cell.col, 'piggy'); this.toast.show('🐷 Появилась Копилка!', 'success') }
    }

    this.refreshCoinsUI(); this.refreshOrdersUI(); this.refreshCityVisualization(); this.refreshTopBarUI()
    if (this.orderSystem.shouldShowInterstitial()) yandexManager.showInterstitial()
    this.saveGame()
  }

  createShopBottom() {
    const y = 555
    this.add.rectangle(400, y, 800, 50, 0x000000, 0.5).setDepth(0)
    this.add.rectangle(200, y, 150, 34, 0x4a90e2, 0.9).setStrokeStyle(1, 0x6ab0ff).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.buyPanel(1, 50)).on('pointerover', function() { if (this.input.enabled) this.setFillStyle(0x5aa0f2) }).on('pointerout', function() { if (this.input.enabled) this.setFillStyle(0x4a90e2) })
    this.add.text(200, y, '🟦 T1 (50)', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1)
    this.add.rectangle(350, y, 150, 34, 0x4a90e2, 0.9).setStrokeStyle(1, 0x6ab0ff).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.buyPanel(2, 150)).on('pointerover', function() { if (this.input.enabled) this.setFillStyle(0x5aa0f2) }).on('pointerout', function() { if (this.input.enabled) this.setFillStyle(0x4a90e2) })
    this.add.text(350, y, '🟦 T2 (150)', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1)
    this.add.rectangle(500, y, 150, 34, 0x9b59b6, 0.9).setStrokeStyle(1, 0xbb8fce).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.buyPanel(0, 500, 'booster'))
    this.add.text(500, y, '🟣 Бустер (500)', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1)
    this.add.rectangle(660, y, 100, 34, 0xf39c12, 0.9).setStrokeStyle(1, 0xf5b842).setInteractive({ useHandCursor: true }).setDepth(1).on('pointerdown', () => this.toast.show('Бонус будет доступен каждые 24ч!', 'info'))
    this.add.text(660, y, '🎁 Бонус', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(1)
  }

  refreshShopButtons() {
    // UI is recreated each time in createShopBottom, so no refresh needed
  }

  buyPanel(tier, cost, type) {
    if (this.coins < cost) { this.toast.show('Недостаточно монет!', 'error'); return }
    const empty = []
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) empty.push({ row: r, col: c })
    if (empty.length === 0) { this.toast.show('Сетка заполнена!', 'error'); return }

    this.coins -= cost; this.refreshCoinsUI()
    const cell = Phaser.Math.RND.pick(empty)
    const pos = this.getCellCenter(cell.row, cell.col)

    // 5% chance for Golden Panel on normal purchase
    let panelType = type
    if (!panelType && Math.random() < 0.05) panelType = 'golden'

    const panel = panelType === 'golden' ? new GoldenPanel(this, pos.x, -50, tier) :
                  panelType === 'booster' ? new BoosterPanel(this, pos.x, -50, tier) :
                  new Panel(this, pos.x, -50, tier)
    panel.setGridPos(cell.row, cell.col); panel.setScale(0.7)
    this.gridCells[cell.row][cell.col].occupied = true; this.gridCells[cell.row][cell.col].panel = panel
    this.tweens.add({ targets: panel, y: pos.y, scale: 1, duration: 400, ease: 'Back.easeOut' })

    if (panelType === 'golden') this.toast.show('✨ Золотая панель! x5 энергии!', 'success')

    for (let j = 0; j < 3; j++) this.time.delayedCall(j * 100, () => this.particles.flyTo(this.topCoinsText.x + 10, this.topCoinsText.y, pos.x + Phaser.Math.Between(-15, 15), pos.y, 0xffd700))
    this.updateEnergy(); this.saveGame()
    if (!panelType) this.toast.show(`Куплена панель T${tier}!`, 'success')
  }

  getCellCenter(row, col) { return { x: this.GRID_X + col * this.CELL_SIZE + this.CELL_SIZE / 2, y: this.GRID_Y + row * this.CELL_SIZE + this.CELL_SIZE / 2 } }

  updateBoostTimer() {
    this.boostSystem.cleanExpired()
    const a = this.boostSystem.activeBoosts
    this.boostTimerText.setText(a.length > 0 ? `🕐${Math.max(...a.map(b => this.boostSystem.getRemainingSeconds(b.id)))}с` : '')
  }

  rebuildGrid() {
    const ns = this.upgradeSystem.getGridSize()
    if (ns === this.COLS && ns === this.ROWS) return
    const old = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) { old.push({ tier: this.gridCells[r][c].panel.tier }); this.gridCells[r][c].panel.destroy() }
    this.COLS = ns; this.ROWS = ns; this.gridCells = []
    for (let r = 0; r < this.ROWS; r++) { this.gridCells[r] = []; for (let c = 0; c < this.COLS; c++) { const cx = this.GRID_X + c * this.CELL_SIZE + this.CELL_SIZE / 2, cy = this.GRID_Y + r * this.CELL_SIZE + this.CELL_SIZE / 2; this.gridCells[r][c] = { x: cx, y: cy, occupied: false, panel: null } } }
    this.drawGrid()
    for (const p of old) { const e = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) e.push({ row: r, col: c }); if (e.length === 0) break; const cell = Phaser.Math.RND.pick(e); this.spawnPanelAt(p.tier, cell.row, cell.col) }
    this.toast.show(`Сетка расширена до ${ns}×${ns}!`, 'success')
  }

  resetEnergyTimer() { if (this.energyTimer) this.energyTimer.remove(); this.energyTimer = this.time.addEvent({ delay: this.upgradeSystem.getGenerationDelay(), loop: true, callback: () => this.collectEnergyParticles() }) }

  showUpgrades() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 380, 360, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xffd700, 0.8)
    this.add.text(0, -160, 'Апгрейды', { fontSize: '18px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5)
    Object.values(UPGRADES).forEach((def, i) => {
      const y = -120 + i * 60
      const level = this.upgradeSystem.getLevel(def.id), isMax = this.upgradeSystem.isMaxLevel(def.id), cost = this.upgradeSystem.getCost(def.id)
      this.add.rectangle(0, y, 350, 50, 0x000000, 0.4).setStrokeStyle(1, 0x4a90e2, 0.2)
      this.add.text(-160, y - 8, def.icon, { fontSize: '14px' }).setOrigin(0, 0.5)
      this.add.text(-140, y - 8, def.name, { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(-140, y + 10, `Ур. ${level}/${def.maxLevel}`, { fontSize: '10px', color: '#aaaaaa' }).setOrigin(0, 0.5)
      if (isMax) { this.add.rectangle(140, y, 60, 24, 0x555555, 0.9); this.add.text(140, y, 'MAX', { fontSize: '11px', color: '#888888', fontStyle: 'bold' }).setOrigin(0.5) }
      else {
        const can = this.coins >= cost
        const btn = this.add.rectangle(140, y, 80, 24, can ? 0x4caf50 : 0x444444, 0.9).setStrokeStyle(1, can ? 0x66bb6a : 0x555555)
        this.add.text(140, y, `${cost}🪙`, { fontSize: '11px', color: can ? '#ffffff' : '#666666' }).setOrigin(0.5)
        if (can) btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.upgradeSystem.buy(def.id); popup.destroy() })
      }
    })
    this.add.rectangle(0, 150, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 150, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  showBoosts() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 380, 320, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xff9800, 0.8)
    this.add.text(0, -140, 'Бусты', { fontSize: '18px', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0.5)
    BoostSystem.getAllBoosts().forEach((def, i) => {
      const y = -95 + i * 80, active = this.boostSystem.isActive(def.id)
      this.add.rectangle(0, y, 350, 70, active ? 0x2c3e50 : 0x000000, 0.5).setStrokeStyle(1, active ? 0xff9800 : 0x4a90e2, 0.3)
      this.add.text(-160, y - 18, def.icon, { fontSize: '16px' }).setOrigin(0, 0.5)
      this.add.text(-140, y - 18, def.name, { fontSize: '13px', color: active ? '#ff9800' : '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(-140, y + 4, def.desc, { fontSize: '10px', color: '#aaaaaa' }).setOrigin(0, 0.5)
      if (active) { this.add.text(0, y + 20, `Осталось: ${this.boostSystem.getRemainingSeconds(def.id)}с`, { fontSize: '11px', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0.5) }
      else {
        this.add.rectangle(-70, y + 20, 70, 22, 0xff9800, 0.9).setStrokeStyle(1, 0xffb74d).setInteractive({ useHandCursor: true }).on('pointerdown', () => yandexManager.showRewardedVideo(() => { this.boostSystem.activate(def.id, true); popup.destroy() }))
        this.add.text(-70, y + 20, 'Реклама', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
        const can = this.coins >= def.coinCost
        this.add.rectangle(70, y + 20, 70, 22, can ? 0x4caf50 : 0x444444, 0.9).setStrokeStyle(1, can ? 0x66bb6a : 0x555555)
        this.add.text(70, y + 20, `${def.coinCost}🪙`, { fontSize: '9px', color: can ? '#ffffff' : '#666666' }).setOrigin(0.5)
        if (can) this.add.rectangle(70, y + 20, 70, 22, 0x000000, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.boostSystem.activate(def.id); popup.destroy() })
      }
    })
    this.add.rectangle(0, 130, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 130, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  showSettings() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 300, 240, 0x1a1a3e, 0.95).setStrokeStyle(2, 0x4a90e2, 0.8)
    this.add.text(0, -95, 'Настройки', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(-100, -50, `Звуки: ${this.soundEnabled ? 'Вкл' : 'Выкл'}`, { fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5)
    const snd = this.add.rectangle(80, -50, 60, 24, this.soundEnabled ? 0x4caf50 : 0x555555, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.soundEnabled = !this.soundEnabled; snd.setFillStyle(this.soundEnabled ? 0x4caf50 : 0x555555) })
    this.add.text(-100, -10, `Музыка: ${this.musicEnabled ? 'Вкл' : 'Выкл'}`, { fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5)
    const msc = this.add.rectangle(80, -10, 60, 24, this.musicEnabled ? 0x4caf50 : 0x555555, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.musicEnabled = !this.musicEnabled; msc.setFillStyle(this.musicEnabled ? 0x4caf50 : 0x555555) })
    this.add.rectangle(0, 50, 160, 30, 0xff4444, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { CloudSaveManager.reset(); this.scene.restart() })
    this.add.text(0, 50, 'Сбросить прогресс', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(0, 90, 'Solar Merge v1.0', { fontSize: '11px', color: '#555555' }).setOrigin(0.5)
    this.add.rectangle(0, 120, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 120, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  async saveGame() {
    const panels = []
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      const p = this.gridCells[r][c].panel
      if (p) {
        let type = undefined
        if (p.isGolden) type = 'golden'; else if (p.isBooster) type = 'booster'; else if (p.isPiggy) type = 'piggy'
        panels.push({ row: r, col: c, tier: p.tier, type })
      }
    }
    this.lastSaveTime = Date.now()
    await CloudSaveManager.save({ panels, coins: this.coins, completedOrders: this.completedOrders, lastSaveTime: this.lastSaveTime, orders: this.orderSystem.orders, completedCount: this.orderSystem.completedCount, totalRewardedAdsWatched: this.orderSystem.totalRewardedAdsWatched, upgradeLevels: this.upgradeSystem.levels, activeBoosts: this.boostSystem.activeBoosts, autoMergeUses: this.comboSystem.autoMergeUses })
  }

  loadLocalGame() {
    const data = CloudSaveManager.loadLocalSnapshot()
    if (!data) { this.orderSystem.refillOrders(1); return }
    this.coins = data.coins || 100; this.completedOrders = data.completedOrders || 0; this.lastSaveTime = data.lastSaveTime || Date.now()
    this.orderSystem.completedCount = data.completedCount || 0; this.orderSystem.totalRewardedAdsWatched = data.totalRewardedAdsWatched || 0
    if (data.panels) for (const p of data.panels) if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col, p.type)
    if (data.orders && data.orders.length > 0) this.orderSystem.orders = data.orders; else this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    if (data.upgradeLevels) this.upgradeSystem.levels = data.upgradeLevels
    if (data.activeBoosts) this.boostSystem.activeBoosts = data.activeBoosts
    this.comboSystem.autoMergeUses = data.autoMergeUses || 0
  }

  checkOfflineBonus() {
    const now = Date.now(), elapsed = now - this.lastSaveTime, h = Math.floor(elapsed / (1000 * 60 * 60))
    if (h < 2) return
    const bonusEnergy = h * 10
    const cp = () => { bg.destroy(); t1.destroy(); t2.destroy(); ab.destroy(); at.destroy(); tb.destroy(); tt.destroy(); cb.destroy(); ct.destroy() }
    const gb = (m) => { if (cl) return; cl = true; const fe = bonusEnergy * m; const pa = Math.ceil(fe / 10); for (let i = 0; i < pa; i++) { const e = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) e.push({ row: r, col: c }); if (e.length === 0) break; const cell = Phaser.Math.RND.pick(e); this.spawnPanelAt(1, cell.row, cell.col) }; cp(); this.toast.show(`+${fe} энергии (офлайн)!`, 'success'); this.saveGame() }
    let cl = false
    const bg = this.add.rectangle(400, 300, 350, 160, 0x000000, 0.85).setDepth(200)
    const t1 = this.add.text(400, 240, `Вы отсутствовали ${h} ч.`, { fontSize: '16px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201)
    const t2 = this.add.text(400, 265, `Бонус: ${bonusEnergy} энергии!`, { fontSize: '14px', color: '#4fc3f7' }).setOrigin(0.5).setDepth(201)
    const ab = this.add.rectangle(400, 310, 220, 30, 0xff9800, 0.9).setStrokeStyle(1, 0xffb74d).setInteractive({ useHandCursor: true }).setDepth(202)
    const at = this.add.text(400, 310, 'Реклама → x3 бонус', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    const tb = this.add.rectangle(300, 355, 100, 26, 0x4caf50, 0.9).setStrokeStyle(1, 0x66bb6a).setInteractive({ useHandCursor: true }).setDepth(202)
    const tt = this.add.text(300, 355, 'Забрать', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    const cb = this.add.rectangle(500, 355, 100, 26, 0x888888, 0.9).setInteractive({ useHandCursor: true }).setDepth(202)
    const ct = this.add.text(500, 355, 'Закрыть', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    ab.on('pointerdown', () => yandexManager.showRewardedVideo(() => gb(3)))
    tb.on('pointerdown', () => gb(1)); cb.on('pointerdown', cp)
  }

  onPointerDown(ptr) {
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      const cell = this.gridCells[r][c]
      if (!cell.occupied || !cell.panel) continue
      const p = cell.panel
      if (Math.abs(ptr.x - p.x) <= 32 && Math.abs(ptr.y - p.y) <= 32) {
        this.draggedPanel = p; this.dragOffsetX = ptr.x - p.x; this.dragOffsetY = ptr.y - p.y
        cell.occupied = false; cell.panel = null; p.setDepth(100); return
      }
    }
  }

  onPointerMove(ptr) { if (this.draggedPanel) this.draggedPanel.setPanelPosition(ptr.x - this.dragOffsetX, ptr.y - this.dragOffsetY) }

  onPointerUp(ptr) {
    if (!this.draggedPanel) return
    const panel = this.draggedPanel; this.draggedPanel = null; panel.setDepth(1)
    let md = Infinity, tr = -1, tc = -1
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { const d = (panel.x - this.gridCells[r][c].x) ** 2 + (panel.y - this.gridCells[r][c].y) ** 2; if (d < md) { md = d; tr = r; tc = c } }
    if (tr === -1 || tc === -1) { this.returnToOriginalCell(panel); return }
    const tc2 = this.gridCells[tr][tc]
    if (tc2.occupied && tc2.panel) {
      const tp = tc2.panel
      // Special panel merge logic
      if (tp.isGolden && panel.isGolden) { this.returnToOriginalCell(panel); return } // golden + golden = no
      if (tp.isBooster) { this.mergeSpecial(panel, tp, tr, tc, 3); return }
      if (panel.isBooster) { this.mergeSpecial(tp, panel, tr, tc, 3); return }
      if (tp.isPiggy) { this.mergePiggy(panel, tp, tr, tc); return }
      if (panel.isPiggy) { this.mergePiggy(tp, panel, tr, tc); return }
      if (tp.tier === panel.tier && panel.tier < 10) {
        // Golden + normal same tier = tier+2
        if (tp.isGolden || panel.isGolden) { this.mergeSpecial(panel, tp, tr, tc, 2); return }
        this.merge(panel, tp, tr, tc)
      } else { this.returnToOriginalCell(panel) }
    } else {
      panel.setGridPos(tr, tc); tc2.occupied = true; tc2.panel = panel
      this.tweens.add({ targets: panel, x: tc2.x, y: tc2.y, duration: 150, ease: 'Power2' })
    }
  }

  returnToOriginalCell(panel) {
    const r = panel.gridX, c = panel.gridY
    if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && !this.gridCells[r][c].occupied) {
      const cell = this.gridCells[r][c]; cell.occupied = true; cell.panel = panel
      this.tweens.add({ targets: panel, x: cell.x, y: cell.y, duration: 150, ease: 'Power2' })
    } else panel.destroy()
  }

  mergeSpecial(p1, p2, row, col, tierBonus) {
    const cell = this.gridCells[row][col]
    const newTier = Math.min(p1.tier + tierBonus, 10)
    const tx = cell.x, ty = cell.y

    this.tweens.add({ targets: p1, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p1.destroy() })
    this.tweens.add({ targets: p2, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p2.destroy() })

    this.time.delayedCall(180, () => {
      this.particles.flash(tx, ty)
      this.particles.burst(tx, ty, 0xffd700, 12, { speed: 100, size: 6 })
    })

    this.time.delayedCall(200, () => {
      const np = new Panel(this, tx, ty, newTier)
      np.setGridPos(row, col); cell.occupied = true; cell.panel = np
      np.setScale(0)
      this.tweens.add({ targets: np, scale: { from: 0, to: 1.2 }, duration: 250, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: np, scale: 1, duration: 100 }) })
      this.toast.show(`Специальное слияние! T${newTier}!`, 'success')
      this.updateEnergy(); this.saveGame()
    })
  }

  mergePiggy(p1, piggy, row, col) {
    if (p1.tier < 5) { this.returnToOriginalCell(p1); return }
    const cell = this.gridCells[row][col]
    const coins = piggy.savedCoins || 0

    this.toast.show(`🐷 Копилка отдала ${coins} монет!`, 'success')
    this.coins += coins

    this.tweens.add({ targets: p1, x: cell.x, y: cell.y, scale: 0, duration: 200, onComplete: () => p1.destroy() })
    this.tweens.add({ targets: piggy, scale: 1.5, alpha: 0, duration: 300, onComplete: () => piggy.destroy() })

    this.time.delayedCall(200, () => {
      this.particles.flash(cell.x, cell.y)
      this.particles.burst(cell.x, cell.y, 0xff69b4, 16, { speed: 80, size: 5 })
      cell.occupied = false; cell.panel = null
      this.updateEnergy(); this.refreshCoinsUI(); this.saveGame()
    })
  }

  merge(p1, p2, row, col) {
    const cell = this.gridCells[row][col]
    let newTier = p1.tier + 1
    const tx = cell.x, ty = cell.y

    // Critical merge check
    if (p1.tier <= 5 && this.comboSystem.checkCritical()) {
      newTier = Math.min(p1.tier + 2, 10)
    }

    // Upgrade luck check
    const luck = this.upgradeSystem.getMergeLuckChance()
    if (p1.tier <= 5 && Math.random() < luck) {
      newTier = Math.min(p1.tier + 2, 10)
      this.toast.show('🍀 Удачное слияние!', 'success')
    }

    this.tweens.add({ targets: p1, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p1.destroy() })
    this.tweens.add({ targets: p2, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p2.destroy() })

    this.time.delayedCall(180, () => {
      this.particles.flash(tx, ty)
      this.particles.burst(tx, ty, 0xffd700, 8, { speed: 80, size: 6 })
    })

    this.time.delayedCall(200, () => {
      const np = new Panel(this, tx, ty, newTier)
      np.setGridPos(row, col); cell.occupied = true; cell.panel = np
      np.setScale(0)
      this.tweens.add({ targets: np, scale: { from: 0, to: 1.2 }, duration: 250, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: np, scale: 1, duration: 100 }) })
      this.updateEnergy(); this.saveGame()
    })

    this.comboSystem.onMerge()
  }
}
