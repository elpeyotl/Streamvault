<template>
  <div v-if="show">
    <MediaHero
      :title="show.name"
      :overview="show.overview"
      :tagline="show.tagline"
      :backdrop-path="show.backdrop_path"
      :poster-path="show.poster_path"
      :year="show.first_air_date?.substring(0, 4)"
      :rating="show.vote_average"
      :genres="show.genres?.map(g => g.name)"
      :languages="show.spoken_languages?.map(l => l.english_name)"
      @play="onPlayFirst"
      @add-to-watchlist="onAddToWatchlist"
      @add-to-playlist="showPlaylistModal = true"
    />

    <!-- Seasons & Episodes -->
    <div class="px-6 py-8 max-w-5xl mx-auto">
      <SeasonSelector
        v-if="seasons.length"
        :seasons="seasons"
        :episodes="episodes"
        :selected-season="selectedSeason"
        @select-season="onSelectSeason"
        @select-episode="onSelectEpisode"
      />

      <!-- Streams for selected episode -->
      <div v-if="selectedEpisode" class="mt-8">
        <h3 class="text-lg font-semibold mb-2">
          Streams for S{{ String(selectedSeason).padStart(2, '0') }}E{{ String(selectedEpisode).padStart(2, '0') }}
        </h3>
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
    </div>
  </div>

  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>

<script setup lang="ts">
import type { TMDBTVDetail } from '~/types/tmdb'
import type { SeasonInfo, EpisodeInfo } from '~/types/media'
import type { AvailableStream } from '~/types/stream'
import type { ValidatedStream } from '~/composables/useStreamValidation'

const route = useRoute()
const router = useRouter()
const { tvDetail } = useTMDB()
const resolver = useStreamResolver()
const { resolveStream, token: rdToken } = useRealDebrid()
const { addToWatchlist } = usePlaylists()
const validation = useStreamValidation()
const playerStore = usePlayerStore()

const show = ref<TMDBTVDetail | null>(null)
const seasons = ref<SeasonInfo[]>([])
const episodes = ref<EpisodeInfo[]>([])
const selectedSeason = ref(1)
const selectedEpisode = ref<number | null>(null)
const showPlaylistModal = ref(false)

const id = Number(route.params.id)

onMounted(async () => {
  const data = await tvDetail(id)
  show.value = data

  seasons.value = (data.seasons || [])
    .filter(s => s.season_number > 0) // Skip specials
    .map(s => ({
      seasonNumber: s.season_number,
      name: s.name,
      episodeCount: s.episode_count,
      posterPath: s.poster_path,
      airDate: s.air_date,
    }))

  if (seasons.value.length) {
    await onSelectSeason(seasons.value[0].seasonNumber)
  }
})

async function onSelectSeason(seasonNum: number) {
  selectedSeason.value = seasonNum
  selectedEpisode.value = null

  const data = await tvDetail(id, seasonNum) as any
  episodes.value = (data.seasonDetail?.episodes || []).map((ep: any) => ({
    episodeNumber: ep.episode_number,
    seasonNumber: ep.season_number,
    name: ep.name,
    overview: ep.overview,
    stillPath: ep.still_path,
    airDate: ep.air_date,
    runtime: ep.runtime,
    voteAverage: ep.vote_average,
  }))
}

async function onSelectEpisode(episodeNum: number) {
  selectedEpisode.value = episodeNum
  if (!show.value?.external_ids?.imdb_id) return

  // Search streams for this episode
  resolver.findStreams(show.value.external_ids.imdb_id, {
    season: selectedSeason.value,
    episode: episodeNum,
  })
}

async function onPlayFirst() {
  if (episodes.value.length) {
    await onSelectEpisode(episodes.value[0].episodeNumber)
  }
}

async function onStreamSelect(stream: AvailableStream) {
  if (!show.value) return
  try {
    const result = await resolveStream(stream.hash)
    const ep = episodes.value.find(e => e.episodeNumber === selectedEpisode.value)

    playerStore.setStream({
      url: result.url,
      filename: result.filename,
      title: show.value.name,
      poster: show.value.poster_path,
      backdrop: show.value.backdrop_path,
      tmdbId: show.value.id,
      mediaType: 'tv',
      imdbId: show.value.external_ids?.imdb_id || '',
      season: selectedSeason.value,
      episode: selectedEpisode.value || undefined,
      episodeTitle: ep?.name,
    })
    router.push('/play')
  } catch (e: any) {
    console.error('Failed to resolve stream:', e)
  }
}

async function onAddToWatchlist() {
  if (!show.value) return
  await addToWatchlist(show.value.id, 'tv')
}

function onPlayVerified(stream: ValidatedStream) {
  if (!show.value || !stream.validatedUrl) return
  const ep = episodes.value.find(e => e.episodeNumber === selectedEpisode.value)
  const filename = stream.files?.[0]?.filename || stream.title

  playerStore.setStream({
    url: stream.validatedUrl,
    filename,
    title: show.value.name,
    poster: show.value.poster_path,
    tmdbId: show.value.id,
    mediaType: 'tv',
    imdbId: show.value.external_ids?.imdb_id || '',
    season: selectedSeason.value,
    episode: selectedEpisode.value || undefined,
    episodeTitle: ep?.name,
  })
  router.push('/play')
}

async function onRevalidate(hash: string) {
  if (!rdToken.value) return
  await validation.validateSingle(hash, rdToken.value)
}
</script>
