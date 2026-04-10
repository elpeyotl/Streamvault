<template>
  <div v-if="movie">
    <MediaHero
      :title="movie.title"
      :overview="movie.overview"
      :tagline="movie.tagline"
      :backdrop-path="movie.backdrop_path"
      :poster-path="movie.poster_path"
      :year="movie.release_date?.substring(0, 4)"
      :runtime="movie.runtime"
      :rating="movie.vote_average"
      :genres="movie.genres?.map(g => g.name)"
      :languages="movie.spoken_languages?.map(l => l.english_name)"
      @play="onPlay"
      @add-to-watchlist="onAddToWatchlist"
      @add-to-playlist="showPlaylistModal = true"
    />

    <!-- Streams section -->
    <div class="px-6 py-8 max-w-5xl mx-auto">
      <StreamList
        :streams="resolver.streams.value"
        :loading="resolver.loading.value"
        :error="resolver.error.value"
        :stats="resolver.stats.value"
        @select="onStreamSelect"
        @play-verified="onPlayVerified"
        @revalidate="onRevalidate"
      />
    </div>

    <!-- Playlist modal placeholder -->
    <div v-if="showPlaylistModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showPlaylistModal = false">
      <div class="bg-vault-surface rounded-2xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold mb-4">Add to Playlist</h3>
        <p class="text-vault-muted text-sm">Playlist picker coming soon.</p>
        <button class="focusable mt-4 px-4 py-2 bg-vault-accent text-vault-bg rounded-lg" @click="showPlaylistModal = false">Close</button>
      </div>
    </div>
  </div>

  <!-- Loading -->
  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>

<script setup lang="ts">
import type { TMDBMovieDetail } from '~/types/tmdb'
import type { AvailableStream } from '~/types/stream'
import type { ValidatedStream } from '~/composables/useStreamValidation'

const route = useRoute()
const router = useRouter()
const { movieDetail } = useTMDB()
const resolver = useStreamResolver()
const { resolveStream, token: rdToken } = useRealDebrid()
const { addToWatchlist } = usePlaylists()
const validation = useStreamValidation()
const playerStore = usePlayerStore()

const movie = ref<TMDBMovieDetail | null>(null)
const showPlaylistModal = ref(false)

const id = Number(route.params.id)

// Load movie detail
onMounted(async () => {
  movie.value = await movieDetail(id)
  // Auto-search for streams
  if (movie.value?.imdb_id) {
    resolver.findStreams(movie.value.imdb_id)
  }
})

async function onPlay() {
  if (!movie.value) return

  // Use best verified stream if available (no extra API calls)
  const best = validation.bestStream.value
  if (best?.validatedUrl) {
    const filename = best.files?.[0]?.filename || best.title
    playerStore.setStream({
      url: best.validatedUrl,
      filename,
      title: movie.value.title,
      poster: movie.value.poster_path,
      backdrop: movie.value.backdrop_path,
      tmdbId: movie.value.id,
      mediaType: 'movie',
      imdbId: movie.value.imdb_id || '',
    })
    router.push('/play')
    return
  }

  // Otherwise use first available stream
  const first = resolver.streams.value[0]
  if (first) {
    try {
      const result = await resolveStream(first.hash)
      playerStore.setStream({
        url: result.url,
        filename: result.filename,
        title: movie.value.title,
        poster: movie.value.poster_path,
      backdrop: movie.value.backdrop_path,
        tmdbId: movie.value.id,
        mediaType: 'movie',
        imdbId: movie.value.imdb_id || '',
      })
      router.push('/play')
    } catch (e: any) {
      console.error('Failed to play:', e)
    }
    return
  }

  // No streams loaded yet — trigger search + resolve
  if (movie.value.imdb_id) {
    try {
      const result = await resolver.autoResolve(movie.value.imdb_id)
      playerStore.setStream({
        url: result.url,
        filename: result.filename,
        title: movie.value.title,
        poster: movie.value.poster_path,
      backdrop: movie.value.backdrop_path,
        tmdbId: movie.value.id,
        mediaType: 'movie',
        imdbId: movie.value.imdb_id,
      })
      router.push('/play')
    } catch (e: any) {
      console.error('Failed to play:', e)
    }
  }
}

async function onStreamSelect(stream: AvailableStream) {
  if (!movie.value) return
  try {
    const result = await resolveStream(stream.hash)
    playerStore.setStream({
      url: result.url,
      filename: result.filename,
      title: movie.value.title,
      poster: movie.value.poster_path,
      backdrop: movie.value.backdrop_path,
      tmdbId: movie.value.id,
      mediaType: 'movie',
      imdbId: movie.value.imdb_id || '',
    })
    router.push('/play')
  } catch (e: any) {
    console.error('Failed to resolve stream:', e)
  }
}

async function onAddToWatchlist() {
  if (!movie.value) return
  await addToWatchlist(movie.value.id, 'movie')
}

function onPlayVerified(stream: ValidatedStream) {
  if (!movie.value || !stream.validatedUrl) return
  // Use the validated filename to detect format, fall back to stream title
  const filename = stream.files?.[0]?.filename || stream.title
  playerStore.setStream({
    url: stream.validatedUrl,
    filename,
    title: movie.value.title,
    poster: movie.value.poster_path,
    tmdbId: movie.value.id,
    mediaType: 'movie',
    imdbId: movie.value.imdb_id || '',
  })
  router.push('/play')
}

async function onRevalidate(hash: string) {
  if (!rdToken.value) return
  await validation.validateSingle(hash, rdToken.value)
}
</script>
