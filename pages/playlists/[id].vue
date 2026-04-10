<template>
  <div class="px-6 py-8 max-w-[1600px] mx-auto">
    <div v-if="playlist" class="mb-6">
      <NuxtLink to="/playlists" class="text-sm text-vault-muted hover:text-vault-accent mb-2 inline-block">&larr; All Playlists</NuxtLink>
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold">{{ playlist.title }}</h1>
          <p v-if="playlist.description" class="text-vault-muted text-sm mt-1">{{ playlist.description }}</p>
        </div>
        <div class="flex gap-2">
          <button
            class="focusable px-3 py-1.5 bg-vault-surface text-vault-muted rounded-lg text-sm hover:text-vault-text"
            @click="onToggleShare"
          >
            {{ playlist.isShared ? 'Unshare' : 'Share' }}
          </button>
          <button
            class="focusable px-3 py-1.5 bg-vault-error/10 text-vault-error rounded-lg text-sm hover:bg-vault-error/20"
            @click="onDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Items -->
    <div v-if="items.length" class="space-y-2">
      <div
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-4 p-3 bg-vault-surface rounded-xl border border-vault-border/50"
      >
        <span class="text-vault-muted text-sm w-6 text-center">{{ item.position + 1 }}</span>
        <NuxtLink
          :to="`/${item.mediaType === 'movie' ? 'movie' : 'tv'}/${item.tmdbId}`"
          class="focusable flex-1 text-sm font-medium hover:text-vault-accent"
        >
          {{ item.title || `${item.mediaType} #${item.tmdbId}` }}
          <span v-if="item.seasonNumber" class="text-vault-muted ml-2">
            S{{ item.seasonNumber }}E{{ item.episodeNumber }}
          </span>
        </NuxtLink>
        <button class="focusable text-vault-muted hover:text-vault-error text-sm" @click="onRemoveItem(item.id)">Remove</button>
      </div>
    </div>

    <div v-else-if="!loading" class="py-16 text-center text-vault-muted">
      <p>This playlist is empty. Add movies or shows from their detail pages.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Playlist, PlaylistItem } from '~/types/playlist'

const route = useRoute()
const router = useRouter()
const { getPlaylists, getPlaylistItems, removeFromPlaylist, updatePlaylist, deletePlaylist } = usePlaylists()

const playlist = ref<Playlist | null>(null)
const items = ref<PlaylistItem[]>([])
const loading = ref(true)

const playlistId = route.params.id as string

onMounted(async () => {
  const all = await getPlaylists()
  playlist.value = all.find(p => p.id === playlistId) || null
  items.value = await getPlaylistItems(playlistId)
  loading.value = false
})

async function onRemoveItem(itemId: string) {
  await removeFromPlaylist(itemId)
  items.value = items.value.filter(i => i.id !== itemId)
}

async function onToggleShare() {
  if (!playlist.value) return
  await updatePlaylist(playlistId, { isShared: !playlist.value.isShared })
  playlist.value.isShared = !playlist.value.isShared
}

async function onDelete() {
  if (!confirm('Delete this playlist?')) return
  await deletePlaylist(playlistId)
  router.push('/playlists')
}
</script>
