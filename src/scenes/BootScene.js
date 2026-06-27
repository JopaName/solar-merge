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
import DailyRewards from '../systems/DailyRewards.js'
import AchievementSystem from '../systems/AchievementSystem.js'
import LotterySystem from '../systems/LotterySystem.js'
import PremiumSystem from '../systems/PremiumSystem.js'
import { analytics } from '../utils/Analytics.js'

export default class BootScene extends Phaser.Scene {
  constructor() { super('BootScene') }

  preload() {
    const w = 800, h = 600
    this.add.rectangle(w / 2, h / 2 + 40, 200, 16, 0x333333).setDepth(100)
    const barFill = this.add.rectangle(w / 2 - 98, h / 2 + 40, 0, 12, 0x4fc3f7).setOrigin(0, 0.5).setDepth(101)
    const loadText = this.add.text(w / 2, h / 2, 'Загрузка...', { fontSize: '14px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5).setDepth(101)
    this.load.on('progress', (v) => { barFill.setSize(196 * v, 12); loadText.setText(`Загрузка: ${Math.floor(v * 100)}%`) })
    this.load.on('loaderror', (f) => console.warn(`Fallback: ${f.key}`))
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
    this.dailyRewards = new DailyRewards(this)
    this.achievementSystem = new AchievementSystem(this)
    this.lotterySystem = new LotterySystem(this)
    this.premiumSystem = new PremiumSystem(this)
    this.freePanelTimer = 0; this.lastEnergyBoostTime = 0
    this.dailyAdBonusClaimed = false; this.lastDailyBonusDate = null
    this.tutorial = new Tutorial(this)

    // Grid — fixed 5x5, 80px cells, centered in the middle
    this.COLS = 5; this.ROWS = 5; this.CELL_SIZE = 80
    this.GRID_X = 220; this.GRID_Y = 100
    this.gridCells = []
    for (let r = 0; r < this.ROWS; r++) {
      this.gridCells[r] = []
      for (let c = 0; c < this.COLS; c++) {
        const cx = this.GRID_X + c * this.CELL_SIZE + this.CELL_SIZE / 2
        const cy = this.GRID_Y + r * this.CELL_SIZE + this.CELL_SIZE / 2
        this.gridCells[r][c] = { x: cx, y: cy, occupied: false, panel: null }
      }
    }

    this.buildUI()
    this.loadLocalGame()
    if (this.orderSystem.orders.length === 0) this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    this.refreshOrdersUI(); this.refreshCityVisualization(); this.refreshTopBarUI()

    this.draggedPanel = null; this.dragOffsetX = 0; this.dragOffsetY = 0
    this.input.on('pointerdown', (p) => this.onPointerDown(p))
    this.input.on('pointermove', (p) => this.onPointerMove(p))
    this.input.on('pointerup', (p) => this.onPointerUp(p))
    this.spawnStartingPanels(); this.initSdkAndCloud()

    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.collectEnergyParticles() })
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.updateBoostTimer() })
    this.time.addEvent({ delay: 30000, loop: true, callback: () => this.comboSystem.tryAutoMerge() })
    this.time.addEvent({ delay: 2000, loop: true, callback: () => this.checkGridFull() })
    this.time.addEvent({ delay: 500, loop: true, callback: () => { if (this._needsUiRefresh) { this._needsUiRefresh = false; this.refreshTopBarUI() } } })
    this.time.delayedCall(500, () => this.tutorial.start())
    analytics.gameStart()
    window.addEventListener('beforeunload', () => analytics.trackSessionEnd())
  }

  /* ─── UI LAYOUT ─── */

  buildUI() {
    // Top bar: y=0, h=60
    this.add.rectangle(400, 30, 800, 60, 0x2c3e50, 0.9).setDepth(10)
    this.add.rectangle(340, 30, 1, 30, 0xffffff, 0.3).setDepth(10)
    this.add.rectangle(550, 30, 1, 30, 0xffffff, 0.3).setDepth(10)
    this.topEnergyText = this.add.text(50, 30, '⚡ 0', { fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0, 0.5).setDepth(11)
    this.topCityText = this.add.text(400, 30, 'Деревня Солнечная', { fontSize: '24px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(11)
    this.topCoinsText = this.add.text(650, 30, '🪙 100', { fontSize: '20px', fontFamily: 'Arial', color: '#27ae60', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0, 0.5).setDepth(11)
    this.add.rectangle(770, 30, 40, 40, 0x34495e, 0.9).setStrokeStyle(2, 0x555555).setInteractive({ useHandCursor: true }).setDepth(11).on('pointerdown', () => this.showSettings())
    this.add.text(770, 30, '⚙️', { fontSize: '22px' }).setOrigin(0.5).setDepth(12)
    this.sdkIndicator = this.add.text(790, 8, '⏳', { fontSize: '10px', color: '#ffaa00' }).setOrigin(1, 0).setDepth(11)

    // Left panel: x=0, y=60, w=180, h=460
    this.add.rectangle(0, 290, 180, 460, 0x34495e, 0.8).setOrigin(0, 0.5).setDepth(10)
    this.add.text(90, 80, 'Ваш город', { fontSize: '18px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(11)

    this.cityBuilding = this.add.rectangle(90, 150, 20, 20, 0x4a90e2).setStrokeStyle(2, 0x6ab0ff).setDepth(11)
    this.cityLevelText = this.add.text(90, 215, 'Уровень: 1', { fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 1 }).setOrigin(0.5).setDepth(11)

    this.add.rectangle(100, 255, 140, 20, 0x555555).setOrigin(0.5).setDepth(11)
    this.progressFill = this.add.rectangle(30, 255, 0, 18, 0x4a90e2).setOrigin(0, 0.5).setDepth(12)
    this.progressText = this.add.text(90, 255, '0/3', { fontSize: '12px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(13)

    this.statPanels = this.add.text(20, 300, 'Панелей: 0', { fontSize: '14px', fontFamily: 'Arial', color: '#cccccc' }).setDepth(11)
    this.statOrders = this.add.text(20, 325, 'Заказов: 0', { fontSize: '14px', fontFamily: 'Arial', color: '#cccccc' }).setDepth(11)
    this.statTime = this.add.text(20, 350, 'Время: 0 мин', { fontSize: '14px', fontFamily: 'Arial', color: '#cccccc' }).setDepth(11)
    this.statTier = this.add.text(20, 375, 'Макс. Tier: 1', { fontSize: '14px', fontFamily: 'Arial', color: '#cccccc' }).setDepth(11)

    // Grid background
    this.gridBg = this.add.rectangle(400, 300, 440, 440, 0x000000, 0.3).setDepth(0)
    this.drawGrid()

    // Right panel: x=580, y=60, w=220, h=460
    this.add.rectangle(690, 290, 220, 460, 0x34495e, 0.8).setOrigin(0.5).setDepth(10)
    this.add.text(690, 80, 'Заказы', { fontSize: '20px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5).setDepth(11)
    this.ordersContainer = this.add.container(0, 0).setDepth(11)

    // Bottom bar: y=520, h=80
    this.add.rectangle(400, 560, 800, 80, 0x2c3e50, 0.9).setDepth(10)
    this.add.text(100, 540, 'Магазин', { fontSize: '16px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000', strokeThickness: 1 }).setOrigin(0.5).setDepth(11)

    const btnStyle = { radius: 8 }
    this.createButton(50, 565, 100, 40, 0x3498db, () => this.buyPanel(1, 50), 'T1 (50)', '14px')
    this.createButton(160, 565, 100, 40, 0x3498db, () => this.buyPanel(2, 150), 'T2 (150)', '14px')
    this.createButton(345, 560, 110, 50, 0x9b59b6, () => this.showBoosts(), '🚀 Бусты', '14px')
    this.createButton(490, 560, 110, 50, 0xe74c3c, () => this.showUpgrades(), '⬆️ Апгрейды', '14px')
    this.createButton(650, 560, 50, 50, 0xf39c12, () => this.showAchievements(), '🏆', '16px')
    this.createButton(710, 560, 50, 50, 0xff9800, () => this.showDailyRewards(), '🎁', '16px')

    // Lottery in bottom-right
    this.createButton(770, 560, 50, 50, 0xe67e22, () => this.showLottery(), '🎰', '16px')
  }

  createButton(x, y, w, h, color, cb, label, fs) {
    const btn = this.add.rectangle(x, y, w, h, color, 0.9).setStrokeStyle(2, 0xffffff, 0.2).setInteractive({ useHandCursor: true }).setDepth(11)
    const txt = this.add.text(x, y, label, { fontSize: fs, fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12)
    btn.on('pointerover', () => btn.setAlpha(0.8))
    btn.on('pointerout', () => btn.setAlpha(1))
    btn.on('pointerdown', () => { btn.setScale(0.95); txt.setScale(0.95) })
    btn.on('pointerup', () => { btn.setScale(1); txt.setScale(1); cb() })
    btn.on('pointerout', () => { btn.setScale(1); txt.setScale(1) })
    return { btn, txt }
  }

  refreshTopBarUI() {
    this.topEnergyText.setText(`⚡ ${this.energy}`)
    this.topCoinsText.setText(`🪙 ${this.coins}`)
    const lvl = Math.min(Math.floor(this.completedOrders / 3) + 1, 10)
    const cities = ['Деревня Солнечная', 'Посёлок Энергетик', 'Город Лучезарный', 'Мегаполис Гелиос']
    this.topCityText.setText(cities[Math.min(Math.floor(this.completedOrders / 5), cities.length - 1)])

    // Stats
    let pc = 0, mt = 0
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) { pc++; mt = Math.max(mt, this.gridCells[r][c].panel.tier) }
    }
    this.statPanels.setText(`Панелей: ${pc}`)
    this.statOrders.setText(`Заказов: ${this.completedOrders}`)
    this.statTime.setText(`Время: ${Math.floor((Date.now() - this.lastSaveTime) / 60000)} мин`)
    this.statTier.setText(`Макс. Tier: ${mt}`)
  }

  refreshCoinsUI() { this.topCoinsText.setText(`🪙 ${this.coins}`); this._needsUiRefresh = true }

  // Grid full indicator
  checkGridFull() {
    let full = true
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) { full = false; break }
    this.gridBg.setStrokeStyle(full ? 3 : 0, 0xe74c3c, full ? 0.5 : 0)
  }

  /* ─── GRID ─── */
  drawGrid() {
    const g = this.add.graphics().setDepth(1)
    g.lineStyle(1, 0x888888, 0.5)
    for (let r = 0; r <= this.ROWS; r++) { const y = this.GRID_Y + r * this.CELL_SIZE; g.moveTo(this.GRID_X, y); g.lineTo(this.GRID_X + this.COLS * this.CELL_SIZE, y) }
    for (let c = 0; c <= this.COLS; c++) { const x = this.GRID_X + c * this.CELL_SIZE; g.moveTo(x, this.GRID_Y); g.lineTo(x, this.GRID_Y + this.ROWS * this.CELL_SIZE) }
    g.strokePath()
  }

  getCellCenter(r, c) { return { x: this.GRID_X + c * this.CELL_SIZE + this.CELL_SIZE / 2, y: this.GRID_Y + r * this.CELL_SIZE + this.CELL_SIZE / 2 } }

  spawnPanelAt(tier, r, c, type) {
    if (this.gridCells[r][c].occupied) return false
    const cell = this.gridCells[r][c]
    let panel
    if (type === 'golden') panel = new GoldenPanel(this, cell.x, cell.y, tier)
    else if (type === 'booster') panel = new BoosterPanel(this, cell.x, cell.y, tier)
    else if (type === 'piggy') panel = new PiggyBankPanel(this, cell.x, cell.y, tier)
    else panel = new Panel(this, cell.x, cell.y, tier)
    panel.setGridPos(r, c); cell.occupied = true; cell.panel = panel
    panel.setScale(0.5).setDepth(2)
    this.tweens.add({ targets: panel, scale: 1, duration: 250, ease: 'Back.easeOut' })
    this.updateEnergy(); this.saveGame()
    return true
  }

  spawnStartingPanels() {
    let cnt = 0; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.gridCells[r][c].occupied) cnt++
    if (cnt > 0) return
    const p = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) p.push({ r, c })
    Phaser.Utils.Array.Shuffle(p)
    for (let i = 0; i < 3 && i < p.length; i++) this.spawnPanelAt(1, p[i].r, p[i].c)
  }

  updateEnergy() {
    this.energy = 0
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) this.energy += this.gridCells[r][c].panel.getEffectivePower()
    this._needsUiRefresh = true; this.refreshOrdersUI()
    this.achievementSystem.addProgress('first_energy', this.energy)
    this.achievementSystem.addProgress('energy_mid', this.energy)
    this.achievementSystem.addProgress('energy_master', this.energy)
  }

  /* ─── ORDERS ─── */
  refreshOrdersUI() {
    if (!this.ordersContainer) return
    this.ordersContainer.removeAll(true)
    const orders = this.orderSystem.orders
    for (let i = 0; i < orders.length; i++) {
      const o = orders[i], cy = 110 + i * 130, can = this.energy >= o.requiredEnergy
      const bg = this.add.rectangle(590 + 100, cy, 200, 120, 0x2c3e50, 0.9).setStrokeStyle(1, can ? 0x27ae60 : 0x555555).setDepth(11)
      this.add.text(690, cy - 40, o.city, { fontSize: '16px', fontFamily: 'Arial', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 1 }).setOrigin(0.5).setDepth(12)
      this.add.text(690, cy - 15, `⚡ ${o.requiredEnergy}`, { fontSize: '14px', fontFamily: 'Arial', color: '#ffffff' }).setOrigin(0.5).setDepth(12)
      this.add.text(690, cy + 5, `🪙 ${o.rewardCoins}`, { fontSize: '14px', fontFamily: 'Arial', color: '#27ae60' }).setOrigin(0.5).setDepth(12)

      const btn = this.add.rectangle(645, cy + 35, 80, 30, can ? 0x27ae60 : 0x555555, 0.9).setStrokeStyle(1, can ? 0x2ecc71 : 0x777777).setDepth(12)
      this.add.text(645, cy + 35, 'Вып.', { fontSize: '14px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(13)

      const x2 = this.add.rectangle(735, cy + 35, 50, 30, can ? 0xe67e22 : 0x555555, 0.9).setStrokeStyle(1, can ? 0xf39c12 : 0x777777).setDepth(12)
      this.add.text(735, cy + 35, 'x2', { fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(13)

      if (can) {
        btn.setInteractive({ useHandCursor: true })
        btn.on('pointerover', () => btn.setAlpha(0.8))
        btn.on('pointerout', () => btn.setAlpha(1))
        btn.on('pointerdown', () => this.completeOrderAction(i, false))
        x2.setInteractive({ useHandCursor: true })
        x2.on('pointerover', () => x2.setAlpha(0.8))
        x2.on('pointerout', () => x2.setAlpha(1))
        x2.on('pointerdown', () => yandexManager.showRewardedVideo(() => this.completeOrderAction(i, true)))
      }
    }
  }

  completeOrderAction(idx, doubled) {
    const result = this.orderSystem.completeOrder(idx)
    if (!result) return
    const mult = doubled ? 2 : 1, rw = result.rewardCoins * mult
    this.particles.burst(690, 110 + idx * 130, doubled ? 0xff9800 : 0x4caf50, 5, { speed: 50, size: 4 })
    const ft = this.add.text(690, 70 + idx * 130, `+${rw} 🪙`, { fontSize: '16px', color: doubled ? '#ff9800' : '#4caf50', fontStyle: 'bold', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(200)
    this.tweens.add({ targets: ft, y: ft.y - 30, alpha: 0, duration: 800, onComplete: () => ft.destroy() })
    this.coins += rw; this.completedOrders++
    if (doubled) this.orderSystem.totalRewardedAdsWatched++
    analytics.orderComplete(result.city, result.requiredEnergy, rw)
    if (Math.random() < 0.1) { const e = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) e.push({ r, c }); if (e.length) { const cel = Phaser.Math.RND.pick(e); this.spawnPanelAt(1, cel.r, cel.c, 'piggy'); this.toast.show('🐷 Появилась Копилка!', 'success') } }
    this.refreshCoinsUI(); this.refreshOrdersUI(); this.refreshCityVisualization()
    if (this.orderSystem.shouldShowInterstitial()) yandexManager.showInterstitial(this.premiumSystem.hasNoAds())
    this.achievementSystem.addProgress('first_order'); this.achievementSystem.addProgress('orders_mid'); this.achievementSystem.addProgress('orders_master')
    if (doubled) this.achievementSystem.addProgress('generous')
    this.saveGame()
  }

  refreshCityVisualization() {
    if (!this.cityBuilding) return
    const cnt = this.completedOrders
    let sz = 20; if (cnt >= 16) sz = 80; else if (cnt >= 6) sz = 60; else if (cnt >= 1) sz = 40
    this.cityBuilding.setSize(sz, sz)
    const lvl = Math.min(Math.floor(cnt / 3) + 1, 10)
    this.cityLevelText.setText(`Уровень: ${lvl}`)
    this.progressFill.setSize(((cnt % 3) / 3) * 138, 18)
    this.progressText.setText(`${cnt % 3}/3`)
    this.achievementSystem.checkCityLevel()
  }

  buyPanel(tier, cost, type) {
    if (this.coins < cost) { this.toast.show('Недостаточно монет!', 'error'); return }
    const empty = []
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) empty.push({ r, c })
    if (!empty.length) { this.toast.show('Сетка заполнена!', 'error'); return }
    this.coins -= cost; this.refreshCoinsUI()
    const cell = Phaser.Math.RND.pick(empty), pos = this.getCellCenter(cell.r, cell.c)
    let pt = type; if (!pt && Math.random() < 0.05) pt = 'golden'
    const panel = pt === 'golden' ? new GoldenPanel(this, pos.x, -50, tier) : pt === 'booster' ? new BoosterPanel(this, pos.x, -50, tier) : new Panel(this, pos.x, -50, tier)
    panel.setGridPos(cell.r, cell.c); panel.setScale(0.7).setDepth(2)
    this.gridCells[cell.r][cell.c].occupied = true; this.gridCells[cell.r][cell.c].panel = panel
    this.tweens.add({ targets: panel, y: pos.y, scale: 1, duration: 400, ease: 'Back.easeOut' })
    analytics.shopPurchase(pt || `panel_t${tier}`, cost)
    if (pt === 'golden') this.toast.show('✨ Золотая панель! x5 энергии!', 'success')
    this.updateEnergy(); this.saveGame(); if (!pt) this.toast.show(`Куплена T${tier}!`, 'success')
  }

  /* ─── DRAG ─── */
  onPointerDown(ptr) {
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      const cell = this.gridCells[r][c]; if (!cell.occupied || !cell.panel) continue
      const p = cell.panel; const dx = ptr.x - p.x, dy = ptr.y - p.y
      if (Math.abs(dx) <= 32 && Math.abs(dy) <= 32) {
        this.draggedPanel = p; this.dragOffsetX = dx; this.dragOffsetY = dy
        cell.occupied = false; cell.panel = null; p.setDepth(100); return
      }
    }
  }

  onPointerMove(ptr) { if (this.draggedPanel) this.draggedPanel.setPanelPosition(ptr.x - this.dragOffsetX, ptr.y - this.dragOffsetY) }

  onPointerUp(ptr) {
    if (!this.draggedPanel) return
    const panel = this.draggedPanel; this.draggedPanel = null; panel.setDepth(2)
    let md = Infinity, tr = -1, tc = -1
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { const d = (panel.x - this.gridCells[r][c].x) ** 2 + (panel.y - this.gridCells[r][c].y) ** 2; if (d < md) { md = d; tr = r; tc = c } }
    if (tr < 0 || tc < 0 || md > 3200) { this.returnToOrigin(panel); return }
    const tc2 = this.gridCells[tr][tc]
    if (tc2.occupied && tc2.panel) {
      const tp = tc2.panel
      if (tp.isGolden && panel.isGolden) { this.returnToOrigin(panel); return }
      if (tp.isBooster) { this.mergeSpecial(panel, tp, tr, tc, 3); return }
      if (panel.isBooster) { this.mergeSpecial(tp, panel, tr, tc, 3); return }
      if (tp.isPiggy) { this.mergePiggy(panel, tp, tr, tc); return }
      if (panel.isPiggy) { this.mergePiggy(tp, panel, tr, tc); return }
      if (tp.tier === panel.tier && panel.tier < 10) {
        if (tp.isGolden || panel.isGolden) { this.mergeSpecial(panel, tp, tr, tc, 2); return }
        this.merge(panel, tp, tr, tc)
      } else { this.returnToOrigin(panel) }
    } else { panel.setGridPos(tr, tc); tc2.occupied = true; tc2.panel = panel; this.tweens.add({ targets: panel, x: tc2.x, y: tc2.y, duration: 150 }) }
  }

  returnToOrigin(p) {
    const r = p.gridX, c = p.gridY
    if (r >= 0 && r < this.ROWS && c >= 0 && c < this.COLS && !this.gridCells[r][c].occupied) {
      const cell = this.gridCells[r][c]; cell.occupied = true; cell.panel = p
      this.tweens.add({ targets: p, x: cell.x, y: cell.y, duration: 150 })
    } else p.destroy()
  }

  mergeSpecial(p1, p2, r, c, bonus) {
    const cell = this.gridCells[r][c], nt = Math.min(p1.tier + bonus, 10), tx = cell.x, ty = cell.y
    this.tweens.add({ targets: p1, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p1.destroy() })
    this.tweens.add({ targets: p2, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p2.destroy() })
    this.time.delayedCall(180, () => { this.particles.flash(tx, ty); this.particles.burst(tx, ty, 0xffd700, 5, { speed: 60, size: 4 }) })
    this.time.delayedCall(200, () => {
      const np = new Panel(this, tx, ty, nt); np.setGridPos(r, c); cell.occupied = true; cell.panel = np; np.setScale(0).setDepth(2)
      this.tweens.add({ targets: np, scale: { from: 0, to: 1.2 }, duration: 250, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: np, scale: 1, duration: 100 }) })
      this.toast.show(`Спец. слияние! T${nt}!`, 'success'); this.updateEnergy(); this.saveGame()
    })
  }

  mergePiggy(p1, piggy, r, c) {
    if (p1.tier < 5) { this.returnToOrigin(p1); return }
    const cell = this.gridCells[r][c], coins = piggy.savedCoins || 0
    this.toast.show(`🐷 Копилка: +${coins} 🪙`, 'success'); this.coins += coins
    this.tweens.add({ targets: p1, x: cell.x, y: cell.y, scale: 0, duration: 200, onComplete: () => p1.destroy() })
    this.tweens.add({ targets: piggy, scale: 1.5, alpha: 0, duration: 300, onComplete: () => piggy.destroy() })
    this.time.delayedCall(200, () => { this.particles.flash(cell.x, cell.y); this.particles.burst(cell.x, cell.y, 0xff69b4, 8, { speed: 50, size: 4 }); cell.occupied = false; cell.panel = null; this.updateEnergy(); this.refreshCoinsUI(); this.saveGame() })
  }

  merge(p1, p2, r, c) {
    const cell = this.gridCells[r][c]; let nt = p1.tier + 1; const tx = cell.x, ty = cell.y
    analytics.merge(p1.tier, p2.tier, nt)
    if (p1.tier <= 5 && this.comboSystem.checkCritical()) nt = Math.min(p1.tier + 2, 10)
    const luck = this.upgradeSystem.getMergeLuckChance()
    if (p1.tier <= 5 && Math.random() < luck) { nt = Math.min(p1.tier + 2, 10); this.toast.show('🍀 Удачное слияние!', 'success') }
    this.tweens.add({ targets: p1, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p1.destroy() })
    this.tweens.add({ targets: p2, x: tx, y: ty, scale: 0, duration: 200, onComplete: () => p2.destroy() })
    this.time.delayedCall(180, () => { this.particles.flash(tx, ty); this.particles.burst(tx, ty, 0xffd700, 5, { speed: 60, size: 4 }) })
    this.time.delayedCall(200, () => {
      const np = new Panel(this, tx, ty, nt); np.setGridPos(r, c); cell.occupied = true; cell.panel = np; np.setScale(0).setDepth(2)
      this.tweens.add({ targets: np, scale: { from: 0, to: 1.2 }, duration: 250, ease: 'Back.easeOut', onComplete: () => this.tweens.add({ targets: np, scale: 1, duration: 100 }) })
      this.updateEnergy(); this.saveGame()
    })
    this.comboSystem.onMerge()
    this.achievementSystem.addProgress('first_merge'); this.achievementSystem.addProgress('merge_master'); this.achievementSystem.addProgress('merge_legend')
  }

  collectEnergyParticles() {
    const t = this.topEnergyText; if (!t) return
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      if (this.gridCells[r][c].occupied && this.gridCells[r][c].panel) {
        const p = this.gridCells[r][c].panel
        this.particles.flyTo(p.x, p.y - 10, t.x + 40, t.y, 0xf39c12, () => { this.tweens.add({ targets: t, scale: { from: 1, to: 1.2 }, duration: 100, yoyo: true }) })
        if (p.isPiggy) p.addSavings(p.getEffectivePower()); return
      }
    }
  }

  /* ─── BOOST / UPGRADE / SETTINGS / ACHIEVEMENTS / LOTTERY ─── */
  updateBoostTimer() {
    this.boostSystem.cleanExpired()
    const a = this.boostSystem.activeBoosts
    // Not shown in top bar anymore — left for hook
  }

  rebuildGrid() {
    const ns = this.upgradeSystem.getGridSize()
    if (ns === this.COLS) return
    const old = []
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { if (this.gridCells[r][c].panel) { old.push({ tier: this.gridCells[r][c].panel.tier, type: null }); this.gridCells[r][c].panel.destroy() } }
    this.COLS = ns; this.ROWS = ns; this.gridCells = []
    for (let r = 0; r < this.ROWS; r++) { this.gridCells[r] = []; for (let c = 0; c < this.COLS; c++) { const cx = this.GRID_X + c * this.CELL_SIZE + this.CELL_SIZE / 2, cy = this.GRID_Y + r * this.CELL_SIZE + this.CELL_SIZE / 2; this.gridCells[r][c] = { x: cx, y: cy, occupied: false, panel: null } } }
    this.drawGrid(); for (const p of old) { const e = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) e.push({ r, c }); if (!e.length) break; const cel = Phaser.Math.RND.pick(e); this.spawnPanelAt(p.tier, cel.r, cel.c, p.type) }
    this.toast.show(`Сетка расширена до ${ns}×${ns}!`, 'success')
  }

  showUpgrades() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 380, 360, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xffd700, 0.8)
    this.add.text(0, -160, 'Апгрейды', { fontSize: '18px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 2 }).setOrigin(0.5)
    Object.values(UPGRADES).forEach((d, i) => {
      const y = -120 + i * 60, lvl = this.upgradeSystem.getLevel(d.id), mx = this.upgradeSystem.isMaxLevel(d.id), cost = this.upgradeSystem.getCost(d.id)
      this.add.rectangle(0, y, 350, 50, 0x000000, 0.4).setStrokeStyle(1, 0x4a90e2, 0.2)
      this.add.text(-160, y - 8, d.icon, { fontSize: '14px' }).setOrigin(0, 0.5)
      this.add.text(-140, y - 8, d.name, { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(-140, y + 10, `Ур. ${lvl}/${d.maxLevel}`, { fontSize: '10px', color: '#aaaaaa' }).setOrigin(0, 0.5)
      if (mx) { this.add.rectangle(140, y, 60, 24, 0x555555, 0.9); this.add.text(140, y, 'MAX', { fontSize: '11px', color: '#888888', fontStyle: 'bold' }).setOrigin(0.5) }
      else {
        const can = this.coins >= cost
        const btn = this.add.rectangle(140, y, 80, 24, can ? 0x4caf50 : 0x444444, 0.9).setStrokeStyle(1, can ? 0x66bb6a : 0x555555)
        this.add.text(140, y, `${cost}🪙`, { fontSize: '11px', color: can ? '#ffffff' : '#666666' }).setOrigin(0.5)
        if (can) btn.setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.upgradeSystem.buy(d.id); popup.destroy() })
      }
    })
    this.add.rectangle(0, 150, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 150, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  showBoosts() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 380, 320, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xff9800, 0.8)
    this.add.text(0, -140, 'Бусты', { fontSize: '18px', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0.5)
    BoostSystem.getAllBoosts().forEach((d, i) => {
      const y = -95 + i * 80, act = this.boostSystem.isActive(d.id)
      this.add.rectangle(0, y, 350, 70, act ? 0x2c3e50 : 0x000000, 0.5).setStrokeStyle(1, act ? 0xff9800 : 0x4a90e2, 0.3)
      this.add.text(-160, y - 18, d.icon, { fontSize: '16px' }).setOrigin(0, 0.5)
      this.add.text(-140, y - 18, d.name, { fontSize: '13px', color: act ? '#ff9800' : '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)
      this.add.text(-140, y + 4, d.desc, { fontSize: '10px', color: '#aaaaaa' }).setOrigin(0, 0.5)
      if (act) this.add.text(0, y + 20, `Осталось: ${this.boostSystem.getRemainingSeconds(d.id)}с`, { fontSize: '11px', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0.5)
      else {
        this.add.rectangle(-70, y + 20, 70, 22, 0xff9800, 0.9).setStrokeStyle(1, 0xffb74d).setInteractive({ useHandCursor: true }).on('pointerdown', () => yandexManager.showRewardedVideo(() => { this.boostSystem.activate(d.id, true); popup.destroy() }))
        this.add.text(-70, y + 20, 'Реклама', { fontSize: '9px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
        const can = this.coins >= d.coinCost
        this.add.rectangle(70, y + 20, 70, 22, can ? 0x4caf50 : 0x444444, 0.9).setStrokeStyle(1, can ? 0x66bb6a : 0x555555)
        this.add.text(70, y + 20, `${d.coinCost}🪙`, { fontSize: '9px', color: can ? '#ffffff' : '#666666' }).setOrigin(0.5)
        if (can) this.add.rectangle(70, y + 20, 70, 22, 0x000000, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.boostSystem.activate(d.id); popup.destroy() })
      }
    })
    this.add.rectangle(0, 130, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 130, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  showDailyRewards() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 460, 390, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xffd700, 0.8)
    this.add.text(0, -170, 'Ежедневные награды', { fontSize: '16px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5)
    const days = DailyRewards.getAllDays(), claimed = this.dailyRewards.claimedDays, can = this.dailyRewards.canClaim(), cur = this.dailyRewards.getCurrentDayIndex() + 1
    for (let i = 0; i < Math.min(days.length, 30); i++) {
      const d = days[i], col = i % 7, row2 = Math.floor(i / 7), cx = -150 + col * 42, cy2 = -130 + row2 * 52
      const isCl = claimed.includes(d.day), isCur = d.day === cur && can
      this.add.rectangle(cx, cy2, 38, 46, isCl ? 0x2c3e50 : isCur ? 0x4caf50 : 0x333333, 0.9).setStrokeStyle(1, isCur ? 0x66bb6a : 0x555555)
      this.add.text(cx, cy2 - 10, d.icon, { fontSize: '14px' }).setOrigin(0.5)
      this.add.text(cx, cy2 + 10, `${d.day}`, { fontSize: '9px', color: isCur ? '#ffffff' : isCl ? '#666666' : '#aaaaaa' }).setOrigin(0.5)
      if (isCl) this.add.text(cx, cy2, '✓', { fontSize: '16px', color: '#4caf50', fontStyle: 'bold' }).setOrigin(0.5)
    }
    if (can) {
      const dd = this.dailyRewards.getCurrentDayData()
      this.add.text(0, 80, `День ${cur}: ${dd.desc}`, { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5)
      this.add.rectangle(-60, 110, 100, 28, 0x4caf50, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { const r = this.dailyRewards.claim(false); if (r) { this.toast.show(`+${r.description}!`, 'success'); this.refreshCoinsUI(); this.saveGame(); popup.destroy() } })
      this.add.text(-60, 110, 'Забрать', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
      this.add.rectangle(60, 110, 120, 28, 0xff9800, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => yandexManager.showRewardedVideo(() => { const r = this.dailyRewards.claim(true); if (r) { this.toast.show(`x2: ${r.description}!`, 'success'); this.refreshCoinsUI(); this.saveGame(); popup.destroy() } }))
      this.add.text(60, 110, 'x2 за рекл.', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    } else { this.add.text(0, 80, 'Награда уже получена!', { fontSize: '12px', color: '#888888' }).setOrigin(0.5); this.add.text(0, 100, `День ${cur}/30`, { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5) }
    this.add.rectangle(0, 150, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 150, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  showAchievements() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 460, 390, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xffd700, 0.8)
    this.add.text(0, -175, 'Достижения', { fontSize: '16px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5)
    const cats = [{ id: 'merge', name: 'Слияние', icon: '🔀' }, { id: 'energy', name: 'Энергия', icon: '⚡' }, { id: 'orders', name: 'Заказы', icon: '📋' }, { id: 'city', name: 'Город', icon: '🏘️' }]
    let active = 'merge'
    const render = (cat) => {
      const items = popup.list.filter(o => o._isAch); items.forEach(o => o.destroy())
      this.achievementSystem.getByCategory(cat).forEach((a, i) => {
        const y = -140 + i * 58, prog = this.achievementSystem.getProgress(a.id), un = this.achievementSystem.isUnlocked(a.id)
        const bg = this.add.rectangle(0, y, 420, 50, un ? 0x2c3e50 : 0x000000, 0.4).setStrokeStyle(1, prog >= a.target ? 0x4caf50 : 0x4a90e2, 0.2); bg._isAch = true
        this.add.text(-200, y - 8, a.icon, { fontSize: '14px' }).setOrigin(0, 0.5)._isAch = true
        this.add.text(-180, y - 8, a.name, { fontSize: '12px', color: un ? '#888888' : '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5)._isAch = true
        this.add.text(-180, y + 10, a.desc, { fontSize: '10px', color: '#aaaaaa' }).setOrigin(0, 0.5)._isAch = true
        if (un) this.add.text(180, y, '✓', { fontSize: '18px', color: '#4caf50', fontStyle: 'bold' }).setOrigin(0.5)._isAch = true
        else { const pct = Math.min(prog / a.target, 1); this.add.text(170, y, `${Math.floor(pct * 100)}%`, { fontSize: '11px', color: '#aaaaaa' }).setOrigin(0.5)._isAch = true; this.add.rectangle(180, y + 16, 60, 4, 0x333333, 0.8)._isAch = true; this.add.rectangle(150 + 30 * pct, y + 16, 60 * pct, 4, 0x4caf50).setOrigin(0, 0.5)._isAch = true }
      })
    }
    cats.forEach((c, i) => {
      const cx = -150 + i * 90
      this.add.rectangle(cx, -155, 80, 24, active === c.id ? 0x4a90e2 : 0x333333, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { active = c.id; render(c.id) })
      this.add.text(cx, -155, `${c.icon} ${c.name}`, { fontSize: '9px', color: '#ffffff' }).setOrigin(0.5)
    })
    render(active)
    this.add.rectangle(0, 160, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 160, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  showAchievementPopup(def) {
    const bg = this.add.rectangle(400, 300, 350, 140, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xffd700, 0.8).setDepth(300)
    const t1 = this.add.text(400, 260, '🏆 Достижение!', { fontSize: '16px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setDepth(301)
    const t2 = this.add.text(400, 285, `${def.icon} ${def.name}`, { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setDepth(301)
    let rs = ''; if (def.reward.coins) rs += `${def.reward.coins}🪙 `; if (def.reward.golden) rs += `${def.reward.golden}✨ `; if (def.reward.boost) rs += `Буст `
    const t3 = this.add.text(400, 310, `+${rs}`, { fontSize: '12px', color: '#4caf50' }).setOrigin(0.5).setDepth(301)
    const cl = this.add.rectangle(400, 340, 100, 24, 0x4caf50, 0.9).setInteractive({ useHandCursor: true }).setDepth(301)
    this.add.text(400, 340, 'OK', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(302)
    cl.on('pointerdown', () => { bg.destroy(); t1.destroy(); t2.destroy(); t3.destroy(); cl.destroy() })
  }

  showLottery() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 300, 270, 0x1a1a3e, 0.95).setStrokeStyle(2, 0xff9800, 0.8)
    this.add.text(0, -110, '🎰 Лотерея', { fontSize: '18px', color: '#ff9800', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(0, -80, 'Крути и выигрывай!', { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0.5)
    this.lotteryPopupText = this.add.text(0, -30, 'Нажми "Крутить"', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    const spinAd = this.add.rectangle(-60, 20, 110, 30, 0xff9800, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.lotterySystem.canSpin()) { this.toast.show('Подождите 5 мин!', 'info'); return } yandexManager.showRewardedVideo(() => this.lotterySystem.spinAnimation(() => { const pr = this.lotterySystem.spin(); if (pr) { this.lotteryPopupText.setText(`🎉 ${pr.icon} ${pr.name}!`); this.toast.show(`Лотерея: ${pr.name}!`, 'success') } })) })
    this.add.text(-60, 20, '📺 Крутить', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    const spinCoin = this.add.rectangle(60, 20, 110, 30, 0x4caf50, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (!this.lotterySystem.canSpin()) { this.toast.show('Подождите 5 мин!', 'info'); return } if (this.coins < 100) { this.toast.show('Недостаточно 🪙!', 'error'); return } this.coins -= 100; this.refreshCoinsUI(); this.lotterySystem.spinAnimation(() => { const pr = this.lotterySystem.spin(); if (pr) { this.lotteryPopupText.setText(`🎉 ${pr.icon} ${pr.name}!`); this.toast.show(`Лотерея: ${pr.name}!`, 'success') } }) })
    this.add.text(60, 20, '100🪙', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.lotteryCooldownTxt = this.add.text(0, 65, '', { fontSize: '10px', color: '#888888' }).setOrigin(0.5)
    LotterySystem.getPrizes().forEach((p, i) => this.add.text(-120, 85 + i * 16, `${p.icon} ${p.name} (${p.weight}%)`, { fontSize: '9px', color: '#aaaaaa' }).setOrigin(0, 0.5))
    this.add.rectangle(0, 125, 80, 24, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 125, 'Закрыть', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    const upd = () => { const r = this.lotterySystem.getRemainingSeconds(); if (this.lotteryCooldownTxt) this.lotteryCooldownTxt.setText(r > 0 ? `Кулдаун: ${Math.floor(r / 60)}м ${r % 60}с` : 'Готово!') }
    upd(); const cdi = setInterval(() => { if (this.lotteryCooldownTxt) upd(); else clearInterval(cdi) }, 1000)
  }

  showSettings() {
    const popup = this.add.container(400, 300).setDepth(300)
    this.add.rectangle(0, 0, 300, 240, 0x1a1a3e, 0.95).setStrokeStyle(2, 0x4a90e2, 0.8)
    this.add.text(0, -95, 'Настройки', { fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(-100, -50, `Звуки: ${this.soundEnabled ? 'Вкл' : 'Выкл'}`, { fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5)
    const snd = this.add.rectangle(80, -50, 60, 24, this.soundEnabled ? 0x4caf50 : 0x555555, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.soundEnabled = !this.soundEnabled; snd.setFillStyle(this.soundEnabled ? 0x4caf50 : 0x555555) })
    this.add.text(-100, -10, `Музыка: ${this.musicEnabled ? 'Вкл' : 'Выкл'}`, { fontSize: '13px', color: '#ffffff' }).setOrigin(0, 0.5)
    const msc = this.add.rectangle(80, -10, 60, 24, this.musicEnabled ? 0x4caf50 : 0x555555, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.musicEnabled = !this.musicEnabled; msc.setFillStyle(this.musicEnabled ? 0x4caf50 : 0x555555) })
    if (this.premiumSystem.isPremium) this.add.text(0, 50, '👑 Премиум активен', { fontSize: '13px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5)
    else {
      this.add.text(0, 40, `Премиум: ${this.premiumSystem.getProgress()}/5`, { fontSize: '12px', color: '#aaaaaa' }).setOrigin(0.5)
      this.add.rectangle(0, 65, 180, 24, 0xffd700, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => yandexManager.showRewardedVideo(() => { this.premiumSystem.watchAdForPremium(); this.toast.show(`${this.premiumSystem.getProgress()}/5`, 'info'); this.saveGame() }))
      this.add.text(0, 65, '👑 Смотреть рекламу', { fontSize: '10px', color: '#333', fontStyle: 'bold' }).setOrigin(0.5)
    }
    this.add.rectangle(0, 95, 160, 26, 0xff4444, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => { CloudSaveManager.reset(); this.scene.restart() })
    this.add.text(0, 95, 'Сбросить прогресс', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
    this.add.text(0, 130, 'Solar Merge v1.0', { fontSize: '11px', color: '#555555' }).setOrigin(0.5)
    this.add.rectangle(0, 120, 100, 28, 0x4a90e2, 0.9).setInteractive({ useHandCursor: true }).on('pointerdown', () => popup.destroy())
    this.add.text(0, 120, 'Закрыть', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5)
  }

  /* ─── SAVE / LOAD ─── */
  async saveGame() {
    const panels = []
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { const p = this.gridCells[r][c].panel; if (p) { let t; if (p.isGolden) t = 'golden'; else if (p.isBooster) t = 'booster'; else if (p.isPiggy) t = 'piggy'; panels.push({ row: r, col: c, tier: p.tier, type: t }) } }
    this.lastSaveTime = Date.now()
    await CloudSaveManager.save({ panels, coins: this.coins, completedOrders: this.completedOrders, lastSaveTime: this.lastSaveTime, orders: this.orderSystem.orders, completedCount: this.orderSystem.completedCount, totalRewardedAdsWatched: this.orderSystem.totalRewardedAdsWatched, upgradeLevels: this.upgradeSystem.levels, activeBoosts: this.boostSystem.activeBoosts, autoMergeUses: this.comboSystem.autoMergeUses, dailyClaimedDays: this.dailyRewards.claimedDays, dailyLastClaimDate: this.dailyRewards.lastClaimDate, dailyCurrentDay: this.dailyRewards.currentDay, achievementProgress: this.achievementSystem.progress, unlockedAchievements: this.achievementSystem.unlocked, premiumActive: this.premiumSystem.isPremium, premiumAdsWatched: this.premiumSystem.adsWatchedForPremium, lastFreePanelTime: this.freePanelTimer, dailyAdBonusClaimed: this.dailyAdBonusClaimed, lastDailyBonusDate: this.lastDailyBonusDate })
  }

  loadLocalGame() {
    const d = CloudSaveManager.loadLocalSnapshot()
    if (!d) { this.orderSystem.refillOrders(1); return }
    this.coins = d.coins || 100; this.completedOrders = d.completedOrders || 0; this.lastSaveTime = d.lastSaveTime || Date.now()
    this.orderSystem.completedCount = d.completedCount || 0; this.orderSystem.totalRewardedAdsWatched = d.totalRewardedAdsWatched || 0
    if (d.panels) for (const p of d.panels) if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col, p.type)
    if (d.orders && d.orders.length > 0) this.orderSystem.orders = d.orders; else this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
    if (d.upgradeLevels) this.upgradeSystem.levels = d.upgradeLevels; if (d.activeBoosts) this.boostSystem.activeBoosts = d.activeBoosts
    this.comboSystem.autoMergeUses = d.autoMergeUses || 0
    if (d.dailyClaimedDays) this.dailyRewards.claimedDays = d.dailyClaimedDays; if (d.dailyLastClaimDate) this.dailyRewards.lastClaimDate = d.dailyLastClaimDate; if (d.dailyCurrentDay) this.dailyRewards.currentDay = d.dailyCurrentDay
    if (d.achievementProgress) this.achievementSystem.progress = d.achievementProgress; if (d.unlockedAchievements) this.achievementSystem.unlocked = d.unlockedAchievements
    if (d.premiumActive) this.premiumSystem.isPremium = d.premiumActive; if (d.premiumAdsWatched) this.premiumSystem.adsWatchedForPremium = d.premiumAdsWatched
    this.freePanelTimer = d.lastFreePanelTime || 0; this.dailyAdBonusClaimed = d.dailyAdBonusClaimed || false; this.lastDailyBonusDate = d.lastDailyBonusDate || null
    this.achievementSystem.refreshAll()
  }

  async initSdkAndCloud() {
    await yandexManager.init(); this.sdkIndicator.setText(yandexManager.isReady() ? '✓' : '✗').setColor(yandexManager.isReady() ? '#4caf50' : '#ff4444')
    const d = await CloudSaveManager.load()
    if (d) {
      this.coins = d.coins || 100; this.completedOrders = d.completedOrders || 0; this.lastSaveTime = d.lastSaveTime || Date.now()
      this.orderSystem.completedCount = d.completedCount || 0; this.orderSystem.totalRewardedAdsWatched = d.totalRewardedAdsWatched || 0
      if (d.panels) { for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) { if (this.gridCells[r][c].panel) { this.gridCells[r][c].panel.destroy(); this.gridCells[r][c].panel = null; this.gridCells[r][c].occupied = false } } for (const p of d.panels) if (p.row >= 0 && p.row < this.ROWS && p.col >= 0 && p.col < this.COLS) this.spawnPanelAt(p.tier, p.row, p.col, p.type) }
      if (d.orders && d.orders.length > 0) this.orderSystem.orders = d.orders; else this.orderSystem.refillOrders(this.orderSystem.getMaxPanelTier())
      if (d.upgradeLevels) this.upgradeSystem.levels = d.upgradeLevels; if (d.activeBoosts) this.boostSystem.activeBoosts = d.activeBoosts
      this.comboSystem.autoMergeUses = d.autoMergeUses || 0
      if (d.dailyClaimedDays) this.dailyRewards.claimedDays = d.dailyClaimedDays; if (d.dailyLastClaimDate) this.dailyRewards.lastClaimDate = d.dailyLastClaimDate; if (d.dailyCurrentDay) this.dailyRewards.currentDay = d.dailyCurrentDay
      if (d.achievementProgress) this.achievementSystem.progress = d.achievementProgress; if (d.unlockedAchievements) this.achievementSystem.unlocked = d.unlockedAchievements
      if (d.premiumActive) this.premiumSystem.isPremium = d.premiumActive; if (d.premiumAdsWatched) this.premiumSystem.adsWatchedForPremium = d.premiumAdsWatched
      this.freePanelTimer = d.lastFreePanelTime || 0; this.dailyAdBonusClaimed = d.dailyAdBonusClaimed || false; this.lastDailyBonusDate = d.lastDailyBonusDate || null
      this.refreshOrdersUI(); this.refreshCoinsUI(); this.refreshCityVisualization()
    }
    this.checkOfflineBonus()
  }

  checkOfflineBonus() {
    const now = Date.now(), elapsed = now - this.lastSaveTime, h = Math.floor(elapsed / (1000 * 60 * 60))
    if (h < 2) return
    const bonusEnergy = h * 10
    const cp = () => { bg.destroy(); t1.destroy(); t2.destroy(); ab.destroy(); at.destroy(); tb.destroy(); tt.destroy(); cb.destroy(); ct.destroy() }
    const gb = (m) => { if (cl) return; cl = true; const fe = bonusEnergy * m; const pa = Math.ceil(fe / 10); for (let i = 0; i < pa; i++) { const e = []; for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) if (!this.gridCells[r][c].occupied) e.push({ r, c }); if (e.length === 0) break; const cel = Phaser.Math.RND.pick(e); this.spawnPanelAt(1, cel.r, cel.c) }; cp(); this.toast.show(`+${fe} энергии (офлайн)!`, 'success'); this.saveGame() }
    let cl = false
    const bg = this.add.rectangle(400, 300, 350, 160, 0x000000, 0.85).setDepth(200)
    const t1 = this.add.text(400, 240, `Вы отсутствовали ${h} ч.`, { fontSize: '16px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5).setDepth(201)
    const t2 = this.add.text(400, 265, `Бонус: ${bonusEnergy} энергии!`, { fontSize: '14px', color: '#4fc3f7' }).setOrigin(0.5).setDepth(201)
    const ab = this.add.rectangle(400, 310, 220, 30, 0xff9800, 0.9).setStrokeStyle(1, 0xffb74d).setInteractive({ useHandCursor: true }).setDepth(202)
    this.add.text(400, 310, 'Реклама → x3', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    const tb = this.add.rectangle(300, 355, 100, 26, 0x4caf50, 0.9).setInteractive({ useHandCursor: true }).setDepth(202)
    this.add.text(300, 355, 'Забрать', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    const cb = this.add.rectangle(500, 355, 100, 26, 0x888888, 0.9).setInteractive({ useHandCursor: true }).setDepth(202)
    this.add.text(500, 355, 'Закрыть', { fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setDepth(203)
    ab.on('pointerdown', () => yandexManager.showRewardedVideo(() => gb(3)))
    tb.on('pointerdown', () => gb(1)); cb.on('pointerdown', cp)
  }
}
