export interface RDUser {
  id: number
  username: string
  email: string
  premium: number
  expiration: string
  type: string
}

export interface RDCachedResult {
  cached: boolean
  files: { id: number; filename: string; filesize: number }[]
}

export interface RDTorrent {
  id: string
  filename: string
  hash: string
  bytes: number
  host: string
  split: number
  progress: number
  status: string
  added: string
  links: string[]
  ended: string
  speed: number
  seeders: number
}

export interface RDUnrestrictedLink {
  id: string
  filename: string
  mimeType: string
  filesize: number
  link: string
  host: string
  chunks: number
  download: string // <-- This is the HTTPS stream URL
  streamable: number
}

export interface RDAddMagnetResponse {
  id: string
  uri: string
}

export interface RDTorrentFile {
  id: number
  path: string
  bytes: number
  selected: number
}

export interface RDTorrentInfo {
  id: string
  filename: string
  original_filename: string
  hash: string
  bytes: number
  original_bytes: number
  host: string
  split: number
  progress: number
  status: string
  added: string
  files: RDTorrentFile[]
  links: string[]
  ended: string
  speed: number
  seeders: number
}
