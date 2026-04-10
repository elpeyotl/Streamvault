<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Load preferences from localStorage on mount
onMounted(() => {
  const preferences = usePreferencesStore()
  preferences.loadFromStorage()

  // Validate RD token if saved
  const { validateToken, token } = useRealDebrid()
  if (token.value) validateToken()
})
</script>
