import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'
import { setupErrorHandler } from './utils/errorHandler.js'

setupErrorHandler()

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [BootScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: { width: 320, height: 480 },
    max: { width: 1920, height: 1080 },
  },
  input: {
    activePointers: 3,
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: true,
  },
}

const game = new Phaser.Game(config)

// FPS counter (dev only)
if (process.env.NODE_ENV !== 'production') {
  const fpsEl = document.createElement('div')
  fpsEl.style.cssText = 'position:fixed;bottom:10px;right:10px;color:#4fc3f7;font-size:12px;font-family:monospace;z-index:9999;background:rgba(0,0,0,0.5);padding:4px 8px;border-radius:4px'
  fpsEl.textContent = 'FPS: --'
  document.body.appendChild(fpsEl)

  setInterval(() => {
    fpsEl.textContent = `FPS: ${Math.round(game.loop.actualFps)}`
  }, 1000)
}

// Prevent default touchmove to avoid scroll
document.addEventListener('touchmove', (e) => {
  if (e.target.closest('#game')) e.preventDefault()
}, { passive: false })
