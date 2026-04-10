<template>
  <div
    class="absolute inset-0 flex flex-col justify-between select-none"
    :class="{ 'cursor-none': !visible }"
    @click.stop
  >
    <!-- Top bar -->
    <div
      class="p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300"
      :class="visible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <div class="flex items-center justify-between">
        <div class="flex-1 min-w-0 mr-4">
          <h2 class="text-sm font-semibold truncate">{{ title }}</h2>
          <p v-if="subtitle" class="text-xs text-vault-muted truncate">{{ subtitle }}</p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Quality / codec badge -->
          <div v-if="quality" class="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded text-[10px] font-medium text-vault-muted">
            <span>{{ quality }}</span>
            <span v-if="videoCodec" class="opacity-60">{{ videoCodec.toUpperCase() }}</span>
          </div>

          <!-- Close -->
          <button class="focusable p-2 rounded-lg hover:bg-white/10" @click="$emit('close')">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Center play button (shown when paused) -->
    <div
      class="flex-1 flex items-center justify-center transition-opacity duration-200"
      :class="!player.isPlaying.value && visible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <button class="focusable w-20 h-20 rounded-full bg-vault-accent/90 flex items-center justify-center hover:bg-vault-accent transition-colors" @click="player.togglePlay()">
        <svg class="w-10 h-10 text-vault-bg ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </button>
    </div>

    <!-- Bottom controls -->
    <div
      class="bg-gradient-to-t from-black/80 to-transparent pt-12 pb-4 px-4 transition-opacity duration-300"
      :class="visible ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <!-- Seek bar -->
      <div
        ref="seekBarRef"
        class="relative h-1 bg-white/20 rounded-full mb-4 cursor-pointer group/seek"
        @mousedown="onSeekStart"
        @mousemove="onSeekHover"
        @mouseleave="seekHoverPct = -1"
      >
        <!-- Buffered range -->
        <div class="absolute inset-y-0 left-0 bg-white/20 rounded-full" :style="{ width: `${bufferedPct}%` }" />
        <!-- Played range -->
        <div class="absolute inset-y-0 left-0 bg-vault-accent rounded-full" :style="{ width: `${seekDragging ? seekDragPct : player.progress.value}%` }" />
        <!-- Hover indicator -->
        <div
          v-if="seekHoverPct >= 0"
          class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-50"
          :style="{ left: `calc(${seekHoverPct}% - 6px)` }"
        />
        <!-- Scrubber handle -->
        <div
          class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-vault-accent rounded-full shadow-lg scale-0 group-hover/seek:scale-100 transition-transform"
          :style="{ left: `calc(${seekDragging ? seekDragPct : player.progress.value}% - 8px)` }"
        />
        <!-- Hover time tooltip -->
        <div
          v-if="seekHoverPct >= 0 && player.duration.value > 0"
          class="absolute -top-8 px-1.5 py-0.5 bg-black/90 rounded text-[10px] text-white tabular-nums -translate-x-1/2"
          :style="{ left: `${seekHoverPct}%` }"
        >
          {{ player.formatTime(seekHoverPct / 100 * player.duration.value) }}
        </div>
        <!-- Expand hit area -->
        <div class="absolute -inset-y-2 inset-x-0" />
      </div>

      <!-- Button row -->
      <div class="flex items-center justify-between">
        <!-- Left controls -->
        <div class="flex items-center gap-3">
          <!-- Play/Pause -->
          <button class="focusable p-1.5 rounded-lg hover:bg-white/10" @click="player.togglePlay()">
            <svg v-if="player.isPlaying.value" class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
            <svg v-else class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </button>

          <!-- Skip back -->
          <button class="focusable p-1.5 rounded-lg hover:bg-white/10 text-vault-muted hover:text-white" @click="player.seekRelative(-10)">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3C7.81 3 4 6.81 4 11.5h-3l4 4 4-4H6c0-3.59 2.91-6.5 6.5-6.5S19 7.91 19 11.5 16.09 18 12.5 18v2c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H11.5z" /></svg>
          </button>

          <!-- Skip forward -->
          <button class="focusable p-1.5 rounded-lg hover:bg-white/10 text-vault-muted hover:text-white" @click="player.seekRelative(10)">
            <svg class="w-5 h-5 scale-x-[-1]" viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 3C7.81 3 4 6.81 4 11.5h-3l4 4 4-4H6c0-3.59 2.91-6.5 6.5-6.5S19 7.91 19 11.5 16.09 18 12.5 18v2c4.69 0 8.5-3.81 8.5-8.5S17.19 3 12.5 3zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H11.5z" /></svg>
          </button>

          <!-- Volume -->
          <div class="flex items-center gap-1 group/vol">
            <button class="focusable p-1.5 rounded-lg hover:bg-white/10 text-vault-muted hover:text-white" @click="player.toggleMute()">
              <svg v-if="player.isMuted.value || player.volume.value === 0" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" /></svg>
              <svg v-else class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              :value="player.isMuted.value ? 0 : player.volume.value"
              class="w-0 group-hover/vol:w-20 transition-all duration-200 accent-vault-accent h-1 cursor-pointer opacity-0 group-hover/vol:opacity-100"
              @input="onVolumeInput"
            />
          </div>

          <!-- Time -->
          <span class="text-xs text-vault-muted tabular-nums ml-1">
            {{ player.currentTimeFormatted.value }}
            <span class="opacity-50">/</span>
            {{ player.durationFormatted.value }}
          </span>
        </div>

        <!-- Right controls -->
        <div class="flex items-center gap-1">
          <!-- Subtitles -->
          <div v-if="subtitles.length > 0" class="relative">
            <button
              class="focusable p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              :class="activeSubtitle ? 'text-vault-accent' : 'text-vault-muted hover:text-white'"
              @click="showSubMenu = showSubMenu === 'subs' ? null : 'subs'"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10 0h2v2h-2v-2zm-6-4h8v2h-8v-2z" /></svg>
            </button>
            <!-- Subtitle picker -->
            <div
              v-if="showSubMenu === 'subs'"
              class="absolute bottom-full right-0 mb-2 w-56 max-h-64 overflow-y-auto bg-vault-surface/95 backdrop-blur-lg border border-vault-border rounded-xl shadow-2xl p-1"
            >
              <button
                class="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors"
                :class="!activeSubtitle ? 'text-vault-accent' : 'text-vault-muted'"
                @click="$emit('selectSubtitle', null); showSubMenu = null"
              >
                Off
              </button>
              <button
                v-for="sub in subtitles"
                :key="sub.id"
                class="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors flex items-center justify-between"
                :class="activeSubtitle === sub.id ? 'text-vault-accent' : 'text-vault-text'"
                @click="$emit('selectSubtitle', sub.id); showSubMenu = null"
              >
                <span>{{ sub.languageName }}</span>
                <span v-if="sub.hearingImpaired" class="text-[10px] text-vault-muted">CC</span>
              </button>
            </div>
          </div>

          <!-- Audio tracks -->
          <div v-if="audioTracks.length > 1" class="relative">
            <button
              class="focusable p-1.5 rounded-lg text-vault-muted hover:text-white hover:bg-white/10"
              @click="showSubMenu = showSubMenu === 'audio' ? null : 'audio'"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
            </button>
            <div
              v-if="showSubMenu === 'audio'"
              class="absolute bottom-full right-0 mb-2 w-56 max-h-64 overflow-y-auto bg-vault-surface/95 backdrop-blur-lg border border-vault-border rounded-xl shadow-2xl p-1"
            >
              <button
                v-for="track in audioTracks"
                :key="track.index"
                class="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors"
                :class="activeAudioTrack === track.index ? 'text-vault-accent' : 'text-vault-text'"
                @click="$emit('selectAudioTrack', track.index); showSubMenu = null"
              >
                <span>{{ formatAudioTrack(track) }}</span>
              </button>
            </div>
          </div>

          <!-- Fullscreen -->
          <button class="focusable p-1.5 rounded-lg text-vault-muted hover:text-white hover:bg-white/10" @click="$emit('toggleFullscreen')">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SubtitleResult } from '~/server/utils/subtitles'

