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
        :show-id="id"
        @select-season="onSelectSeason"
      />

    </div>
  </div>

  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>

<script setup lang="ts">
import type { TMDBTVDetail } from '~/types/tmdb'
import type { SeasonInfo, EpisodeInfo } from '~/types/media'

const route = useRoute()
const router = useRouter()
const { tvDetail } = useTMDB()
const { addToWatchlist } = usePlaylists()

const show = ref<TMDBTVDetail | null>(null)
const seasons = ref<SeasonInfo[]>([])
const episodes = ref<EpisodeInfo[]>([])
const selectedSeason = ref(1)
const showPlaylistModal = ref(false)

const id = Number(route.params.id)

onMounted(async () => {
  const data = await tvDetail(id)
  show.value = data

  seasons.value = (data.seasons || [])
    .filter(s => s.season_number > 0)
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

function onPlayFirst() {
  if (episodes.value.length) {
    router.push(`/tv/${id}/${seasons.value[0]?.seasonNumber || 1}/${episodes.value[0].episodeNumber}`)
  }
}

async function onAddToWatchlist() {
  if (!show.value) return
  await addToWatchlist(show.value.id, 'tv')
}
</script>
