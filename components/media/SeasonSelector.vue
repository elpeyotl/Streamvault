<template>
  <div>
    <!-- Season tabs -->
    <div class="flex gap-2 mb-4 overflow-x-auto pb-2">
      <button
        v-for="season in seasons"
        :key="season.seasonNumber"
        class="focusable px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
        :class="selectedSeason === season.seasonNumber
          ? 'bg-vault-accent text-vault-bg'
          : 'bg-vault-surface text-vault-muted hover:text-vault-text'"
        @click="$emit('selectSeason', season.seasonNumber)"
      >
        {{ season.name || `Season ${season.seasonNumber}` }}
      </button>
    </div>

    <!-- Episodes -->
    <div v-if="episodes.length" class="space-y-2">
      <NuxtLink
        v-for="ep in episodes"
        :key="ep.episodeNumber"
        :to="`/tv/${props.showId}/${props.selectedSeason}/${ep.episodeNumber}`"
        class="focusable w-full text-left flex gap-4 p-3 rounded-xl bg-vault-surface hover:bg-vault-surface-light border border-vault-border/50 hover:border-vault-accent/30 transition-all"
        data-focusable
      >
        <!-- Episode still -->
        <div class="flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-vault-surface-light">
          <img v-if="ep.stillPath" :src="stillUrl(ep.stillPath)" :alt="ep.name" class="w-full h-full object-cover" loading="lazy" />
          <div v-else class="w-full h-full flex items-center justify-center text-vault-border">
            <span class="text-2xl font-bold">{{ ep.episodeNumber }}</span>
          </div>
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs text-vault-accent font-medium">E{{ ep.episodeNumber }}</span>
            <h4 class="text-sm font-semibold truncate">{{ ep.name }}</h4>
          </div>
          <p v-if="ep.overview" class="text-xs text-vault-muted line-clamp-2">{{ ep.overview }}</p>
          <div class="flex items-center gap-3 mt-2 text-xs text-vault-muted">
            <span v-if="ep.runtime">{{ ep.runtime }}m</span>
            <span v-if="ep.airDate">{{ ep.airDate }}</span>
            <span v-if="ep.voteAverage" class="text-vault-accent">★ {{ ep.voteAverage.toFixed(1) }}</span>
          </div>
        </div>

        <!-- Play icon -->
        <div class="flex-shrink-0 self-center">
          <svg class="w-8 h-8 text-vault-accent/60" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </div>
      </NuxtLink>
    </div>

    <div v-else class="py-8 text-center text-vault-muted text-sm">
      No episodes available for this season.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SeasonInfo, EpisodeInfo } from '~/types/media'

const props = defineProps<{
  seasons: SeasonInfo[]
  episodes: EpisodeInfo[]
  selectedSeason: number
  showId: number
}>()

defineEmits<{
  selectSeason: [seasonNumber: number]
}>()

const { posterUrl } = useTMDB()
function stillUrl(path: string | null) {
  if (!path) return null
  const config = useRuntimeConfig()
  return `${config.public.tmdbImageBase}/w300${path}`
}
</script>
