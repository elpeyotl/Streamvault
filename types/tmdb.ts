export interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  original_language: string
  popularity: number
  adult: boolean
}

export interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  original_language: string
  popularity: number
}

export interface TMDBMovieDetail extends TMDBMovie {
  imdb_id: string
  runtime: number
  genres: { id: number; name: string }[]
  spoken_languages: { iso_639_1: string; english_name: string; name: string }[]
  production_countries: { iso_3166_1: string; name: string }[]
  tagline: string
  status: string
  budget: number
  revenue: number
}

export interface TMDBTVDetail extends TMDBTVShow {
  external_ids: { imdb_id: string; tvdb_id: number }
  number_of_seasons: number
  number_of_episodes: number
  seasons: TMDBSeason[]
  genres: { id: number; name: string }[]
  spoken_languages: { iso_639_1: string; english_name: string; name: string }[]
  episode_run_time: number[]
  status: string
  tagline: string
}

export interface TMDBSeason {
  id: number
  season_number: number
  name: string
  overview: string
  poster_path: string | null
  episode_count: number
  air_date: string
}

export interface TMDBEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  still_path: string | null
  air_date: string
  vote_average: number
  runtime: number
}

export interface TMDBSeasonDetail {
  id: number
  season_number: number
  name: string
  overview: string
  episodes: TMDBEpisode[]
}

export interface TMDBSearchResponse<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface TMDBGenre {
  id: number
  name: string
}
