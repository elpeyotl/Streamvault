<template>
  <div class="relative">
    <div class="flex items-center bg-vault-surface border border-vault-border rounded-xl px-4 py-2.5 focus-within:border-vault-accent/50 transition-colors">
      <svg class="w-4 h-4 text-vault-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        ref="inputRef"
        v-model="query"
        type="text"
        placeholder="Search movies & TV shows..."
        class="focusable w-full bg-transparent border-none outline-none text-vault-text placeholder-vault-muted ml-3 text-sm"
        @input="onInput"
        @keydown.enter="onSubmit"
        @keydown.escape="clear"
      />
      <button v-if="query" class="focusable text-vault-muted hover:text-vault-text p-1 rounded" @click="clear">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const query = ref('')
const inputRef = ref<HTMLInputElement>()

let debounceTimer: ReturnType<typeof setTimeout>

function onInput() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (query.value.trim().length >= 2) {
      router.push({ path: '/search', query: { q: query.value.trim() } })
    }
  }, 400)
}

function onSubmit() {
  clearTimeout(debounceTimer)
  if (query.value.trim()) {
    router.push({ path: '/search', query: { q: query.value.trim() } })
  }
}

function clear() {
  query.value = ''
  inputRef.value?.focus()
}

// Sync with route query
const route = useRoute()
watch(() => route.query.q, (q) => {
  if (typeof q === 'string') query.value = q
}, { immediate: true })
</script>
