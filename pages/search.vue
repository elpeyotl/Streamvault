<template>
  <div class="px-6 py-8 max-w-[1600px] mx-auto">
    <!-- Filters -->
    <div class="flex items-center gap-4 mb-6">
      <h1 class="text-2xl font-bold">
        <span v-if="query">Results for "{{ query }}"</span>
        <span v-else>Search</span>
      </h1>
      <div class="flex gap-2 ml-auto">
        <button
          v-for="t in types"
          :key="t.value"
          class="focusable px-3 py-1.5 rounded-lg text-sm transition-colors"
          :class="searchType === t.value ? 'bg-vault-accent text-vault-bg' : 'bg-vault-surface text-vault-muted hover:text-vault-text'"
          @click="changeType(t.value)"
        >
          {{ t.label }}
        </button>
      </div>
    </div>

    <!-- Language filter -->
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="lang in quickLangs"
        :key="lang.code"
        class="focusable px-3 py-1 rounded-full text-xs transition-colors"
        :class="selectedLang === lang.code ? 'bg-vault-accent text-vault-bg' : 'bg-vault-surface-light text-vault-muted'"
        @click="toggleLang(lang.code)"
      >
        {{ lang.flag }} {{ lang.name }}
      </button>
    </div>

    <!-- Results -->
    <MediaGrid :items="gridItems" :loading="store.loading" empty-text="Start typing to search..." />

    <!-- Load more -->
    <div v-if="store.page < store.totalPages" class="mt-8 text-center">
      <button
        class="focusable px-6 py-2 bg-vault-surface text-vault-muted rounded-xl hover:text-vault-text transition-colors"
        @click="store.loadMore()"
      >
        Load more
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GridItem } from '~/components/media/MediaGrid.vue'

const route = useRoute()
const store = useSearchStore()
const { isMovie, getTitle, getYear } = useTMDB()

const searchType = ref<'movie' | 'tv' | 'multi'>('multi')
const selectedLang = ref<string | null>(null)

const types = [
  { value: 'multi' as const, label: 'All' },
  { value: 'movie' as const, label: 'Movies' },
  { value: 'tv' as const, label: 'TV Shows' },
]

const quickLangs = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
]

const query = computed(() => route.query.q as string || '')

const gridItems = computed<GridItem[]>(() => {
  let items = store.results
  if (selectedLang.value) {
    items = items.filter(i => i.original_language === selectedLang.value)
  }
  return items.map(item => ({
    tmdbId: item.id,
    mediaType: isMovie(item) ? 'movie' as const : 'tv' as const,
    title: getTitle(item),
    posterPath: item.poster_path,
    year: getYear(item),
    rating: item.vote_average,
  }))
})

function changeType(type: 'movie' | 'tv' | 'multi') {
  searchType.value = type
  if (query.value) store.search(query.value, type)
}

function toggleLang(code: string) {
  selectedLang.value = selectedLang.value === code ? null : code
}

// Watch query changes
watch(query, (q) => {
  if (q) store.search(q, searchType.value)
}, { immediate: true })
</script>
