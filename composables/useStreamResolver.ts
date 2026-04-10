import type { AvailableStream } from '~/types/stream'

// Module-level cache so results survive navigation
const resolveCache = new Map<string, {
  streams: AvailableStream[]
  stats: { totalFound: number; cachedCount: number }
  timestamp: number
}>()
const RESOLVE_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export function useStreamResolver() {
  const loading = ref(false)
  const streams = ref<AvailableStream[]>([])
  const error = ref<string | null>(null)
  const stats = ref<{ totalFound: number; cachedCount: number } | null>(null)

  const { token } = useRealDebrid()
  const preferences = usePreferencesStore()

  /**
   * Find available streams for a movie or episode.
   * Returns cached results if available (avoids RD API calls on back-navigation).
   */
  async function findStreams(imdbId: string, options: { season?: number; episode?: number } = {}) {
    if (!token.value) {
      error.value = 'Real-Debrid token not configured'
      return
    }

    // Check client-side cache first
    const cacheKey = `${imdbId}:${options.season ?? ''}:${options.episode ?? ''}`
    const cached = resolveCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < RESOLVE_CACHE_TTL) {
      streams.value = cached.streams
      stats.value = cached.stats
      return
    }

    loading.value = true
    error.value = null
    streams.value = []
    stats.value = null

    try {
      const result = await $fetch<{
        streams: AvailableStream[]
        totalFound: number
        cachedCount: number
        message?: string
      }>('/api/stream/resolve', {
        method: 'POST',
        body: {
          imdbId,
          token: token.value,
          season: options.season,
          episode: options.episode,
          preferredLanguages: preferences.preferredLanguages,
          preferredQuality: preferences.preferredQuality,
        },
      })

      streams.value = result.streams
      stats.value = { totalFound: result.totalFound, cachedCount: result.cachedCount }

      // Cache the result
      resolveCache.set(cacheKey, {
        streams: result.streams,
        stats: { totalFound: result.totalFound, cachedCount: result.cachedCount },
        timestamp: Date.now(),
      })
    } catch (e: any) {
      error.value = e.data?.message || e.message || 'Failed to find streams'
    } finally {
      loading.value = false
    }
  }

  /**
   * Resolve a specific stream hash to a playable URL
   */
  async function resolveToUrl(hash: string, fileIndex?: number) {
    const { resolveStream } = useRealDebrid()
    return resolveStream(hash, fileIndex)
  }

  /**
   * Auto-resolve: find best matching stream and resolve it
   */
  async function autoResolve(imdbId: string, options: { season?: number; episode?: number } = {}) {
    await findStreams(imdbId, options)
    if (streams.value.length === 0) {
      throw new Error('No cached streams available')
    }
    // Resolve the top result (already sorted by preference)
    return resolveToUrl(streams.value[0].hash)
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return 'Unknown'
    const gb = bytes / (1024 * 1024 * 1024)
    if (gb >= 1) return `${gb.toFixed(1)} GB`
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(0)} MB`
  }

  return {
    loading: readonly(loading),
    streams: readonly(streams),
    error: readonly(error),
    stats: readonly(stats),
    findStreams,
    resolveToUrl,
    autoResolve,
    formatFileSize,
  }
}
