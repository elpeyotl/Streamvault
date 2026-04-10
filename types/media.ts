export type MediaType = 'movie' | 'tv'

export interface MediaItem {
  tmdbId: number
  mediaType: MediaType
  title: string
  overview: string
  posterPath: string | null
  backdropPath: string | null
  releaseDate: string
  voteAverage: number
  originalLanguage: string
  genreIds: number[]
}

export interface MediaDetail extends MediaItem {
  imdbId: string
  genres: { id: number; name: string }[]
  spokenLanguages: { code: string; name: string }[]
  runtime?: number
  tagline?: string
  // TV specific
  numberOfSeasons?: number
  numberOfEpisodes?: number
  seasons?: SeasonInfo[]
}

export interface SeasonInfo {
  seasonNumber: number
  name: string
  episodeCount: number
  posterPath: string | null
  airDate: string
}

export interface EpisodeInfo {
  episodeNumber: number
  seasonNumber: number
  name: string
  overview: string
  stillPath: string | null
  airDate: string
  runtime: number
}
