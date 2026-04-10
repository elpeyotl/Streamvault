import { defineStore } from 'pinia'
import type { TMDBMovie, TMDBTVShow } from '~/types/tmdb'

export const useSearchStore = defineStore('search', {
  state: () => ({
    query: '',
    results: [] as (TMDBMovie | TMDBTVShow)[],
    loading: false,
    totalResults: 0,
    page: 1,
    totalPages: 0,
    searchType: 'multi' as 'movie' | 'tv' | 'multi',
  }),

  actions: {
    async search(query: string, type?: 'movie' | 'tv' | 'multi') {
      this.query = query
      if (type) this.searchType = type
      this.page = 1
      this.loading = true

      try {
        const { search } = useTMDB()
        const data = await search(query, this.searchType, 1)
        this.results = data.results
        this.totalResults = data.total_results
        this.totalPages = data.total_pages
      } catch (e) {
        console.error('Search failed:', e)
        this.results = []
      } finally {
        this.loading = false
      }
    },

    async loadMore() {
      if (this.page >= this.totalPages || this.loading) return
      this.loading = true
      this.page++

      try {
        const { search } = useTMDB()
        const data = await search(this.query, this.searchType, this.page)
        this.results.push(...data.results)
      } catch (e) {
        console.error('Load more failed:', e)
      } finally {
        this.loading = false
      }
    },

    clear() {
      this.query = ''
      this.results = []
      this.totalResults = 0
      this.page = 1
    },
  },
})
