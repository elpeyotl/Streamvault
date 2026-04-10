<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-semibold">Available Streams</h3>
      <div class="flex items-center gap-3">
        <!-- Validation progress -->
        <div v-if="validation.isValidating.value" class="flex items-center gap-2 text-xs text-vault-muted">
          <div class="w-3 h-3 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
          <span>Checking {{ validation.validationProgress.value.done }}/{{ validation.validationProgress.value.total }}</span>
        </div>
        <!-- Validation summary -->
        <div v-else-if="validation.validationProgress.value.done > 0" class="flex items-center gap-2 text-xs">
          <span class="text-vault-success">{{ validation.validationProgress.value.verified }} verified</span>
          <span v-if="validation.validationProgress.value.dead > 0" class="text-vault-error">{{ validation.validationProgress.value.dead }} dead</span>
        </div>
        <span v-if="stats" class="text-xs text-vault-muted">
          {{ stats.cachedCount }} cached / {{ stats.totalFound }} found
        </span>
      </div>
    </div>

    <!-- Auto-play banner -->
    <div
      v-if="validation.bestStream.value && !loading"
      class="flex items-center gap-4 px-4 py-3 rounded-xl bg-vault-accent/10 border border-vault-accent/30 mb-3"
    >
      <span class="text-vault-accent text-sm font-medium">Best stream ready</span>
      <span class="text-xs text-vault-muted flex-1 truncate">{{ validation.bestStream.value.title }}</span>
      <span v-if="validation.bestStream.value.validatedSpeed" class="text-xs text-vault-success">
        {{ validation.bestStream.value.validatedSpeed }} MB/s
      </span>
      <button
        class="focusable flex items-center gap-1.5 px-4 py-1.5 bg-vault-accent text-vault-bg rounded-lg text-sm font-semibold hover:bg-vault-accent-hover transition-colors"
        @click="$emit('playVerified', validation.bestStream.value)"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        Play
      </button>
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
    <div v-else-if="displayStreams.length > 0" class="space-y-2">
      <button
        v-for="stream in displayStreams"
        :key="stream.hash"
        class="focusable w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-all"
        :class="streamRowClass(stream)"
        data-focusable
        @click="onStreamClick(stream)"
      >
        <!-- Validation status indicator -->
        <div class="flex-shrink-0 w-6 flex justify-center">
          <!-- Verified -->
          <svg v-if="stream.validationStatus === 'verified'" class="w-5 h-5 text-vault-success" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
          <!-- Checking -->
          <div v-else-if="stream.validationStatus === 'checking'" class="w-4 h-4 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
          <!-- Pending (unchecked) -->
          <svg v-else-if="stream.validationStatus === 'pending'" class="w-5 h-5 text-vault-muted/40" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
          </svg>
          <!-- Dead -->
          <svg v-else-if="stream.validationStatus === 'dead'" class="w-5 h-5 text-vault-error/60" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
          </svg>
        </div>

        <!-- Quality badge -->
        <span class="flex-shrink-0 px-2 py-1 rounded text-xs font-bold" :class="qualityColor(stream.quality)">
          {{ qualityLabel(stream.quality) }}
        </span>

        <!-- Title & info -->
        <div class="flex-1 min-w-0">
          <p class="text-sm truncate" :class="{ 'line-through opacity-40': stream.validationStatus === 'dead' }">
            {{ stream.title }}
          </p>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-xs text-vault-muted">{{ formatSize(stream.size) }}</span>
            <span v-for="lang in stream.languages" :key="lang" class="text-xs text-vault-muted bg-vault-bg px-1.5 py-0.5 rounded">
              {{ lang.toUpperCase() }}
            </span>
            <span class="text-xs text-vault-muted/50">{{ stream.source }}</span>
            <!-- Speed badge for verified streams -->
            <span v-if="stream.validatedSpeed" class="text-xs text-vault-success font-medium">
              {{ stream.validatedSpeed }} MB/s
            </span>
            <!-- Error message for dead streams -->
            <span v-if="stream.validationStatus === 'dead' && stream.validationError" class="text-xs text-vault-error/60 truncate max-w-[200px]">
              {{ stream.validationError }}
            </span>
          </div>
        </div>

        <!-- Right side: play or re-check -->
        <div class="flex-shrink-0 flex items-center gap-2">
          <!-- Re-check button for dead streams -->
          <button
            v-if="stream.validationStatus === 'dead'"
            class="focusable p-1.5 rounded-lg text-vault-muted hover:text-vault-text hover:bg-vault-surface-light"
            title="Re-check"
            @click.stop="$emit('revalidate', stream.hash)"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
            </svg>
          </button>
          <!-- Play icon for playable streams -->
          <svg v-if="stream.validationStatus !== 'dead'" class="w-5 h-5 text-vault-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </button>
    </div>

    <!-- Show dead streams toggle -->
    <button
      v-if="hiddenDeadCount > 0"
      class="text-xs text-vault-muted hover:text-vault-text transition-colors"
      @click="showDead = !showDead"
    >
      {{ showDead ? 'Hide' : 'Show' }} {{ hiddenDeadCount }} dead stream{{ hiddenDeadCount > 1 ? 's' : '' }}
    </button>

    <!-- Empty -->
    <div v-if="!loading && displayStreams.length === 0 && !error" class="py-8 text-center text-vault-muted text-sm">
      No cached streams available. Try a different title or check your Real-Debrid token.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AvailableStream } from '~/types/stream'
import type { ValidatedStream, ValidationStatus } from '~/composables/useStreamValidation'
import { qualityLabel, qualityColor } from '~/utils/quality'

const props = defineProps<{
  streams: AvailableStream[]
  loading?: boolean
  error?: string | null
  stats?: { totalFound: number; cachedCount: number } | null
}>()

const emit = defineEmits<{
  select: [stream: AvailableStream]
  playVerified: [stream: ValidatedStream]
  revalidate: [hash: string]
}>()

const validation = useStreamValidation()
const { token } = useRealDebrid()
const showDead = ref(false)

// When streams arrive, init validation and start background checks
watch(() => props.streams, (newStreams) => {
  if (newStreams.length > 0) {
    validation.initStreams(newStreams)
    if (token.value) {
      validation.startValidation(newStreams, token.value, 5)
    }
  }
}, { immediate: true })

// Clean up SSE connection on unmount
onUnmounted(() => {
  validation.stopValidation()
})

// Sort: verified first, then pending/checking, dead last
const displayStreams = computed(() => {
  const sorted = validation.sortedStreams.value
  if (showDead.value) return sorted
  return sorted.filter(s => s.validationStatus !== 'dead')
})

const hiddenDeadCount = computed(() => {
  return validation.sortedStreams.value.filter(s => s.validationStatus === 'dead').length
})

function streamRowClass(stream: ValidatedStream): string {
  const base = 'bg-vault-surface'
  switch (stream.validationStatus) {
    case 'verified':
      return `${base} border-vault-success/30 hover:border-vault-success/50`
    case 'checking':
      return `${base} border-vault-accent/20 hover:border-vault-accent/40`
    case 'dead':
      return `${base} border-vault-error/20 opacity-60 hover:opacity-80 hover:border-vault-error/40`
    default:
      return `${base} border-vault-border/50 hover:border-vault-accent/30`
  }
}

function onStreamClick(stream: ValidatedStream) {
  // If verified with pre-resolved URL, use that directly
  if (stream.validationStatus === 'verified' && stream.validatedUrl) {
    emit('playVerified', stream)
  } else {
    // For pending, checking, or dead streams — resolve fresh
    emit('select', stream)
  }
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(1)} GB`
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}
</script>
