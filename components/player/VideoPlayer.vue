<template>
  <div
    ref="containerRef"
    class="relative w-full h-full bg-black"
    @mousemove="onMouseActivity"
    @click="player.togglePlay()"
  >
    <video
      ref="videoEl"
      class="w-full h-full"
      playsinline
      @click.stop="player.togglePlay()"
    />

    <!-- Buffering spinner -->
    <Transition name="fade">
      <div v-if="player.isBuffering.value" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-12 h-12 border-3 border-vault-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </Transition>

    <!-- Error overlay -->
    <Transition name="fade">
      <div v-if="loadError" class="absolute inset-0 flex items-center justify-center bg-black/90 z-50" @click.stop>
        <div class="text-center max-w-md px-6">
          <svg class="w-12 h-12 text-vault-error mx-auto mb-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
          <p class="text-sm text-vault-muted">{{ loadError }}</p>
          <button class="focusable mt-4 px-4 py-2 bg-vault-accent text-vault-bg rounded-lg text-sm font-semibold" @click="$emit('close')">Go Back</button>
        </div>
      </div>
    </Transition>

    <!-- Custom controls -->
    <PlayerControls
      :player="player"
      :visible="controlsVisible"
      :title="title"
      :subtitle="subtitle"
      :quality="quality"
      :video-codec="playerStore.videoCodec"
      :subtitles="subtitleResults"
      :active-subtitle="activeSubtitleId"
      :audio-tracks="playerStore.audioTracks"
      :active-audio-track="playerStore.activeAudioTrack"
      @close="$emit('close')"
      @select-subtitle="onSelectSubtitle"
      @select-audio-track="onSelectAudioTrack"
      @toggle-fullscreen="player.toggleFullscreen(containerRef!)"
    />
  </div>
</template>

<script setup lang="ts">
import type { SubtitleResult } from '~/server/utils/subtitles'

const props = defineProps<{
  src: string
  title?: string
  subtitle?: string
  resumeFrom?: number
}>()

defineEmits<{
  close: []
}>()

const containerRef = ref<HTMLElement>()
const videoEl = ref<HTMLVideoElement>()
const player = usePlayer()
const playerStore = usePlayerStore()
const loadError = ref('')
const controlsVisible = ref(true)
const subtitleResults = ref<SubtitleResult[]>([])
const activeSubtitleId = ref<string | null>(null)
let controlsTimer: ReturnType<typeof setTimeout> | null = null
let hlsInstance: any = null

// Quality string from resolution
const quality = computed(() => {
  const r = playerStore.resolution
  if (!r) return ''
  const height = parseInt(r.split('x')[1] || '0')
  if (height >= 2160) return '4K'
  if (height >= 1080) return '1080p'
  if (height >= 720) return '720p'
  if (height >= 480) return '480p'
  return r
})

function onMouseActivity() {
  controlsVisible.value = true
  if (controlsTimer) clearTimeout(controlsTimer)
  controlsTimer = setTimeout(() => {
    if (player.isPlaying.value) controlsVisible.value = false
  }, 3000)
}

onMounted(async () => {
  if (!videoEl.value) return

  player.bindVideo(videoEl.value)

  videoEl.value.addEventListener('error', () => {
    const err = videoEl.value?.error
    if (!err) return
    const messages: Record<number, string> = {
      1: 'Playback aborted.',
      2: 'Network error while loading the stream.',
      3: 'Could not decode this video format.',
      4: 'This video format is not supported by your browser.',
    }
    loadError.value = messages[err.code] || 'Failed to load video.'
  })

  if (playerStore.playbackType === 'hls' && playerStore.hlsPlaylist) {
    await startHls(playerStore.hlsPlaylist, playerStore.directUrl!)
  } else {
    playDirect(props.src)
  }

  // Fetch subtitles in background
  if (playerStore.imdbId) {
    fetchSubtitles()
  }

  window.addEventListener('keydown', player.handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', player.handleKeydown)
  if (controlsTimer) clearTimeout(controlsTimer)
  player.cleanup()
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
})

function playDirect(url: string) {
  if (!videoEl.value) return
  videoEl.value.src = url
  videoEl.value.load()
  videoEl.value.play().catch(() => {})
  if (props.resumeFrom && props.resumeFrom > 0) {
    videoEl.value.currentTime = props.resumeFrom
  }
}

async function startHls(playlistUrl: string, directUrl: string) {
  const Hls = (await import('hls.js')).default

  if (!Hls.isSupported() || !videoEl.value) {
    playDirect(directUrl)
    return
  }

  const hls = new Hls({ maxBufferLength: 60, maxMaxBufferLength: 120 })
  hlsInstance = hls

  hls.loadSource(playlistUrl)
  hls.attachMedia(videoEl.value)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    console.log(`[player] MANIFEST_PARSED — mediaDuration=${playerStore.mediaDuration}, video.duration=${videoEl.value?.duration}`)
    if (playerStore.mediaDuration > 0) {
      player.setKnownDuration(playerStore.mediaDuration)
      console.log(`[player] Set known duration to ${playerStore.mediaDuration}s`)
    }
    videoEl.value?.play().catch(() => {})
    if (props.resumeFrom && props.resumeFrom > 0) {
      videoEl.value!.currentTime = props.resumeFrom
    }
  })

  hls.on(Hls.Events.ERROR, (_: any, data: any) => {
    if (data.fatal) {
      console.error('[hls.js] fatal error:', data.type, data.details)
      hls.destroy()
      hlsInstance = null
      playDirect(directUrl)
    }
  })
}

async function fetchSubtitles() {
  try {
    const preferences = usePreferencesStore()
    const langs = preferences.preferredSubtitleLanguages.length > 0
      ? preferences.preferredSubtitleLanguages.join(',')
      : 'en'

    const results = await $fetch<SubtitleResult[]>('/api/subtitles/search', {
      params: {
        imdb: playerStore.imdbId,
        languages: langs,
        season: playerStore.seasonNumber || undefined,
        episode: playerStore.episodeNumber || undefined,
      },
    })
    subtitleResults.value = results
  } catch {
    // Subtitles are optional — fail silently
  }
}

async function onSelectSubtitle(id: string | null) {
  if (!videoEl.value) return

  // Remove existing tracks
  const existing = videoEl.value.querySelectorAll('track')
  existing.forEach(t => t.remove())

  if (!id) {
    activeSubtitleId.value = null
    return
  }

  const sub = subtitleResults.value.find(s => s.id === id)
  if (!sub) return

  try {
    // Download and convert to WebVTT
    const vttUrl = `/api/subtitles/download?fileId=${sub.fileId}`
    const track = document.createElement('track')
    track.kind = 'subtitles'
    track.label = sub.languageName
    track.srclang = sub.language
    track.src = vttUrl
    track.default = true
    videoEl.value.appendChild(track)

    // Activate the track
    if (videoEl.value.textTracks.length > 0) {
      videoEl.value.textTracks[0].mode = 'showing'
    }

    activeSubtitleId.value = id
  } catch {
    console.warn('Failed to load subtitle')
  }
}

function onSelectAudioTrack(index: number) {
  // Audio track switching requires restarting the HLS session
  // For now, just note the selection — full implementation deferred
  playerStore.activeAudioTrack = index
  console.log(`[player] Audio track switch to ${index} — requires HLS session restart (not yet implemented)`)
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
