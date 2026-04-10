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

  // Filter out cam/telesync/low-quality garbage
  const filtered = results.filter(r => !isJunkRelease(r.title))

  // Deduplicate by hash (case-insensitive)
  const seen = new Set<string>()
  const unique = filtered.filter(r => {
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
        behaviorHints?: { bingeGroup?: string; filename?: string }
      }>
    }

    if (!data.streams) return []

    return data.streams
      .filter(s => s.infoHash)
      .map(s => {
        const title = s.title || s.name || 'Unknown'
        return {
          hash: s.infoHash!,
          title,
          size: parseSizeFromTitle(title),
          quality: parseQuality(title),
          languages: parseLanguages(title),
          source: 'torrentio',
        }
      })
  } catch {
    console.warn('Torrentio search failed')
    return []
  }
}

/**
 * Parse file size from Torrentio title strings like "💾 39.38 GB" or "💾 1.59 GB"
 * Returns size in bytes.
 */
function parseSizeFromTitle(title: string): number {
  const match = title.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i)
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2].toUpperCase()

  switch (unit) {
    case 'TB': return value * 1024 * 1024 * 1024 * 1024
    case 'GB': return value * 1024 * 1024 * 1024
    case 'MB': return value * 1024 * 1024
    default: return 0
  }
}

/**
 * Detect junk releases: cams, telesyncs, screeners, hardcoded subs, etc.
 * These are unwatchable quality and should never be shown.
 */
function isJunkRelease(title: string): boolean {
  const t = title.toLowerCase()
  const junkTags = [
    'cam', 'camrip', 'cam-rip', 'hdcam', 'hd-cam',
    'telesync', 'tele-sync', 'hdts', 'hd-ts', 'pdvd',
    'tc', 'telecine', 'tele-cine', 'hdtc',
    'scr', 'screener', 'dvdscr', 'dvd-scr', 'bdscr',
    'r5', 'r6',
    'workprint',
  ]

  for (const tag of junkTags) {
    // Match as whole word to avoid false positives (e.g. "cam" in "camera")
    const regex = new RegExp(`\\b${tag}\\b`, 'i')
    if (regex.test(t)) return true
  }

  // Also filter extremely small files (<500MB for movies = likely garbage)
  // But we can't check size here since this only takes title
  return false
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
    'english': 'en', 'eng': 'en',
    'spanish': 'es', 'esp': 'es', 'spa': 'es', 'latino': 'es', 'castellano': 'es',
    'german': 'de', 'ger': 'de', 'deu': 'de', 'deutsch': 'de',
    'french': 'fr', 'fre': 'fr', 'fra': 'fr',
    'italian': 'it', 'ita': 'it',
    'portuguese': 'pt', 'por': 'pt',
    'russian': 'ru', 'rus': 'ru',
    'japanese': 'ja', 'jpn': 'ja',
    'korean': 'ko', 'kor': 'ko',
    'chinese': 'zh', 'chi': 'zh',
    'hindi': 'hi', 'hin': 'hi',
    'arabic': 'ar', 'ara': 'ar',
    'dutch': 'nl', 'nld': 'nl',
    'swedish': 'sv', 'swe': 'sv',
    'turkish': 'tr', 'tur': 'tr',
    'polish': 'pl', 'pol': 'pl',
  }

  for (const [keyword, code] of Object.entries(langMap)) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i')
    if (regex.test(t) && !langs.includes(code)) {
      langs.push(code)
    }
  }

  // Detect common release group patterns for dual/multi language
  // DL = Dual Language (usually German+English in German scene)
  // DUAL = Dual audio
  // MULTI = Multiple languages
  if (/\bDL\b/.test(title) || /\bdual\b/i.test(t)) {
    // DL in German scene releases means German+English
    if (!langs.includes('de')) langs.push('de')
    if (!langs.includes('en')) langs.push('en')
  }
  if (/\bmulti\b/i.test(t)) {
    if (!langs.includes('multi')) langs.push('multi')
  }

  // Detect "GERMAN.DL", "German.DTS", "German.AC3" patterns
  if (/german[\.\-\s]?(dl|dts|ac3|aac|dd|atmos)/i.test(title)) {
    if (!langs.includes('de')) langs.push('de')
  }

  // If nothing detected, assume English
  if (langs.length === 0) langs.push('en')

  return langs
}
