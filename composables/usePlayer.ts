export function usePlayer() {
  const videoRef = ref<HTMLVideoElement | null>(null)
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(1)
  const isMuted = ref(false)
  const isFullscreen = ref(false)
  const isBuffering = ref(false)
  const showControls = ref(true)

  let controlsTimeout: ReturnType<typeof setTimeout> | null = null
  let progressInterval: ReturnType<typeof setInterval> | null = null
  let hasKnownDuration = false
  let onCloseCallback: (() => void) | null = null

  function bindVideo(el: HTMLVideoElement) {
    videoRef.value = el

    el.addEventListener('play', () => { isPlaying.value = true })
    el.addEventListener('pause', () => { isPlaying.value = false })
    el.addEventListener('timeupdate', () => { currentTime.value = el.currentTime })
    el.addEventListener('durationchange', () => {
      // Don't override known duration from ffprobe
      if (!hasKnownDuration && isFinite(el.duration)) {
        duration.value = el.duration
      }
    })
    el.addEventListener('volumechange', () => {
      volume.value = el.volume
      isMuted.value = el.muted
    })
    el.addEventListener('waiting', () => { isBuffering.value = true })
    el.addEventListener('playing', () => { isBuffering.value = false })
    el.addEventListener('ended', () => { isPlaying.value = false })
  }

  function play() { videoRef.value?.play() }
  function pause() { videoRef.value?.pause() }
  function togglePlay() { isPlaying.value ? pause() : play() }

  function seek(time: number) {
    if (videoRef.value) videoRef.value.currentTime = time
  }

  function seekRelative(seconds: number) {
    if (videoRef.value) {
      videoRef.value.currentTime = Math.max(0, Math.min(videoRef.value.currentTime + seconds, duration.value))
    }
  }

  function setVolume(v: number) {
    if (videoRef.value) videoRef.value.volume = Math.max(0, Math.min(1, v))
  }

  function toggleMute() {
    if (videoRef.value) videoRef.value.muted = !videoRef.value.muted
  }

  function toggleFullscreen(container?: HTMLElement) {
    const el = container || videoRef.value?.parentElement
    if (!el) return

    if (!document.fullscreenElement) {
      el.requestFullscreen()
      isFullscreen.value = true
    } else {
      document.exitFullscreen()
      isFullscreen.value = false
    }
  }

  function showControlsTemporarily(ms = 3000) {
    showControls.value = true
    if (controlsTimeout) clearTimeout(controlsTimeout)
    controlsTimeout = setTimeout(() => {
      if (isPlaying.value) showControls.value = false
    }, ms)
  }

  // Progress as percentage
  const progress = computed(() => {
    if (!duration.value) return 0
    return (currentTime.value / duration.value) * 100
  })

  // Formatted times
  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const currentTimeFormatted = computed(() => formatTime(currentTime.value))
  const durationFormatted = computed(() => formatTime(duration.value))

  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault()
        togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        seekRelative(-10)
        break
      case 'ArrowRight':
        e.preventDefault()
        seekRelative(10)
        break
      case 'ArrowUp':
        e.preventDefault()
        setVolume(volume.value + 0.1)
        break
      case 'ArrowDown':
        e.preventDefault()
        setVolume(volume.value - 0.1)
        break
      case 'f':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'm':
        e.preventDefault()
        toggleMute()
        break
      case 'Escape':
        if (isFullscreen.value) {
          document.exitFullscreen()
          isFullscreen.value = false
        } else if (onCloseCallback) {
          onCloseCallback()
        }
        break
    }
    showControlsTemporarily()
  }

  // Start saving progress callback
  function onProgress(callback: (time: number, dur: number) => void, intervalMs = 30000) {
    if (progressInterval) clearInterval(progressInterval)
    progressInterval = setInterval(() => {
      if (isPlaying.value && currentTime.value > 0) {
        callback(currentTime.value, duration.value)
      }
    }, intervalMs)
  }

  function onClose(cb: () => void) {
    onCloseCallback = cb
  }

  function setKnownDuration(d: number) {
    if (d > 0) {
      duration.value = d
      hasKnownDuration = true
    }
  }

  function cleanup() {
    if (controlsTimeout) clearTimeout(controlsTimeout)
    if (progressInterval) clearInterval(progressInterval)
  }

  return {
    videoRef,
    isPlaying: readonly(isPlaying),
    currentTime: readonly(currentTime),
    duration: readonly(duration),
    volume: readonly(volume),
    isMuted: readonly(isMuted),
    isFullscreen: readonly(isFullscreen),
    isBuffering: readonly(isBuffering),
    showControls,
    progress,
    currentTimeFormatted,
    durationFormatted,
    bindVideo,
    play,
    pause,
    togglePlay,
    seek,
    seekRelative,
    setVolume,
    toggleMute,
    toggleFullscreen,
    showControlsTemporarily,
    handleKeydown,
    formatTime,
    setKnownDuration,
    onClose,
    onProgress,
    cleanup,
  }
}
