/** Управление Yandex Games SDK */
class YandexSdkManager {
  constructor() {
    this.ysdk = null
    this.player = null
    this.ready = false
    this.initPromise = null
    this.lastInterstitialTime = -Infinity
    this.GAME_START_TIME = Date.now()
  }

  /** Инициализация SDK */
  async init() {
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve) => {
      try {
        if (typeof YaGames === 'undefined') {
          console.log('Yandex SDK not found, running in local mode')
          this.ready = false
          resolve(false)
          return
        }

        YaGames.init()
          .then((ysdk) => {
            this.ysdk = ysdk
            return ysdk.getPlayer({ signed: true })
          })
          .then((player) => {
            this.player = player
            this.ready = true
            console.log('Yandex SDK initialized')
            resolve(true)
          })
          .catch((err) => {
            console.warn('Yandex SDK init error:', err)
            this.ready = false
            resolve(false)
          })
      } catch (e) {
        console.warn('Yandex SDK load error:', e)
        this.ready = false
        resolve(false)
      }
    })

    return this.initPromise
  }

  isReady() {
    return this.ready && this.ysdk !== null
  }

  /** Сохранение в облако */
  async saveData(data) {
    if (!this.isReady() || !this.player) {
      return false
    }
    try {
      await this.player.setData(data)
      return true
    } catch (e) {
      console.warn('Cloud save error:', e)
      return false
    }
  }

  /** Загрузка из облака */
  async loadData() {
    if (!this.isReady() || !this.player) {
      return null
    }
    try {
      const data = await this.player.getData()
      return data || null
    } catch (e) {
      console.warn('Cloud load error:', e)
      return null
    }
  }

  /** Показать rewarded video */
  async showRewardedVideo(rewardCallback) {
    if (!this.isReady()) {
      console.log('Local mode: instant reward')
      if (rewardCallback) rewardCallback()
      return true
    }

    try {
      const adv = this.ysdk.adv
      await adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => {
            console.log('Rewarded ad completed')
            if (rewardCallback) rewardCallback()
          },
          onClose: () => {
            console.log('Rewarded ad closed')
          },
          onError: (err) => {
            console.warn('Rewarded ad error:', err)
          },
        },
      })
      return true
    } catch (e) {
      console.warn('Rewarded video error:', e)
      // fallback — даём награду при ошибке (для теста)
      if (rewardCallback) rewardCallback()
      return false
    }
  }

  /** Показать interstitial (не чаще 1 раза в 90 сек, не раньше 60 сек после старта) */
  async showInterstitial() {
    const now = Date.now()
    if (now - this.GAME_START_TIME < 60000) {
      console.log('Interstitial: too early (first 60s)')
      return false
    }
    if (now - this.lastInterstitialTime < 90000) {
      console.log('Interstitial: too frequent')
      return false
    }

    if (!this.isReady()) {
      console.log('Interstitial: SDK not ready')
      return false
    }

    try {
      await this.ysdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => {
            this.lastInterstitialTime = Date.now()
            console.log('Interstitial closed')
          },
          onError: (err) => {
            console.warn('Interstitial error:', err)
          },
        },
      })
      return true
    } catch (e) {
      console.warn('Interstitial error:', e)
      return false
    }
  }

  /** Поделиться */
  async share() {
    if (!this.isReady()) {
      return false
    }
    try {
      await this.ysdk.gameplayAPI.share({
        text: 'Сыграй в Solar Merge! Сливайте панели, развивайте город!',
      })
      return true
    } catch (e) {
      console.warn('Share error:', e)
      return false
    }
  }

  /** Получить getStorage (альтернативное облачное хранилище) */
  getStorage() {
    if (!this.isReady()) return null
    try {
      return this.ysdk.getStorage()
    } catch (e) {
      return null
    }
  }
}

const yandexManager = new YandexSdkManager()
export default yandexManager
