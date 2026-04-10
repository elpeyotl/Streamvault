<template>
  <header class="fixed top-0 left-0 right-0 z-50 glass">
    <div class="flex items-center justify-between h-16 px-6">
      <!-- Logo -->
      <NuxtLink to="/" class="flex items-center gap-3 focusable rounded-lg px-2 py-1">
        <div class="w-8 h-8 bg-vault-accent rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-vault-bg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span class="text-lg font-bold tracking-tight">StreamVault</span>
      </NuxtLink>

      <!-- Search -->
      <div class="flex-1 max-w-xl mx-8">
        <SearchBar />
      </div>

      <!-- Right side -->
      <div class="flex items-center gap-4">
        <!-- RD Status -->
        <div v-if="rdConfigured" class="flex items-center gap-2 text-sm">
          <span class="w-2 h-2 rounded-full" :class="rdPremium ? 'bg-vault-success' : 'bg-vault-error'" />
          <span class="text-vault-muted hidden sm:inline">RD</span>
        </div>

        <!-- Settings -->
        <NuxtLink to="/settings" class="focusable rounded-lg p-2 text-vault-muted hover:text-vault-text transition-colors">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </NuxtLink>

        <!-- User -->
        <NuxtLink v-if="user" to="/settings" class="focusable rounded-full w-8 h-8 bg-vault-accent/20 flex items-center justify-center text-vault-accent font-semibold text-sm">
          {{ user.email?.charAt(0).toUpperCase() }}
        </NuxtLink>
        <NuxtLink v-else-if="supabaseAvailable" to="/login" class="focusable rounded-lg px-4 py-2 bg-vault-accent text-vault-bg text-sm font-semibold hover:bg-vault-accent-hover transition-colors">
          Sign In
        </NuxtLink>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
const user = useSafeSupabaseUser()
const supabaseAvailable = useSupabaseAvailable()
const { isConfigured: rdConfigured, isPremium: rdPremium } = useRealDebrid()
</script>
