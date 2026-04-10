<template>
  <div>
    <div v-if="label" class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold">{{ label }}</h2>
      <slot name="header-right" />
    </div>

    <!-- Horizontal scroll mode -->
    <div v-if="horizontal" class="scroll-row">
      <MediaCard
        v-for="item in items"
        :key="`${item.mediaType}-${item.tmdbId}`"
        :tmdb-id="item.tmdbId"
        :media-type="item.mediaType"
        :title="item.title"
        :poster-path="item.posterPath"
        :year="item.year"
        :rating="item.rating"
        :progress="item.progress"
        class="w-36 sm:w-44"
      />
    </div>

    <!-- Grid mode -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <MediaCard
        v-for="item in items"
        :key="`${item.mediaType}-${item.tmdbId}`"
        :tmdb-id="item.tmdbId"
        :media-type="item.mediaType"
        :title="item.title"
        :poster-path="item.posterPath"
        :year="item.year"
        :rating="item.rating"
        :progress="item.progress"
      />
    </div>

    <!-- Empty state -->
    <div v-if="items.length === 0 && !loading" class="py-16 text-center text-vault-muted">
      <p>{{ emptyText || 'Nothing found' }}</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-8 flex justify-center">
      <div class="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface GridItem {
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  year?: string
  rating?: number
  progress?: number
}

defineProps<{
  items: GridItem[]
  label?: string
  horizontal?: boolean
  loading?: boolean
  emptyText?: string
}>()
</script>
