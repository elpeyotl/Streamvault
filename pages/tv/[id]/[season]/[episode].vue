<template>
  <div v-if="show && episode">
    <!-- Episode hero -->
    <div class="relative">
      <!-- Backdrop: episode still or show backdrop -->
      <div class="w-full aspect-[21/9] max-h-[50vh] overflow-hidden relative">
        <img
          v-if="stillUrl"
          :src="stillUrl"
          :alt="episode.name"
          class="w-full h-full object-cover"
        />
        <img
          v-else-if="show.backdrop_path"
          :src="backdropUrl(show.backdrop_path, 'w1280')"
          :alt="show.name"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full bg-vault-surface" />
        <div class="hero-gradient absolute inset-0" />
      </div>

      <!-- Episode info overlaid at bottom -->
      <div class="absolute bottom-0 left-0 right-0 px-6 pb-6">
        <div class="max-w-5xl mx-auto">
          <!-- Show title + episode badge -->
          <div class="flex items-center gap-3 mb-2">
            <NuxtLink :to="`/tv/${id}`" class="text-vault-muted hover:text-vault-accent text-sm transition-colors">
              {{ show.name }}
            </NuxtLink>
            <span class="text-vault-muted text-sm">/</span>
            <span class="px-2 py-0.5 bg-vault-accent/20 text-vault-accent text-xs font-bold rounded">
              S{{ String(seasonNum).padStart(2, '0') }}E{{ String(episodeNum).padStart(2, '0') }}
            </span>
          </div>

          <!-- Episode title -->
          <h1 class="text-2xl sm:text-3xl font-bold mb-2">{{ episode.name }}</h1>

          <!-- Meta -->
          <div class="flex items-center gap-4 text-sm text-vault-muted mb-3">
            <span v-if="episode.runtime">{{ episode.runtime }} min</span>
            <span v-if="episode.airDate">{{ episode.airDate }}</span>
            <span v-if="episode.voteAverage" class="text-vault-accent">★ {{ episode.voteAverage.toFixed(1) }}</span>
          </div>

          <!-- Overview -->
          <p v-if="episode.overview" class="text-sm text-vault-muted max-w-2xl line-clamp-3">{{ episode.overview }}</p>

          <!-- Action buttons -->
          <div class="flex items-center gap-3 mt-4">
            <button
              class="focusable flex items-center gap-2 px-6 py-3 bg-vault-accent text-vault-bg rounded-xl font-semibold hover:bg-vault-accent-hover transition-colors"
              @click="onPlay"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              Play
            </button>
            <NuxtLink
              :to="`/tv/${id}`"
              class="focusable px-5 py-3 bg-vault-surface border border-vault-border rounded-xl text-sm text-vault-muted hover:text-vault-text transition-colors"
            >
              All Episodes
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Streams -->
    <div class="px-6 py-8 max-w-5xl mx-auto">
      <StreamList
        :streams="resolver.streams.value"
        :loading="resolver.loading.value"
        :error="resolver.error.value"
        :stats="resolver.stats.value"
        @play="onStreamPlay"
      />
    </div>
  </div>

  <!-- Loading -->
  <div v-else class="flex items-center justify-center min-h-[60vh]">
    <div class="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
  </div>
</template>

<script setup lang="ts">
import type { TMDBTVDetail } from '~/types/tmdb'
import type { EpisodeInfo } from '~/types/media'
import type { AvailableStream } from '~/types/stream'

const route = useRoute()
const router = useRouter()
const { tvDetail, backdropUrl } = useTMDB()
const resolver = useStreamResolver()
const playerStore = usePlayerStore()

const id = Number(route.params.id)
const seasonNum = Number(route.params.season)
const episodeNum = Number(route.params.episode)

const show = ref<TMDBTVDetail | null>(null)
const episode = ref<EpisodeInfo | null>(null)

const config = useRuntimeConfig()
const stillUrl = computed(() => {
  if (!episode.value?.stillPath) return ''
  return `${config.public.tmdbImageBase}/w780${episode.value.stillPath}`
})

onMounted(async () => {
  const data = await tvDetail(id, seasonNum) as any
  show.value = data

  const episodes = (data.seasonDetail?.episodes || []) as any[]
  const ep = episodes.find((e: any) => e.episode_number === episodeNum)
  if (ep) {
    episode.value = {
      episodeNumber: ep.episode_number,
      seasonNumber: ep.season_number,
      name: ep.name,
      overview: ep.overview,
      stillPath: ep.still_path,
      airDate: ep.air_date,
      runtime: ep.runtime,
      voteAverage: ep.vote_average,
    }
  }

  if (data.external_ids?.imdb_id) {
    resolver.findStreams(data.external_ids.imdb_id, {
      season: seasonNum,
      episode: episodeNum,
    })
  }
})

function onPlay() {
  document.querySelector('[data-focusable]')?.scrollIntoView({ behavior: 'smooth' })
}

function onStreamPlay(data: { url: string; filename: string; stream: AvailableStream }) {
  if (!show.value) return
  playerStore.setStream({
    url: data.url,
    filename: data.filename,
    title: show.value.name,
    poster: show.value.poster_path,
    backdrop: show.value.backdrop_path,
    tmdbId: show.value.id,
    mediaType: 'tv',
    imdbId: show.value.external_ids?.imdb_id || '',
    season: seasonNum,
    episode: episodeNum,
    episodeTitle: episode.value?.name,
  })
  router.push('/play')
}
</script>
