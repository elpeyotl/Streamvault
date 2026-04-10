import { defineStore } from 'pinia'

/**
 * Check if a stream URL needs transcoding for browser playback.
 * MKV, AVI, and other non-MP4/WebM containers often have AC3/DTS audio
 * that browsers can't decode. Route these through the ffmpeg proxy.
 */
/**
 * Check if a stream needs transcoding and return the appropriate URL.
 * Returns 'hls' type for streams that need ffmpeg processing.
 */
function resolvePlayback(url: string, filename?: string): { url: string; type: 'direct' | 'hls' } {
  const source = filename || new URL(url, 'http://localhost').pathname
  const ext = source.toLowerCase().split('.').pop() || ''

  // Browser-native formats — play directly
  if (['mp4', 'webm', 'm4v'].includes(ext)) {
    return { url, type: 'direct' }
  }

  // Non-native containers — needs HLS transcoding for audio
  if (['mkv', 'avi', 'wmv', 'flv'].includes(ext)) {
    return { url, type: 'hls' }
  }

  // Check URL path for known non-native extensions
  const urlLower = url.toLowerCase()
  if (urlLower.includes('.mkv') || urlLower.includes('.avi')) {
    return { url, type: 'hls' }
  }

  return { url, type: 'direct' }
}

export const usePlayerStore = defineStore('player', {
  state: () => ({
    streamUrl: null as string | null,
    directUrl: null as string | null, // Original RD URL
    playbackType: 'direct' as 'direct' | 'hls',
    hlsPlaylist: null as string | null, // HLS m3u8 URL when type is 'hls'
    mediaTitle: '',
    mediaPoster: null as string | null,
    mediaBackdrop: null as string | null,
    tmdbId: 0,
    mediaType: 'movie' as 'movie' | 'tv',
    seasonNumber: null as number | null,
    episodeNumber: null as number | null,
    episodeTitle: '',
    imdbId: '',
    resumeFrom: 0,
  }),

  actions: {
    setStream(data: {
      url: string
      title: string
      filename?: string
      poster?: string | null
      backdrop?: string | null
      tmdbId: number
      mediaType: 'movie' | 'tv'
      imdbId: string
      season?: number
      episode?: number
      episodeTitle?: string
      resumeFrom?: number
    }) {
      const playback = resolvePlayback(data.url, data.filename)
      this.directUrl = data.url
      this.streamUrl = data.url
      this.playbackType = playback.type
      this.hlsPlaylist = null
      this.mediaTitle = data.title
      this.mediaPoster = data.poster || null
      this.mediaBackdrop = data.backdrop || null
      this.tmdbId = data.tmdbId
      this.mediaType = data.mediaType
      this.imdbId = data.imdbId
      this.seasonNumber = data.season || null
      this.episodeNumber = data.episode || null
      this.episodeTitle = data.episodeTitle || ''
      this.resumeFrom = data.resumeFrom || 0
    },

    clearStream() {
      this.streamUrl = null
      this.directUrl = null
      this.playbackType = 'direct'
      this.hlsPlaylist = null
      this.mediaTitle = ''
      this.mediaPoster = null
      this.resumeFrom = 0
    },
  },
})
