import yandexManager from './YandexManager.js'

const EVENT_STORAGE_KEY = 'solar_merge_analytics'
const FIRST_LAUNCH_KEY = 'solar_merge_first_launch'

export default class Analytics {
  constructor() {
    this.sessionStart = Date.now()
    this.firstLaunchDate = this.getFirstLaunchDate()
    this.retentionTracked = false
  }

  getFirstLaunchDate() {
    try {
      const d = localStorage.getItem(FIRST_LAUNCH_KEY)
      if (d) return parseInt(d, 10)
      localStorage.setItem(FIRST_LAUNCH_KEY, String(Date.now()))
      return Date.now()
    } catch (e) { return Date.now() }
  }

  trackEvent(eventName, eventData = {}) {
    eventData.timestamp = Date.now()
    eventData.sessionAge = Date.now() - this.sessionStart

    // Send to Yandex SDK if available
    if (yandexManager.isReady()) {
      try {
        const ysdk = yandexManager.ysdk
        if (ysdk.features && ysdk.features.LoggingAPI) {
          ysdk.features.LoggingAPI.logEvent(eventName, eventData)
        }
      } catch (e) {
        console.warn('Analytics SDK error:', e)
      }
    }

    // Fallback: store in localStorage
    try {
      const raw = localStorage.getItem(EVENT_STORAGE_KEY)
      const events = raw ? JSON.parse(raw) : []
      events.push({ name: eventName, data: eventData })
      // Keep last 500 events
      if (events.length > 500) events.splice(0, events.length - 500)
      localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events))
    } catch (e) { /* ignore */ }

    // Console log in dev
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[Analytics] ${eventName}:`, eventData)
    }
  }

  trackRetention() {
    if (this.retentionTracked) return
    this.retentionTracked = true

    const now = Date.now()
    const diffDays = Math.floor((now - this.firstLaunchDate) / (1000 * 60 * 60 * 24))

    if (diffDays >= 30) this.trackEvent('retention_d30', { daysSinceFirstLaunch: diffDays })
    else if (diffDays >= 7) this.trackEvent('retention_d7', { daysSinceFirstLaunch: diffDays })
    else if (diffDays >= 1) this.trackEvent('retention_d1', { daysSinceFirstLaunch: diffDays })
  }

  trackSessionEnd() {
    const duration = Math.floor((Date.now() - this.sessionStart) / 1000)
    this.trackEvent('session_duration', { durationInSeconds: duration })
  }

  gameStart() {
    this.trackEvent('game_start', {})
    this.trackRetention()
  }

  merge(tier1, tier2, resultTier) {
    this.trackEvent('merge', { tier1, tier2, resultTier })
  }

  orderComplete(city, energy, coins) {
    this.trackEvent('order_complete', { city, energy, coins })
  }

  shopPurchase(item, cost) {
    this.trackEvent('shop_purchase', { item, cost })
  }

  adWatched(type, reward) {
    this.trackEvent('ad_watched', { type, reward })
  }

  achievementUnlocked(achievementId) {
    this.trackEvent('achievement_unlocked', { achievementId })
  }

  dailyRewardClaimed(day) {
    this.trackEvent('daily_reward_claimed', { day })
  }
}

export const analytics = new Analytics()
