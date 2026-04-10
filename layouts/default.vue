<template>
  <div class="min-h-screen bg-vault-bg">
    <AppHeader />
    <main class="pt-16">
      <!-- Back button (shown on subpages, floats above content) -->
      <button
        v-if="showBack"
        class="focusable fixed top-20 left-6 z-40 flex items-center gap-2 px-3 py-1.5 text-sm text-white/80 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-all"
        @click="router.back()"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Back
      </button>
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const showBack = computed(() => route.path !== '/')
</script>
