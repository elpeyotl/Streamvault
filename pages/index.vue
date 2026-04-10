<template>
  <div class="px-6 py-8 max-w-[1600px] mx-auto space-y-10">
    <!-- Continue Watching -->
    <MediaGrid
      v-if="continueWatching.length"
      :items="continueWatching"
      label="Continue Watching"
      horizontal
    />

    <!-- Trending Movies -->
    <MediaGrid
      :items="trendingMovies"
      label="Trending Movies"
      horizontal
      :loading="loadingMovies"
    />

    <!-- Trending TV -->
    <MediaGrid
      :items="trendingTV"
      label="Trending TV Shows"
      horizontal
      :loading="loadingTV"
    />

    <!-- Watchlist -->
    <MediaGrid
      v-if="watchlistItems.length"
      :items="watchlistItems"
      label="Your Watchlist"
      horizontal
    />
  </div>
</template>

<script setup lang="ts">
import type { GridItem } from '~/components/media/MediaGrid.vue'
import type { TMDBMovie, TMDBTVShow } from '~/types/tmdb'

const { trending, isMovie, getTitle, getYear } = useTMDB()
const { getContinueWatching } = useWatchHistory()
const { getWatchlist } = usePlaylists()

const trendingMovies = ref<GridItem[]>([])
const trendingTV = ref<GridItem[]>([])
const continueWatching = ref<GridItem[]>([])
const watchlistItems = ref<GridItem[]>([])
const loadingMovies = ref(true)
const loadingTV = ref(true)

function mapToGridItem(item: TMDBMovie | TMDBTVShow): GridItem {
  const movie = isMovie(item)
  return {
    tmdbId: item.id,
    mediaType: movie ? 'movie' : 'tv',
    title: getTitle(item),
    posterPath: item.poster_path,
    year: getYear(item),
    rating: item.vote_average,
  }
}

onMounted(async () => {
  // Load trending
  const [movies, tv] = await Promise.all([
    trending('movie', 'week').catch(() => ({ results: [] })),
    trending('tv', 'week').catch(() => ({ results: [] })),
  ])

  trendingMovies.value = movies.results.slice(0, 20).map(mapToGridItem)
  loadingMovies.value = false

  trendingTV.value = tv.results.slice(0, 20).map(mapToGridItem)
  loadingTV.value = false

  // Load continue watching
  try {
    const history = await getContinueWatching(10)
    continueWatching.value = history.map(h => ({
      tmdbId: h.tmdb_id || h.tmdbId,
      mediaType: (h.media_type || h.mediaType) as 'movie' | 'tv',
      title: h.title || `ID: ${h.tmdb_id || h.tmdbId}`,
      posterPath: h.posterPath || null,
      progress: h.duration_seconds ? (h.progress_seconds / h.duration_seconds) * 100 : 0,
    }))
  } catch { /* not logged in */ }

  // Load watchlist
  try {
    const wl = await getWatchlist()
    watchlistItems.value = wl.map((w: any) => ({
      tmdbId: w.tmdb_id,
      mediaType: w.media_type,
      title: w.title || `ID: ${w.tmdb_id}`,
      posterPath: w.posterPath || null,
    }))
  } catch { /* not logged in */ }
})
</script>
