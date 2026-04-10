import type { AvailableStream } from '~/types/stream'

export type ValidationStatus = 'pending' | 'checking' | 'verified' | 'dead'

export interface ValidatedStream extends AvailableStream {
  validationStatus: ValidationStatus
  validatedUrl?: string     // Pre-resolved URL, ready to play instantly
  validatedSpeed?: number   // MB/s from range check
  validationError?: string
  validatedAt?: number      // Timestamp for cache TTL
}

// ── Module-level singleton state ──
// Shared across all component instances so re-navigation preserves results

const validationCache = new Map<string, {
  status: ValidationStatus
  url?: string
  speed?: number
  error?: string
  timestamp: number
}>()

const CACHE_TTL = 45 * 60 * 1000 // 45 minutes

// Singleton reactive state
const validatedStreams = ref<Map<string, ValidatedStream>>(new Map())
const isValidating = ref(false)
const validationProgress = ref({ total: 0, done: 0, verified: 0, dead: 0 })

// Track active EventSource for cleanup
let activeEventSource: EventSource | null = null

export function useStreamValidation() {

  /**
   * Enhance a list of AvailableStreams with validation status.
   * Reads from module-level cache for previously validated streams.
   */
  function initStreams(streams: AvailableStream[]): ValidatedStream[] {
    const enhanced: ValidatedStream[] = streams.map(s => {
      // Check cache first
      const cached = getFromCache(s.hash)
      if (cached) {
        return {
          ...s,
          validationStatus: cached.status as ValidationStatus,
          validatedUrl: cached.url,
          validatedSpeed: cached.speed,
          validationError: cached.error,
          validatedAt: cached.timestamp,
        }
      }
      return {
        ...s,
        validationStatus: 'pending' as ValidationStatus,
      }
    })

    // Update reactive map
    validatedStreams.value = new Map(enhanced.map(s => [s.hash, s]))

    return enhanced
  }

  /**
   * Start background validation of streams via SSE.
   * Cancels any previously running validation first.
   */
  function startValidation(streams: AvailableStream[], token: string, maxValidate = 5) {
    // Cancel any existing validation
    stopValidation()

    // Filter out already cached/verified streams
    const toValidate = streams
      .filter(s => {
        const cached = getFromCache(s.hash)
        return !cached || cached.status === 'dead' // re-check dead ones too after TTL
      })
      .slice(0, maxValidate)

    if (toValidate.length === 0) return

    isValidating.value = true
    validationProgress.value = { total: toValidate.length, done: 0, verified: 0, dead: 0 }

    // Mark as "checking"
    for (const s of toValidate) {
      const existing = validatedStreams.value.get(s.hash)
      if (existing) {
        const updated = { ...existing, validationStatus: 'checking' as ValidationStatus }
        validatedStreams.value.set(s.hash, updated)
      }
    }
    // Trigger reactivity by reassigning the Map
    validatedStreams.value = new Map(validatedStreams.value)

    // Open SSE connection
    const hashes = toValidate.map(s => s.hash).join(',')
    const url = `/api/stream/validate-batch?hashes=${encodeURIComponent(hashes)}&token=${encodeURIComponent(token)}&max=${maxValidate}`

    const eventSource = new EventSource(url)
    activeEventSource = eventSource

    eventSource.addEventListener('validation', (e: MessageEvent) => {
      // Bail if this EventSource was cancelled
      if (activeEventSource !== eventSource) { eventSource.close(); return }

      try {
        const result = JSON.parse(e.data) as {
          hash: string
          status: 'verified' | 'available' | 'dead'
          url?: string
          speed?: number
          filename?: string
          filesize?: number
          contentType?: string
          error?: string
        }

        const resolvedStatus: ValidationStatus = result.status === 'available' ? 'pending' : result.status

        // Update stream in reactive map
        const stream = validatedStreams.value.get(result.hash)
        if (stream) {
          const updated: ValidatedStream = {
            ...stream,
            validationStatus: resolvedStatus,
            validatedUrl: result.url,
            validatedSpeed: result.speed,
            validationError: result.error,
            validatedAt: Date.now(),
          }
          validatedStreams.value.set(result.hash, updated)
          // Trigger reactivity
          validatedStreams.value = new Map(validatedStreams.value)
        }

        // Update cache
        setCache(result.hash, {
          status: resolvedStatus as string,
          url: result.url,
          speed: result.speed,
          error: result.error,
        })

        // Update progress
        validationProgress.value = {
          ...validationProgress.value,
          done: validationProgress.value.done + 1,
          verified: validationProgress.value.verified + (result.status === 'verified' ? 1 : 0),
          dead: validationProgress.value.dead + (result.status === 'dead' ? 1 : 0),
        }
      } catch { /* ignore parse errors */ }
    })

    eventSource.addEventListener('done', () => {
      isValidating.value = false
      eventSource.close()
      if (activeEventSource === eventSource) activeEventSource = null
    })

    eventSource.addEventListener('error', () => {
      isValidating.value = false
      eventSource.close()
      if (activeEventSource === eventSource) activeEventSource = null
    })
  }

  /**
   * Stop any in-progress validation (close EventSource).
   */
  function stopValidation() {
    if (activeEventSource) {
      activeEventSource.close()
      activeEventSource = null
    }
    isValidating.value = false
  }

  /**
   * Validate a single stream (non-SSE, direct fetch).
   */
  async function validateSingle(hash: string, token: string): Promise<ValidatedStream | null> {
    const stream = validatedStreams.value.get(hash)
    if (!stream) return null

    const checking = { ...stream, validationStatus: 'checking' as ValidationStatus }
    validatedStreams.value.set(hash, checking)
    validatedStreams.value = new Map(validatedStreams.value)

    try {
      const result = await $fetch<{
        hash: string
        status: 'verified' | 'available' | 'dead'
        url?: string
        speed?: number
        error?: string
      }>('/api/stream/validate', {
        method: 'POST',
        body: { hash, token },
      })

      const resolvedStatus: ValidationStatus = result.status === 'available' ? 'pending' : result.status

      const updated: ValidatedStream = {
        ...stream,
        validationStatus: resolvedStatus,
        validatedUrl: result.url,
        validatedSpeed: result.speed,
        validationError: result.error,
        validatedAt: Date.now(),
      }
      validatedStreams.value.set(hash, updated)
      validatedStreams.value = new Map(validatedStreams.value)

      setCache(hash, {
        status: resolvedStatus as string,
        url: result.url,
        speed: result.speed,
        error: result.error,
      })

      return updated
    } catch {
      const dead: ValidatedStream = {
        ...stream,
        validationStatus: 'dead',
        validationError: 'Validation request failed',
      }
      validatedStreams.value.set(hash, dead)
      validatedStreams.value = new Map(validatedStreams.value)
      return dead
    }
  }

  /**
   * Score a stream for ranking. Higher = better.
   * Factors: quality, speed, size, language match.
   */
  function streamScore(s: ValidatedStream): number {
    let score = 0

    // Quality (biggest factor)
    const qualityScores: Record<string, number> = {
      '4k': 50, '2160p': 50, '1080p': 40, '720p': 25, '480p': 10, 'unknown': 5,
    }
    score += qualityScores[s.quality] || 5

    // Speed (MB/s) — normalize: 5+ MB/s is great, 0.5 is poor
    if (s.validatedSpeed) {
      score += Math.min(s.validatedSpeed * 4, 30) // max 30 points
    }

    // Size as proxy for bitrate (larger = better quality usually)
    // Normalize: 1-2GB = decent, 4GB+ = great
    const gb = s.size / (1024 * 1024 * 1024)
    score += Math.min(gb * 5, 20) // max 20 points

    // Language preference match
    const preferences = usePreferencesStore()
    if (preferences.preferredLanguages.length > 0) {
      const hasPreferred = s.languages.some(l => preferences.preferredLanguages.includes(l))
      if (hasPreferred) score += 15
    }

    return score
  }

  /**
   * Sorted streams: verified first (ranked by composite score), then pending, then dead
   */
  const sortedStreams = computed(() => {
    const all = Array.from(validatedStreams.value.values())
    const statusOrder: Record<ValidationStatus, number> = {
      verified: 0,
      checking: 1,
      pending: 2,
      dead: 3,
    }
    return all.sort((a, b) => {
      const sa = statusOrder[a.validationStatus] ?? 2
      const sb = statusOrder[b.validationStatus] ?? 2
      if (sa !== sb) return sa - sb
      // Within same status, rank by composite score
      return streamScore(b) - streamScore(a)
    })
  })

  /**
   * Best verified stream (first one ready to play)
   */
  const bestStream = computed(() => {
    return sortedStreams.value.find(s => s.validationStatus === 'verified' && s.validatedUrl)
  })

  // Cache helpers
  function getFromCache(hash: string) {
    const cached = validationCache.get(hash.toLowerCase())
    if (!cached) return null
    if (Date.now() - cached.timestamp > CACHE_TTL) {
      validationCache.delete(hash.toLowerCase())
      return null
    }
    return cached
  }

  function setCache(hash: string, data: { status: string; url?: string; speed?: number; error?: string }) {
    validationCache.set(hash.toLowerCase(), {
      ...data,
      status: data.status as ValidationStatus,
      timestamp: Date.now(),
    })
  }

  function clearCache() {
    validationCache.clear()
    validatedStreams.value = new Map()
  }

  return {
    validatedStreams: readonly(validatedStreams),
    isValidating: readonly(isValidating),
    validationProgress: readonly(validationProgress),
    sortedStreams,
    bestStream,
    initStreams,
    startValidation,
    stopValidation,
    validateSingle,
    clearCache,
  }
}
