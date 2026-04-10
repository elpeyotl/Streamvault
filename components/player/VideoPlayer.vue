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
      <div v-if="player.isBuffering.value && !switchingTrack" class="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div class="w-12 h-12 border-3 border-vault-accent border-t-transparent rounded-full animate-spin" />
      </div>
    </Transition>

    <!-- Audio track switching overlay (cinematic) -->
    <Transition name="fade">
      <div v-if="switchingTrack" class="absolute inset-0 bg-black z-40">
        <!-- Backdrop -->
        <div
          v-if="playerStore.mediaBackdrop"
          class="absolute inset-0 bg-cover bg-center"
          :style="{ backgroundImage: `url(${backdropSwitchUrl})` }"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

        <div class="relative h-full flex flex-col items-center justify-center">
          <!-- Poster -->
          <div v-if="playerStore.mediaPoster" class="mb-6 w-36 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <img :src="posterSwitchUrl" :alt="props.title" class="w-full" />
          </div>

          <h2 class="text-xl font-bold mb-1">{{ props.title }}</h2>
          <p v-if="props.subtitle" class="text-sm text-vault-muted mb-6">{{ props.subtitle }}</p>

          <!-- Pulsing loader -->
          <div class="flex items-center gap-1.5 mb-3">
            <div class="w-2 h-2 bg-vault-accent rounded-full animate-pulse" style="animation-delay: 0ms" />
            <div class="w-2 h-2 bg-vault-accent rounded-full animate-pulse" style="animation-delay: 150ms" />
            <div class="w-2 h-2 bg-vault-accent rounded-full animate-pulse" style="animation-delay: 300ms" />
          </div>
          <p class="text-sm text-vault-muted">Switching audio track...</p>
        </div>
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
const switchingTrack = ref(false)
const seekOffset = ref(0)
const controlsVisible = ref(true)

const { backdropUrl: buildBackdropUrl, posterUrl: buildPosterUrl } = useTMDB()
const backdropSwitchUrl = computed(() => playerStore.mediaBackdrop ? buildBackdropUrl(playerStore.mediaBackdrop, 'w1280') : '')
const posterSwitchUrl = computed(() => playerStore.mediaPoster ? buildPosterUrl(playerStore.mediaPoster, 'w342') : '')
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

  // ESC closes the player (when not fullscreen)
  player.onClose(() => emit('close'))

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

async function startHls(playlistUrl: string, directUrl: string, resumeAt?: number) {
  const Hls = (await import('hls.js')).default

  if (!Hls.isSupported() || !videoEl.value) {
    playDirect(directUrl)
    return
  }

  const startPos = resumeAt ?? (props.resumeFrom && props.resumeFrom > 0 ? props.resumeFrom : 0)

  const hls = new Hls({
    maxBufferLength: 60,
    maxMaxBufferLength: 120,
    startPosition: startPos,
    liveSyncDuration: 0,
  })
  hlsInstance = hls

  hls.loadSource(playlistUrl)
  hls.attachMedia(videoEl.value)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    if (playerStore.mediaDuration > 0) {
      player.setKnownDuration(playerStore.mediaDuration)
    }
    videoEl.value?.play().catch(() => {})
    // HLS.js startPosition handles seeking, but force it as backup
    if (startPos > 0 && videoEl.value) {
      videoEl.value.currentTime = startPos
    }
    switchingTrack.value = false
  })

  hls.on(Hls.Events.ERROR, (_: any, data: any) => {
    if (data.fatal) {
      console.error('[hls.js] fatal error:', data.type, data.details)
      hls.destroy()
      hlsInstance = null
      switchingTrack.value = false
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

async function onSelectAudioTrack(index: number) {
  if (!playerStore.directUrl || playerStore.playbackType !== 'hls') return

  const resumeAt = Math.floor(player.currentTime.value)
  switchingTrack.value = true

  // Pause and destroy current HLS
  player.pause()
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }

  playerStore.activeAudioTrack = index

  try {
    // Start new HLS session — ffmpeg seeks to current position with -ss
    const result = await $fetch<{
      session: string
      playlist: string
      duration: number
      seekOffset: number
      audioTracks: any[]
    }>('/api/stream/hls', {
      params: { url: playerStore.directUrl, audioTrack: index, seek: resumeAt },
    })

    playerStore.hlsPlaylist = result.playlist
    playerStore.hlsSession = result.session

    // HLS starts at 0 (ffmpeg seeked), so startPosition=0 is correct
    // But we need to offset the displayed time
    seekOffset.value = result.seekOffset || 0

    await startHls(result.playlist, playerStore.directUrl!, 0)
  } catch (e: any) {
    console.error('[player] Audio track switch failed:', e)
    switchingTrack.value = false
    playDirect(playerStore.directUrl!)
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
