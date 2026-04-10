<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold">Available Streams</h3>
      <span v-if="stats" class="text-xs text-vault-muted">
        {{ stats.cachedCount }} cached / {{ stats.totalFound }} found
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-3 py-8 justify-center text-vault-muted">
      <div class="w-5 h-5 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
      <span class="text-sm">Searching streams...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-4 px-4 bg-vault-error/10 border border-vault-error/20 rounded-xl text-vault-error text-sm">
      {{ error }}
    </div>

    <!-- Stream list -->
    <div v-else-if="sortedStreams.length > 0" class="space-y-2">
      <div
        v-for="(stream, idx) in sortedStreams"
        :key="stream.hash + '-' + idx"
        class="focusable w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer"
        :class="streamRowClass(stream.hash)"
        role="button"
        tabindex="0"
        data-focusable
        @click="onStreamClick(stream)"
      >
        <!-- Status indicator -->
        <div class="flex-shrink-0 w-6 flex justify-center">
          <div v-if="resolving === stream.hash" class="w-4 h-4 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
          <svg v-else-if="failedHash === stream.hash" class="w-5 h-5 text-vault-error/60" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
          </svg>
          <svg v-else class="w-5 h-5 text-vault-accent/50" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>

        <!-- Quality badge -->
        <span class="flex-shrink-0 px-2 py-1 rounded text-xs font-bold" :class="qualityColor(stream.quality)">
          {{ qualityLabel(stream.quality) }}
        </span>

        <!-- Language badges -->
        <div class="flex-shrink-0 flex gap-1">
          <span
            v-for="lang in stream.languages"
            :key="lang"
            class="px-1.5 py-0.5 rounded text-[10px] font-medium"
            :class="isPreferredLang(lang) ? 'bg-vault-accent/20 text-vault-accent' : 'bg-vault-bg text-vault-muted'"
          >
            {{ lang.toUpperCase() }}
          </span>
        </div>

        <!-- Title & info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm truncate">{{ stream.title }}</p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-vault-muted">{{ formatSize(stream.size) }}</span>
            <span class="text-xs text-vault-muted/50">{{ stream.source }}</span>
            <span v-if="failedHash === stream.hash && failedError" class="text-xs text-vault-error/70 truncate max-w-[250px]">
              {{ failedError }}
            </span>
          </div>
        </div>

        <!-- Play arrow -->
        <div class="flex-shrink-0">
          <svg v-if="resolving !== stream.hash" class="w-5 h-5 text-vault-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="!loading && streams.length === 0 && !error" class="py-8 text-center text-vault-muted text-sm">
      No cached streams available. Try a different title or check your Real-Debrid token.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AvailableStream } from '~/types/stream'
import { qualityLabel, qualityColor } from '~/utils/quality'

const props = defineProps<{
  streams: AvailableStream[]
  loading?: boolean
  error?: string | null
  stats?: { totalFound: number; cachedCount: number } | null
}>()

const emit = defineEmits<{
  play: [data: { url: string; filename: string; stream: AvailableStream }]
}>()

const { resolveStream } = useRealDebrid()
const preferences = usePreferencesStore()
const resolving = ref<string | null>(null)
const failedHash = ref<string | null>(null)
const failedError = ref<string | null>(null)

const qualityScores: Record<string, number> = {
  '4k': 4, '2160p': 4, '1080p': 3, '720p': 2, '480p': 1, 'unknown': 0,
}

function isPreferredLang(lang: string): boolean {
  return preferences.preferredLanguages.includes(lang) || lang === 'multi'
}

// Sort: preferred language first, then quality, then size
const sortedStreams = computed(() => {
  return [...props.streams].sort((a, b) => {
    const langA = a.languages.some(l => isPreferredLang(l)) ? 1 : 0
    const langB = b.languages.some(l => isPreferredLang(l)) ? 1 : 0
    if (langA !== langB) return langB - langA

    const qA = qualityScores[a.quality] ?? 0
    const qB = qualityScores[b.quality] ?? 0
    if (qA !== qB) return qB - qA

    return b.size - a.size
  })
})

async function onStreamClick(stream: AvailableStream) {
  if (resolving.value) return

  resolving.value = stream.hash
  failedHash.value = null
  failedError.value = null

  try {
    const result = await resolveStream(stream.hash)
    emit('play', { url: result.url, filename: result.filename, stream })
  } catch (e: any) {
    failedHash.value = stream.hash
    failedError.value = e.data?.message || e.message || 'Failed to resolve stream'
  } finally {
    resolving.value = null
  }
}

function streamRowClass(hash: string): string {
  const base = 'bg-vault-surface'
  if (resolving.value === hash) return `${base} border-vault-accent/30`
  if (failedHash.value === hash) return `${base} border-vault-error/30`
  return `${base} border-vault-border/50 hover:border-vault-accent/30`
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}
</script>

