import type { TorrentHash, StreamQuality } from '~/types/stream'

/**
 * Search for torrent hashes across multiple sources
 */
export async function searchHashes(
  imdbId: string,
  options: { season?: number; episode?: number } = {}
): Promise<TorrentHash[]> {
  const results: TorrentHash[] = []

  // Search all sources in parallel
  const [zileanResults, torrentioResults] = await Promise.allSettled([
    searchZilean(imdbId, options),
    searchTorrentio(imdbId, options),
  ])

  if (zileanResults.status === 'fulfilled') results.push(...zileanResults.value)
  if (torrentioResults.status === 'fulfilled') results.push(...torrentioResults.value)

  // Deduplicate by hash (case-insensitive)
  const seen = new Set<string>()
  const unique = results.filter(r => {
    const key = r.hash.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // Sort by quality (best first), then by size (largest first)
  const qualityOrder: Record<StreamQuality, number> = {
    '4k': 0, '2160p': 0, '1080p': 1, '720p': 2, '480p': 3, 'unknown': 4,
  }
  unique.sort((a, b) => {
    const qa = qualityOrder[a.quality] ?? 4
    const qb = qualityOrder[b.quality] ?? 4
    if (qa !== qb) return qa - qb
    return b.size - a.size
  })

  return unique
}

/**
 * Search Zilean (DMM hash database)
 */
async function searchZilean(
  imdbId: string,
  options: { season?: number; episode?: number } = {}
): Promise<TorrentHash[]> {
  const config = useRuntimeConfig()
  const baseUrl = config.zileanApiUrl

  try {
    // Zilean DMM filtered endpoint
    const params: Record<string, string> = { ImdbId: imdbId }
    if (options.season !== undefined) params.Season = String(options.season)
    if (options.episode !== undefined) params.Episode = String(options.episode)

    const searchParams = new URLSearchParams(params)
    const response = await fetch(`${baseUrl}/dmm/filtered?${searchParams}`)

    if (!response.ok) return []

    const data = await response.json() as Array<{
      infoHash: string
      filename: string
      filesize: number
    }>

    return data.map(item => ({
      hash: item.infoHash,
      title: item.filename,
      size: item.filesize || 0,
      quality: parseQuality(item.filename),
      languages: parseLanguages(item.filename),
      source: 'zilean',
    }))
  } catch {
    console.warn('Zilean search failed')
    return []
  }
}

/**
 * Search Torrentio API (public Stremio addon)
 */
async function searchTorrentio(
  imdbId: string,
  options: { season?: number; episode?: number } = {}
): Promise<TorrentHash[]> {
  const config = useRuntimeConfig()
  const baseUrl = config.torrentioApiUrl

  try {
    let path: string
    if (options.season !== undefined && options.episode !== undefined) {
      path = `/stream/series/${imdbId}:${options.season}:${options.episode}.json`
    } else {
      path = `/stream/movie/${imdbId}.json`
    }

    const response = await fetch(`${baseUrl}${path}`)
    if (!response.ok) return []

    const data = await response.json() as {
      streams: Array<{
        infoHash?: string
        title?: string
        name?: string
        fileSize?: number
        behaviorHints?: { bingeGroup?: string }
      }>
    }

    if (!data.streams) return []

    return data.streams
      .filter(s => s.infoHash)
      .map(s => ({
        hash: s.infoHash!,
        title: s.title || s.name || 'Unknown',
        size: s.fileSize || 0,
        quality: parseQuality(s.title || s.name || ''),
        languages: parseLanguages(s.title || s.name || ''),
        source: 'torrentio',
      }))
  } catch {
    console.warn('Torrentio search failed')
    return []
  }
}

/**
 * Parse quality from torrent title
 */
function parseQuality(title: string): StreamQuality {
  const t = title.toLowerCase()
  if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) return '2160p'
  if (t.includes('1080p') || t.includes('fullhd') || t.includes('full hd')) return '1080p'
  if (t.includes('720p') || t.includes('hd')) return '720p'
  if (t.includes('480p') || t.includes('sd')) return '480p'
  return 'unknown'
}

/**
 * Parse languages from torrent title
 */
function parseLanguages(title: string): string[] {
  const t = title.toLowerCase()
  const langs: string[] = []

  const langMap: Record<string, string> = {
    'english': 'en', 'eng': 'en', 'en': 'en',
    'spanish': 'es', 'esp': 'es', 'spa': 'es', 'es': 'es', 'latino': 'es', 'castellano': 'es',
    'german': 'de', 'ger': 'de', 'deu': 'de', 'de': 'de', 'deutsch': 'de',
    'french': 'fr', 'fre': 'fr', 'fra': 'fr', 'fr': 'fr',
    'italian': 'it', 'ita': 'it', 'it': 'it',
    'portuguese': 'pt', 'por': 'pt', 'pt': 'pt',
    'russian': 'ru', 'rus': 'ru', 'ru': 'ru',
    'japanese': 'ja', 'jpn': 'ja', 'ja': 'ja',
    'korean': 'ko', 'kor': 'ko', 'ko': 'ko',
    'chinese': 'zh', 'chi': 'zh', 'zh': 'zh',
    'hindi': 'hi', 'hin': 'hi', 'hi': 'hi',
    'arabic': 'ar', 'ara': 'ar', 'ar': 'ar',
    'dutch': 'nl', 'nld': 'nl', 'nl': 'nl',
    'swedish': 'sv', 'swe': 'sv', 'sv': 'sv',
    'multi': 'multi',
  }

  for (const [keyword, code] of Object.entries(langMap)) {
    // Match whole words to avoid false positives
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(t) && !langs.includes(code)) {
      langs.push(code)
    }
  }

  // If nothing detected, assume English
  if (langs.length === 0) langs.push('en')

  return langs
}
