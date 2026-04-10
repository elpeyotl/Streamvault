export interface SubtitleResult {
  id: string
  language: string
  languageName: string
  filename: string
  downloadUrl: string
  rating: number
  hearingImpaired: boolean
}

/**
 * Search OpenSubtitles for a movie or episode
 */
export async function searchSubtitles(
  imdbId: string,
  options: { languages?: string[]; season?: number; episode?: number } = {}
): Promise<SubtitleResult[]> {
  const config = useRuntimeConfig()
  const apiKey = config.opensubtitlesApiKey
  const baseUrl = config.opensubtitlesBaseUrl

  if (!apiKey) return []

  try {
    const params: Record<string, string> = { imdb_id: imdbId }
    if (options.languages?.length) params.languages = options.languages.join(',')
    if (options.season !== undefined) params.season_number = String(options.season)
    if (options.episode !== undefined) params.episode_number = String(options.episode)

    const searchParams = new URLSearchParams(params)
    const response = await fetch(`${baseUrl}/subtitles?${searchParams}`, {
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) return []

    const data = await response.json() as {
      data: Array<{
        id: string
        attributes: {
          language: string
          hearing_impaired: boolean
          ratings: number
          files: Array<{
            file_id: number
            file_name: string
          }>
        }
      }>
    }

    return data.data.map(sub => ({
      id: sub.id,
      language: sub.attributes.language,
      languageName: getLanguageName(sub.attributes.language),
      filename: sub.attributes.files[0]?.file_name || '',
      downloadUrl: '', // Needs a separate download request
      rating: sub.attributes.ratings,
      hearingImpaired: sub.attributes.hearing_impaired,
    }))
  } catch {
    console.warn('OpenSubtitles search failed')
    return []
  }
}

function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English', es: 'Spanish', de: 'German', fr: 'French',
    it: 'Italian', pt: 'Portuguese', nl: 'Dutch', sv: 'Swedish',
    ru: 'Russian', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
    ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', pl: 'Polish',
  }
  return names[code] || code
}
