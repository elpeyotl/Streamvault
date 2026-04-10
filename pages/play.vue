<template>
  <ClientOnly>
    <!-- Pre-buffering screen -->
    <div v-if="!ready" class="fixed inset-0 bg-black z-50">
      <!-- Full-screen backdrop -->
      <div
        v-if="backdropUrl"
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${backdropUrl})` }"
      />
      <!-- Gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

      <!-- Content -->
      <div class="relative h-full flex flex-col items-center justify-center">
        <!-- Poster thumbnail -->
        <div v-if="posterUrl" class="mb-6 w-44 sm:w-52 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/10">
          <img :src="posterUrl" :alt="playerStore.mediaTitle" class="w-full" />
        </div>

        <!-- Title block -->
        <div class="text-center max-w-2xl px-8 mb-8">
          <h1 class="text-2xl sm:text-3xl font-bold mb-1">{{ playerStore.mediaTitle }}</h1>
          <p v-if="subtitle" class="text-base text-vault-muted">{{ subtitle }}</p>
        </div>

        <!-- Loading state -->
        <div v-if="!loadError" class="flex flex-col items-center gap-4">
          <div class="w-12 h-12 border-3 border-vault-accent border-t-transparent rounded-full animate-spin" />
          <p class="text-sm text-vault-muted">{{ statusMessage }}</p>
        </div>

        <!-- Error state -->
        <div v-else class="flex flex-col items-center gap-3">
          <svg class="w-10 h-10 text-vault-error" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
          <p class="text-sm text-vault-error">{{ loadError }}</p>
        </div>

        <!-- Back button -->
        <button
          class="focusable mt-8 px-5 py-2.5 bg-white/10 backdrop-blur border border-white/10 rounded-xl text-sm text-vault-muted hover:text-vault-text transition-colors"
          @click="onClose"
        >
          Go Back
        </button>
      </div>
    </div>

    <!-- Player (shown when ready) -->
    <VideoPlayer
      v-if="ready"
      :src="playerStore.streamUrl!"
      :title="playerStore.mediaTitle"
      :subtitle="subtitle"
      :resume-from="playerStore.resumeFrom"
      @close="onClose"
      @ready="ready = true"
    />
  </ClientOnly>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'player' })

const router = useRouter()
const playerStore = usePlayerStore()
const { saveProgress } = useWatchHistory()
const { backdropUrl: buildBackdropUrl, posterUrl: buildPosterUrl } = useTMDB()

const ready = ref(false)
const loadError = ref('')
const statusMessage = ref('Preparing stream...')

const posterUrl = computed(() => {
  if (!playerStore.mediaPoster) return ''
  return buildPosterUrl(playerStore.mediaPoster, 'w342')
})

const backdropUrl = computed(() => {
  const path = playerStore.mediaBackdrop || playerStore.mediaPoster
  if (!path) return ''
  return buildBackdropUrl(path, 'w1280')
})

const subtitle = computed(() => {
  if (playerStore.mediaType === 'tv' && playerStore.seasonNumber && playerStore.episodeNumber) {
    const ep = `S${String(playerStore.seasonNumber).padStart(2, '0')}E${String(playerStore.episodeNumber).padStart(2, '0')}`
    return playerStore.episodeTitle ? `${ep} · ${playerStore.episodeTitle}` : ep
  }
  return ''
})

// If no stream URL, redirect home
onMounted(() => {
  if (!playerStore.streamUrl) {
    router.push('/')
    return
  }

  // For direct playback (MP4), skip pre-buffer — play immediately
  if (playerStore.playbackType === 'direct') {
    ready.value = true
    return
  }

  // For HLS, the VideoPlayer handles transcoding setup.
  // We start it and wait for the 'ready' event.
  startHlsPrep()
})

async function startHlsPrep() {
  statusMessage.value = 'Starting transcode...'

  try {
    const result = await $fetch<{
      session: string
      playlist: string
      duration: number
      audioTracks: any[]
      subtitleTracks: any[]
      videoCodec: string
      resolution: string
    }>('/api/stream/hls', {
      params: { url: playerStore.directUrl },
    })

    // Store HLS session data
    playerStore.hlsPlaylist = result.playlist
    playerStore.hlsSession = result.session
    playerStore.mediaDuration = result.duration
    playerStore.audioTracks = result.audioTracks || []
    playerStore.videoCodec = result.videoCodec || ''
    playerStore.resolution = result.resolution || ''
    statusMessage.value = 'Buffering...'

    // Small delay to let a couple segments build up
    await new Promise(r => setTimeout(r, 2000))

    ready.value = true
  } catch (err: any) {
    console.error('[play] HLS prep failed:', err.message)
    // Fall back to direct playback
    statusMessage.value = 'Transcode failed, playing directly...'
    playerStore.playbackType = 'direct'
    await new Promise(r => setTimeout(r, 1000))
    ready.value = true
  }
}

function onClose() {
  router.back()
}

onUnmounted(() => {
  if (playerStore.tmdbId) {
    saveProgress({
      tmdbId: playerStore.tmdbId,
      mediaType: playerStore.mediaType,
      seasonNumber: playerStore.seasonNumber || undefined,
      episodeNumber: playerStore.episodeNumber || undefined,
      progressSeconds: 0,
      durationSeconds: 0,
    }).catch(() => {})
  }
})
</script>
