import type { AvailableStream, TorrentHash } from '~/types/stream'

/**
 * Server-side cache for stream resolve results.
 * Key: "imdbId:season:episode" → cached response with TTL.
 * Prevents redundant RD API calls when the user navigates back.
 */
const streamCache = new Map<string, { data: any; timestamp: number }>()
const STREAM_CACHE_TTL = 10 * 60 * 1000 // 10 minutes

/**
 * Full pipeline: IMDB ID → search hashes → check RD availability → return streams
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { imdbId, token, season, episode, preferredLanguages, preferredQuality } = body as {
    imdbId: string
    token: string
    season?: number
    episode?: number
    preferredLanguages?: string[]
    preferredQuality?: string
  }

  if (!imdbId || !token) {
    throw createError({ statusCode: 400, message: 'imdbId and token are required' })
  }

  // Check server-side cache first
  const cacheKey = `${imdbId}:${season ?? ''}:${episode ?? ''}`
  const cached = streamCache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < STREAM_CACHE_TTL) {
    return cached.data
  }

  // 1. Search torrent hashes
  const hashes = await searchHashes(imdbId, { season, episode })
  if (hashes.length === 0) {
    return { streams: [], totalFound: 0, cachedCount: 0, message: 'No torrents found' }
  }

  // 2. Check cache availability on Real-Debrid
  // Pick a balanced mix across quality tiers so we don't blow the budget
  // on uncached 4K while missing cached 1080p streams.
  // Budget: ~20 hashes (each = 3 API calls)
  const hashesToCheck = pickBalancedHashes(hashes, 20)
  const cachedResults = await checkCachedHashes(hashesToCheck.map(h => h.hash), token)

  // 3. Build available streams list (only cached)
  const streams: AvailableStream[] = []

  for (const hash of hashes) {
    const result = cachedResults[hash.hash]

    if (result?.cached) {
      streams.push({
        ...hash,
        cached: true,
        files: result.files,
      })
    }
  }

  // 4. Filter by preferred languages (if set)
  let filtered = streams
  if (preferredLanguages?.length) {
    const withPreferred = filtered.filter(s =>
      s.languages.some(l => preferredLanguages.includes(l)) || s.languages.includes('multi')
    )
    if (withPreferred.length > 0) filtered = withPreferred
  }

  // 5. Sort: preferred quality first, then by size
  if (preferredQuality) {
    filtered.sort((a, b) => {
      const aMatch = a.quality === preferredQuality ? 0 : 1
      const bMatch = b.quality === preferredQuality ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return b.size - a.size
    })
  }

  const response = {
    streams: filtered,
    totalFound: hashes.length,
    cachedCount: streams.length,
  }

  // Cache the result
  streamCache.set(cacheKey, { data: response, timestamp: Date.now() })

  return response
})

/**
 * Pick a balanced set of hashes across quality tiers.
 * Ensures we check some 4K, some 1080p, some 720p —
 * rather than blowing the entire budget on one tier that may not be cached.
 */
function pickBalancedHashes(hashes: TorrentHash[], budget: number): TorrentHash[] {
  const tiers: Record<string, TorrentHash[]> = {
    '4k': [],
    '1080p': [],
    'other': [],
  }

  for (const h of hashes) {
    if (h.quality === '4k' || h.quality === '2160p') tiers['4k'].push(h)
    else if (h.quality === '1080p') tiers['1080p'].push(h)
    else tiers['other'].push(h)
  }

  // Allocate budget: 4K gets 6, 1080p gets 10, other gets 4
  // If a tier has fewer, redistribute to others
  const allocs = { '4k': 6, '1080p': 10, 'other': 4 }
  const picked: TorrentHash[] = []

  let remaining = budget
  for (const tier of ['4k', '1080p', 'other'] as const) {
    const take = Math.min(allocs[tier], tiers[tier].length, remaining)
    picked.push(...tiers[tier].slice(0, take))
    remaining -= take
  }

  // Fill remaining budget with whatever's left
  if (remaining > 0) {
    const used = new Set(picked.map(h => h.hash))
    for (const h of hashes) {
      if (remaining <= 0) break
      if (!used.has(h.hash)) {
        picked.push(h)
        remaining--
      }
    }
  }

  return picked
}
