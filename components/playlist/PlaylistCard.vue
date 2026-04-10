<template>
  <NuxtLink
    :to="`/playlists/${playlist.id}`"
    class="focusable bg-vault-surface border border-vault-border/50 rounded-xl p-4 hover:border-vault-accent/30 transition-all block"
    data-focusable
  >
    <h3 class="font-semibold text-sm mb-1 truncate">{{ playlist.title }}</h3>
    <p v-if="playlist.description" class="text-xs text-vault-muted line-clamp-2 mb-2">{{ playlist.description }}</p>
    <div class="flex items-center gap-2 text-xs text-vault-muted">
      <span>{{ playlist.itemCount || 0 }} items</span>
      <span v-if="playlist.isShared" class="text-vault-accent">Shared</span>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Playlist } from '~/types/playlist'
defineProps<{ playlist: Playlist }>()
</script>
