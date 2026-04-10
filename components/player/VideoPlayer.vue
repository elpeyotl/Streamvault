<template>
  <div
    ref="containerRef"
    class="relative w-full h-full bg-black group"
    @mousemove="player.showControlsTemporarily()"
    @click="player.togglePlay()"
  >
    <!-- Video element -->
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

    <!-- Error state -->
    <Transition name="fade">
      <div v-if="loadError" class="absolute inset-0 flex items-center justify-center bg-black/90">
        <div class="text-center max-w-md px-6">
          <svg class="w-12 h-12 text-vault-error mx-auto mb-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
          <p class="text-sm text-vault-muted">{{ loadError }}</p>
          <button class="focusable mt-4 px-4 py-2 bg-vault-accent text-vault-bg rounded-lg text-sm font-semibold" @click="$emit('close')">Go Back</button>
        </div>
      </div>
    </Transition>

    <!-- Controls overlay -->
    <Transition name="fade">
      <div
        v-show="player.showControls.value || !player.isPlaying.value"
        class="absolute inset-0 flex flex-col justify-end"
        @click.stop
      >
        <!-- Top gradient + info -->
        <div class="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent p-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold">{{ title }}</h2>
              <p v-if="subtitle" class="text-xs text-vault-muted">{{ subtitle }}</p>
            </div>
            <button class="focusable p-2 rounded-lg hover:bg-white/10" @click="$emit('close')">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        <!-- Bottom controls -->
        <div class="bg-gradient-to-t from-black/80 to-transparent pt-16 pb-4 px-4">
          <!-- Progress bar -->
          <div class="relative h-1.5 bg-white/20 rounded-full mb-4 cursor-pointer group/progress" @click="onSeek">
            <div class="absolute inset-y-0 left-0 bg-vault-accent rounded-full transition-all" :style="{ width: `${player.progress.value}%` }" />
            <div
              class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-vault-accent rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
              :style="{ left: `calc(${player.progress.value}% - 8px)` }"
            />
          </div>

          <!-- Buttons row -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <button class="focusable p-1" @click="player.togglePlay()">
                <svg v-if="player.isPlaying.value" class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                <svg v-else class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              </button>

              <button class="focusable p-1 text-vault-muted hover:text-white" @click="player.seekRelative(-10)">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3C7.81 3 4 6.81 4 11.5h-3l4 4 4-4H6c0-3.59 2.91-6.5 6.5-6.5S19 7.91 19 11.5 16.09 18 12.5 18v2c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H11.5z" /></svg>
              </button>

              <button class="focusable p-1 text-vault-muted hover:text-white" @click="player.seekRelative(10)">
                <svg class="w-5 h-5 scale-x-[-1]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3C7.81 3 4 6.81 4 11.5h-3l4 4 4-4H6c0-3.59 2.91-6.5 6.5-6.5S19 7.91 19 11.5 16.09 18 12.5 18v2c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H11.5z" /></svg>
              </button>

              <button class="focusable p-1 text-vault-muted hover:text-white" @click="player.toggleMute()">
                <svg v-if="player.isMuted.value" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
                <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
              </button>

              <span class="text-xs text-vault-muted tabular-nums">
                {{ player.currentTimeFormatted.value }} / {{ player.durationFormatted.value }}
              </span>
            </div>

            <div class="flex items-center gap-3">
              <button class="focusable p-1 text-vault-muted hover:text-white" @click="player.toggleFullscreen(containerRef!)">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  src: string
  title?: string
  subtitle?: string
  resumeFrom?: number
}>()

const emit = defineEmits<{
  close: []
  ready: []
  progress: [time: number, duration: number]
}>()

const containerRef = ref<HTMLElement>()
const videoEl = ref<HTMLVideoElement>()
const player = usePlayer()
const loadError = ref('')

let hlsInstance: any = null

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

  const playerStore = usePlayerStore()

  if (playerStore.playbackType === 'hls' && playerStore.hlsPlaylist) {
    await startHls(playerStore.hlsPlaylist, playerStore.directUrl!)
  } else {
    playDirect(props.src)
  }

  window.addEventListener('keydown', player.handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', player.handleKeydown)
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

  player.onProgress(() => {}, 30000)
}

async function startHls(playlistUrl: string, directUrl: string) {
  const Hls = (await import('hls.js')).default

  if (!Hls.isSupported() || !videoEl.value) {
    playDirect(directUrl)
    return
  }

  const hls = new Hls({
    maxBufferLength: 60,
    maxMaxBufferLength: 120,
  })
  hlsInstance = hls

  hls.loadSource(playlistUrl)
  hls.attachMedia(videoEl.value)

  hls.on(Hls.Events.MANIFEST_PARSED, () => {
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
      // Fall back to direct playback
      playDirect(directUrl)
    }
  })

  player.onProgress(() => {}, 30000)
}

function onSeek(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = (e.clientX - rect.left) / rect.width
  player.seek(pct * player.duration.value)
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
