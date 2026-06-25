const STORAGE_KEY = 'solar_merge_save'

export default class SaveManager {
  static save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.warn('Save failed:', e)
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.warn('Load failed:', e)
      return null
    }
  }

  static reset() {
    localStorage.removeItem(STORAGE_KEY)
  }
}
