import yandexManager from './YandexManager.js'

const STORAGE_KEY = 'solar_merge_save'

/** 
 * Менеджер сохранений с облаком (Яндекс) + fallback на localStorage
 * Все методы статические
 */
export default class CloudSaveManager {

  /** Сохранить данные: сначала облако, при ошибке → localStorage */
  static async save(data) {
    data.lastSaveTime = Date.now()

    // Всегда пишем в localStorage как fallback
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('LocalStorage save failed:', e)
    }

    // Пробуем облако
    const cloudOk = await yandexManager.saveData(data)
    return cloudOk
  }

  /** Загрузить данные: сначала облако, при ошибке → localStorage */
  static async load() {
    // Пробуем облако
    if (yandexManager.isReady()) {
      const cloudData = await yandexManager.loadData()
      if (cloudData) {
        // Синхронизируем localStorage с облаком
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData))
        } catch (e) { /* ignore */ }
        return cloudData
      }
    }

    // Fallback на localStorage
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.warn('LocalStorage load failed:', e)
      return null
    }
  }

  /** Быстрая загрузка без облака (для начального рендера до инита SDK) */
  static loadLocalSnapshot() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      return null
    }
  }

  /** Очистить сохранения */
  static reset() {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) { /* ignore */ }
  }
}
