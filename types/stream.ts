export interface TorrentHash {
  hash: string
  title: string
  size: number        // bytes
  quality: StreamQuality
  languages: string[] // ISO 639-1 codes parsed from title
  source: string      // 'zilean' | 'torrentio' | etc.
  seeders?: number
}

export type StreamQuality = '4k' | '2160p' | '1080p' | '720p' | '480p' | 'unknown'

export interface AvailableStream extends TorrentHash {
  cached: boolean
  files: StreamFile[]
}

export interface StreamFile {
  id: number
  filename: string
  filesize: number
}

export interface ResolvedStream {
  url: string          // HTTPS direct download/stream URL
  filename: string
  filesize: number
  mimeType: string
  quality: StreamQuality
  hash: string
}

export interface StreamResolveRequest {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  imdbId: string
  season?: number
  episode?: number
  rdToken: string
}

export interface StreamResolveResponse {
  streams: AvailableStream[]
}
