import { defineStore } from 'pinia'

export const usePreferencesStore = defineStore('preferences', {
  state: () => ({
    preferredLanguages: ['en'] as string[],
    preferredSubtitleLanguages: ['en'] as string[],
    preferredQuality: '1080p' as string,
    autoPlay: true,
    showAllLanguages: false,
  }),

  actions: {
    setLanguages(langs: string[]) {
      this.preferredLanguages = langs
      this._persist()
    },
    setSubtitleLanguages(langs: string[]) {
      this.preferredSubtitleLanguages = langs
      this._persist()
    },
    setQuality(q: string) {
      this.preferredQuality = q
      this._persist()
    },
    toggleShowAllLanguages() {
      this.showAllLanguages = !this.showAllLanguages
      this._persist()
    },
    loadFromStorage() {
      if (!import.meta.client) return
      const saved = localStorage.getItem('streamvault_preferences')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          Object.assign(this, parsed)
        } catch { /* ignore */ }
      }
    },
    _persist() {
      if (!import.meta.client) return
      localStorage.setItem('streamvault_preferences', JSON.stringify({
        preferredLanguages: this.preferredLanguages,
        preferredSubtitleLanguages: this.preferredSubtitleLanguages,
        preferredQuality: this.preferredQuality,
        autoPlay: this.autoPlay,
        showAllLanguages: this.showAllLanguages,
      }))
    },
  },
})
