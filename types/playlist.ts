export interface Playlist {
  id: string
  userId: string
  title: string
  description: string | null
  isShared: boolean
  coverTmdbId: number | null
  createdAt: string
  updatedAt: string
  itemCount?: number
}

export interface PlaylistItem {
  id: string
  playlistId: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  seasonNumber: number | null
  episodeNumber: number | null
  position: number
  addedAt: string
  // Denormalized from TMDB (fetched client-side)
  title?: string
  posterPath?: string | null
}

export interface WatchHistoryEntry {
  id: string
  userId: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  seasonNumber: number | null
  episodeNumber: number | null
  progressSeconds: number
  durationSeconds: number
  completed: boolean
  lastWatchedAt: string
  // Denormalized
  title?: string
  posterPath?: string | null
}

export interface WatchlistEntry {
  id: string
  userId: string
  tmdbId: number
  mediaType: 'movie' | 'tv'
  addedAt: string
  // Denormalized
  title?: string
  posterPath?: string | null
}