const props = defineProps<{
  player: ReturnType<typeof usePlayer>
  visible: boolean
  title?: string
  subtitle?: string
  quality?: string
  videoCodec?: string
  subtitles: SubtitleResult[]
  activeSubtitle: string | null
  audioTracks: { index: number; language: string; codec: string; title: string; channels: number; isDefault: boolean }[]
  activeAudioTrack: number
}>()

defineEmits<{
  close: []
  selectSubtitle: [id: string | null]
  selectAudioTrack: [index: number]
  toggleFullscreen: []
}>()

const seekBarRef = ref<HTMLElement>()
const seekHoverPct = ref(-1)
const seekDragging = ref(false)
const seekDragPct = ref(0)
const showSubMenu = ref<'subs' | 'audio' | null>(null)

// Buffered percentage
const bufferedPct = computed(() => {
  const video = props.player.videoRef.value
  if (!video || !video.buffered.length || !props.player.duration.value) return 0
  const end = video.buffered.end(video.buffered.length - 1)
  return (end / props.player.duration.value) * 100
})

function getSeekPct(e: MouseEvent): number {
  if (!seekBarRef.value) return 0
  const rect = seekBarRef.value.getBoundingClientRect()
  return Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
}

function onSeekHover(e: MouseEvent) {
  if (!seekDragging.value) {
    seekHoverPct.value = getSeekPct(e)
  }
}

function onSeekStart(e: MouseEvent) {
  seekDragging.value = true
  seekDragPct.value = getSeekPct(e)

  const onMove = (e: MouseEvent) => {
    seekDragPct.value = getSeekPct(e)
  }

  const onUp = (e: MouseEvent) => {
    const pct = getSeekPct(e)
    props.player.seek(pct / 100 * props.player.duration.value)
    seekDragging.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }

  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onVolumeInput(e: Event) {
  const val = parseFloat((e.target as HTMLInputElement).value)
  props.player.setVolume(val)
  if (val > 0 && props.player.isMuted.value) {
    props.player.toggleMute()
  }
}

function formatAudioTrack(track: { language: string; codec: string; title: string; channels: number }): string {
  const lang = track.language === 'und' ? 'Unknown' : track.language.toUpperCase()
  const ch = track.channels > 2 ? ` ${track.channels}.1` : ''
  const title = track.title ? ` - ${track.title}` : ''
  return `${lang}${ch}${title}`
}
</script>
