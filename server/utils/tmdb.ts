import type { TMDBSearchResponse, TMDBMovie, TMDBTVShow, TMDBMovieDetail, TMDBTVDetail, TMDBSeasonDetail } from '~/types/tmdb'

function getConfig() {
  const config = useRuntimeConfig()
  return {
    apiKey: config.tmdbApiKey,
    baseUrl: config.tmdbBaseUrl,
  }
}

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { apiKey, baseUrl } = getConfig()
  const searchParams = new URLSearchParams({ api_key: apiKey, ...params })
  const url = `${baseUrl}${path}?${searchParams.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `TMDB API error: ${response.statusText}` })
  }
  return response.json()
}

export async function searchTMDB(query: string, type: 'movie' | 'tv' = 'movie', page: number = 1, language?: string) {
  const params: Record<string, string> = {
    query,
    page: String(page),
    include_adult: 'false',
  }
  if (language) params.with_original_language = language

  if (type === 'movie') {
    return tmdbFetch<TMDBSearchResponse<TMDBMovie>>('/search/movie', params)
  }
  return tmdbFetch<TMDBSearchResponse<TMDBTVShow>>('/search/tv', params)
}

export async function searchMulti(query: string, page: number = 1) {
  return tmdbFetch<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>('/search/multi', {
    query,
    page: String(page),
    include_adult: 'false',
  })
}

export async function getTrending(type: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week') {
  return tmdbFetch<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>(`/trending/${type}/${timeWindow}`)
}

export async function getMovieDetail(id: number): Promise<TMDBMovieDetail> {
  return tmdbFetch<TMDBMovieDetail>(`/movie/${id}`, { append_to_response: 'external_ids,credits' })
}

export async function getTVDetail(id: number): Promise<TMDBTVDetail> {
  return tmdbFetch<TMDBTVDetail>(`/tv/${id}`, { append_to_response: 'external_ids,credits' })
}

export async function getSeasonDetail(tvId: number, seasonNumber: number): Promise<TMDBSeasonDetail> {
  return tmdbFetch<TMDBSeasonDetail>(`/tv/${tvId}/season/${seasonNumber}`)
}

export async function discoverMovies(params: Record<string, string> = {}) {
  return tmdbFetch<TMDBSearchResponse<TMDBMovie>>('/discover/movie', {
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...params,
  })
}

export async function discoverTV(params: Record<string, string> = {}) {
  return tmdbFetch<TMDBSearchResponse<TMDBTVShow>>('/discover/tv', {
    sort_by: 'popularity.desc',
    include_adult: 'false',
    ...params,
  })
}
