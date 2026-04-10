<template>
  <NuxtLink
    :to="linkTo"
    class="focusable group relative rounded-xl overflow-hidden bg-vault-surface cursor-pointer block"
    data-focusable
  >
    <!-- Poster -->
    <div class="aspect-[2/3] overflow-hidden">
      <img
        v-if="poster"
        :src="poster"
        :alt="title"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
        loading="lazy"
      />
      <div v-else class="w-full h-full bg-vault-surface-light flex items-center justify-center">
        <svg class="w-12 h-12 text-vault-border" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      </div>
    </div>

    <!-- Info overlay -->
    <div class="absolute bottom-0 left-0 right-0 card-gradient p-3 pt-12">
      <h3 class="text-sm font-semibold truncate">{{ title }}</h3>
      <div class="flex items-center gap-2 mt-1">
        <span v-if="year" class="text-xs text-vault-muted">{{ year }}</span>
        <span v-if="rating" class="text-xs text-vault-accent flex items-center gap-0.5">
          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
          {{ rating.toFixed(1) }}
        </span>
        <span class="text-xs text-vault-muted uppercase">{{ mediaType }}</span>
      </div>
    </div>

    <!-- Progress bar (if watching) -->
    <div v-if="progress > 0" class="absolute bottom-0 left-0 right-0 h-1 bg-vault-bg/50">
      <div class="h-full bg-vault-accent transition-all" :style="{ width: `${progress}%` }" />
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
const props = defineProps<{
  tmdbId: number
  mediaType: 'movie' | 'tv'
  title: string
  posterPath: string | null
  year?: string
  rating?: number
  progress?: number
}>()

const { posterUrl } = useTMDB()
const poster = computed(() => posterUrl(props.posterPath, 'w342'))
const linkTo = computed(() => `/${props.mediaType === 'movie' ? 'movie' : 'tv'}/${props.tmdbId}`)
</script>
