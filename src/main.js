import Phaser from 'phaser'
import BootScene from './scenes/BootScene.js'

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#1a1a2e',
  scene: [BootScene],
}

new Phaser.Game(config)
