import type { TMDBMovie, TMDBTVShow, TMDBMovieDetail, TMDBTVDetail, TMDBSearchResponse } from '~/types/tmdb'

export function useTMDB() {
  const config = useRuntimeConfig()
  const imageBase = config.public.tmdbImageBase

  function posterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342') {
    if (!path) return '/icons/placeholder-poster.svg'
    return `${imageBase}/${size}${path}`
  }

  function backdropUrl(path: string | null, size: 'w780' | 'w1280' | 'original' = 'w1280') {
    if (!path) return null
    return `${imageBase}/${size}${path}`
  }

  async function search(query: string, type: 'movie' | 'tv' | 'multi' = 'multi', page = 1) {
    return $fetch<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>('/api/tmdb/search', {
      params: { q: query, type, page },
    })
  }

  async function trending(type: 'movie' | 'tv' | 'all' = 'all', window: 'day' | 'week' = 'week') {
    return $fetch<TMDBSearchResponse<TMDBMovie | TMDBTVShow>>('/api/tmdb/trending', {
      params: { type, window },
    })
  }

  async function movieDetail(id: number) {
    return $fetch<TMDBMovieDetail>(`/api/tmdb/movie/${id}`)
  }

  async function tvDetail(id: number, season?: number) {
    return $fetch<TMDBTVDetail>(`/api/tmdb/tv/${id}`, {
      params: season !== undefined ? { season } : {},
    })
  }

  // Helper to determine if a result is a movie or TV show
  function isMovie(item: any): item is TMDBMovie {
    return 'title' in item || item.media_type === 'movie'
  }

  function getTitle(item: TMDBMovie | TMDBTVShow): string {
    return isMovie(item) ? item.title : item.name
  }

  function getReleaseDate(item: TMDBMovie | TMDBTVShow): string {
    return isMovie(item) ? item.release_date : item.first_air_date
  }

  function getYear(item: TMDBMovie | TMDBTVShow): string {
    const date = getReleaseDate(item)
    return date ? date.substring(0, 4) : ''
  }

  return {
    posterUrl,
    backdropUrl,
    search,
    trending,
    movieDetail,
    tvDetail,
    isMovie,
    getTitle,
    getReleaseDate,
    getYear,
  }
}
