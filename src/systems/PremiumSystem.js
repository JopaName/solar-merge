export default class PremiumSystem {
  constructor(scene) {
    this.scene = scene
    this.isPremium = false
    this.adsWatchedForPremium = 0
    this.ADS_NEEDED = 5
  }

  watchAdForPremium() {
    if (this.isPremium) return false
    this.adsWatchedForPremium++
    if (this.adsWatchedForPremium >= this.ADS_NEEDED) {
      this.isPremium = true
      this.scene.toast.show('🎉 Премиум разблокирован! +50% ко всем наградам!', 'success')
      this.scene.saveGame()
    }
    return true
  }

  hasNoAds() {
    return this.isPremium
  }

  getRewardMultiplier() {
    return this.isPremium ? 1.5 : 1
  }

  getProgress() {
    return Math.min(this.adsWatchedForPremium, this.ADS_NEEDED)
  }
}
