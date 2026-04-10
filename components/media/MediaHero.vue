<template>
  <div class="relative -mt-16">
    <!-- Backdrop -->
    <div class="relative h-[50vh] min-h-[400px] overflow-hidden">
      <img
        v-if="backdrop"
        :src="backdrop"
        :alt="title"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full bg-vault-surface" />
      <div class="absolute inset-0 hero-gradient" />
    </div>

    <!-- Content -->
    <div class="absolute bottom-0 left-0 right-0 px-6 pb-8">
      <div class="max-w-5xl mx-auto flex gap-6 items-end">
        <!-- Poster (desktop) -->
        <div class="hidden md:block flex-shrink-0">
          <img
            v-if="posterSrc"
            :src="posterSrc"
            :alt="title"
            class="w-44 rounded-xl shadow-2xl"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <h1 class="text-3xl sm:text-4xl font-bold mb-2">{{ title }}</h1>
          <p v-if="tagline" class="text-vault-muted italic mb-3">{{ tagline }}</p>

          <div class="flex flex-wrap items-center gap-3 mb-4 text-sm">
            <span v-if="year" class="text-vault-muted">{{ year }}</span>
            <span v-if="runtime" class="text-vault-muted">{{ formatRuntime(runtime) }}</span>
            <span v-if="rating" class="flex items-center gap-1 text-vault-accent">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
              {{ rating.toFixed(1) }}
            </span>
            <span v-for="genre in genres" :key="genre" class="px-2 py-0.5 rounded-full bg-vault-surface-light text-vault-muted text-xs">
              {{ genre }}
            </span>
          </div>

          <p v-if="overview" class="text-vault-muted text-sm leading-relaxed max-w-2xl line-clamp-3 mb-4">
            {{ overview }}
          </p>

          <!-- Languages -->
          <div v-if="languages.length" class="flex flex-wrap gap-2 mb-4">
            <span v-for="lang in languages" :key="lang" class="text-xs text-vault-muted bg-vault-surface-light px-2 py-1 rounded">
              {{ lang }}
            </span>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-3">
            <button
              class="focusable flex items-center gap-2 px-6 py-3 bg-vault-accent text-vault-bg font-semibold rounded-xl hover:bg-vault-accent-hover transition-colors"
              @click="$emit('play')"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Play
            </button>
            <button
              class="focusable flex items-center gap-2 px-5 py-3 bg-vault-surface-light text-vault-text rounded-xl hover:bg-vault-border transition-colors"
              @click="$emit('addToWatchlist')"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
              Watchlist
            </button>
            <button
              class="focusable flex items-center gap-2 px-5 py-3 bg-vault-surface-light text-vault-text rounded-xl hover:bg-vault-border transition-colors"
              @click="$emit('addToPlaylist')"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h12" /></svg>
              Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  overview?: string
  tagline?: string
  backdropPath: string | null
  posterPath: string | null
  year?: string
  runtime?: number
  rating?: number
  genres?: string[]
  languages?: string[]
}>()

defineEmits<{
  play: []
  addToWatchlist: []
  addToPlaylist: []
}>()

const { posterUrl, backdropUrl } = useTMDB()
const backdrop = computed(() => backdropUrl(props.backdropPath))
const posterSrc = computed(() => posterUrl(props.posterPath, 'w500'))

function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
</script>
