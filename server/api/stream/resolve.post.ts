import type { AvailableStream } from '~/types/stream'

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
  // Limit to top 15 hashes to avoid RD rate limiting
  // (each hash = 3 API calls: addMagnet + getTorrentInfo + deleteTorrent)
  const topHashes = hashes.slice(0, 15).map(h => h.hash)
  const cachedResults = await checkCachedHashes(topHashes, token)

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
