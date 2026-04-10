<template>
  <div class="px-6 py-8 max-w-[1600px] mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Playlists</h1>
      <button
        class="focusable flex items-center gap-2 px-4 py-2 bg-vault-accent text-vault-bg rounded-xl text-sm font-medium hover:bg-vault-accent-hover"
        @click="showCreate = true"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14" /></svg>
        New Playlist
      </button>
    </div>

    <!-- Playlists grid -->
    <div v-if="playlists.length" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      <NuxtLink
        v-for="pl in playlists"
        :key="pl.id"
        :to="`/playlists/${pl.id}`"
        class="focusable bg-vault-surface border border-vault-border/50 rounded-xl p-5 hover:border-vault-accent/30 transition-all"
      >
        <h3 class="font-semibold mb-1">{{ pl.title }}</h3>
        <p v-if="pl.description" class="text-sm text-vault-muted line-clamp-2 mb-3">{{ pl.description }}</p>
        <div class="flex items-center gap-3 text-xs text-vault-muted">
          <span>{{ pl.itemCount || 0 }} items</span>
          <span v-if="pl.isShared" class="text-vault-accent">Shared</span>
        </div>
      </NuxtLink>
    </div>

    <div v-else-if="!loading" class="py-16 text-center text-vault-muted">
      <p>No playlists yet. Create one to get started.</p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-8 flex justify-center">
      <div class="w-8 h-8 border-2 border-vault-accent border-t-transparent rounded-full animate-spin" />
    </div>

    <!-- Create modal -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showCreate = false">
      <div class="bg-vault-surface rounded-2xl p-6 w-full max-w-md mx-4" @click.stop>
        <h3 class="text-lg font-semibold mb-4">New Playlist</h3>
        <input
          v-model="newTitle"
          type="text"
          placeholder="Playlist name"
          class="focusable w-full bg-vault-bg border border-vault-border rounded-xl px-4 py-3 text-sm mb-3"
          @keydown.enter="onCreate"
        />
        <input
          v-model="newDesc"
          type="text"
          placeholder="Description (optional)"
          class="focusable w-full bg-vault-bg border border-vault-border rounded-xl px-4 py-3 text-sm mb-4"
        />
        <div class="flex gap-2 justify-end">
          <button class="focusable px-4 py-2 text-vault-muted text-sm rounded-lg" @click="showCreate = false">Cancel</button>
          <button class="focusable px-5 py-2 bg-vault-accent text-vault-bg text-sm font-medium rounded-lg" @click="onCreate">Create</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Playlist } from '~/types/playlist'

const { getPlaylists, createPlaylist } = usePlaylists()

const playlists = ref<Playlist[]>([])
const loading = ref(true)
const showCreate = ref(false)
const newTitle = ref('')
const newDesc = ref('')

onMounted(async () => {
  playlists.value = await getPlaylists()
  loading.value = false
})

async function onCreate() {
  if (!newTitle.value.trim()) return
  const pl = await createPlaylist(newTitle.value.trim(), newDesc.value.trim() || undefined)
  if (pl) {
    playlists.value.unshift(pl)
    showCreate.value = false
    newTitle.value = ''
    newDesc.value = ''
  }
}
</script>
