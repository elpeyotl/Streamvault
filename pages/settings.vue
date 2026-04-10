<template>
  <div class="px-6 py-8 max-w-2xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold">Settings</h1>

    <!-- Real-Debrid -->
    <section class="bg-vault-surface rounded-2xl p-6 border border-vault-border/50">
      <h2 class="text-lg font-semibold mb-4">Real-Debrid</h2>

      <div v-if="rd.isConfigured.value" class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm">Connected as <strong>{{ rd.rdUser.value?.username }}</strong></p>
            <p class="text-xs text-vault-muted">
              {{ rd.rdUser.value?.premium ? 'Premium' : 'Free' }}
              <span v-if="rd.rdUser.value?.expiration"> · Expires {{ rd.rdUser.value.expiration }}</span>
            </p>
          </div>
          <span class="w-3 h-3 rounded-full" :class="rd.rdUser.value?.premium ? 'bg-vault-success' : 'bg-vault-error'" />
        </div>
        <button class="focusable text-sm text-vault-error hover:underline" @click="rd.clearToken()">Disconnect</button>
      </div>

      <div v-else class="space-y-3">
        <p class="text-sm text-vault-muted">Enter your Real-Debrid API token. Get it from <a href="https://real-debrid.com/apitoken" target="_blank" class="text-vault-accent hover:underline">real-debrid.com/apitoken</a></p>
        <div class="flex gap-2">
          <input
            v-model="rdTokenInput"
            type="password"
            placeholder="Paste your API token..."
            class="focusable flex-1 bg-vault-bg border border-vault-border rounded-xl px-4 py-2.5 text-sm"
          />
          <button
            class="focusable px-5 py-2.5 bg-vault-accent text-vault-bg rounded-xl font-medium text-sm hover:bg-vault-accent-hover disabled:opacity-50"
            :disabled="!rdTokenInput || validating"
            @click="connectRD"
          >
            {{ validating ? 'Checking...' : 'Connect' }}
          </button>
        </div>
        <p v-if="rdError" class="text-xs text-vault-error">{{ rdError }}</p>
      </div>
    </section>

    <!-- Language Preferences -->
    <section class="bg-vault-surface rounded-2xl p-6 border border-vault-border/50">
      <h2 class="text-lg font-semibold mb-4">Preferred Languages</h2>
      <p class="text-sm text-vault-muted mb-4">Streams in these languages will be shown first.</p>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="lang in languageOptions"
          :key="lang.code"
          class="focusable px-3 py-1.5 rounded-lg text-sm transition-colors"
          :class="preferences.preferredLanguages.includes(lang.code)
            ? 'bg-vault-accent text-vault-bg'
            : 'bg-vault-surface-light text-vault-muted hover:text-vault-text'"
          @click="toggleLanguage(lang.code)"
        >
          {{ lang.flag }} {{ lang.name }}
        </button>
      </div>
    </section>

    <!-- Quality Preference -->
    <section class="bg-vault-surface rounded-2xl p-6 border border-vault-border/50">
      <h2 class="text-lg font-semibold mb-4">Preferred Quality</h2>

      <div class="flex gap-2">
        <button
          v-for="q in qualities"
          :key="q"
          class="focusable px-4 py-2 rounded-lg text-sm transition-colors"
          :class="preferences.preferredQuality === q
            ? 'bg-vault-accent text-vault-bg'
            : 'bg-vault-surface-light text-vault-muted hover:text-vault-text'"
          @click="preferences.setQuality(q)"
        >
          {{ q }}
        </button>
      </div>
    </section>

    <!-- Subtitle Languages -->
    <section class="bg-vault-surface rounded-2xl p-6 border border-vault-border/50">
      <h2 class="text-lg font-semibold mb-4">Subtitle Languages</h2>

      <div class="flex flex-wrap gap-2">
        <button
          v-for="lang in languageOptions"
          :key="lang.code"
          class="focusable px-3 py-1.5 rounded-lg text-sm transition-colors"
          :class="preferences.preferredSubtitleLanguages.includes(lang.code)
            ? 'bg-vault-accent text-vault-bg'
            : 'bg-vault-surface-light text-vault-muted hover:text-vault-text'"
          @click="toggleSubtitleLanguage(lang.code)"
        >
          {{ lang.flag }} {{ lang.name }}
        </button>
      </div>
    </section>

    <!-- Account -->
    <section v-if="user" class="bg-vault-surface rounded-2xl p-6 border border-vault-border/50">
      <h2 class="text-lg font-semibold mb-4">Account</h2>
      <p class="text-sm text-vault-muted mb-3">Signed in as {{ user.email }}</p>
      <button class="focusable text-sm text-vault-error hover:underline" @click="signOut">Sign Out</button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { LANGUAGE_OPTIONS } from '~/utils/languages'

const rd = useRealDebrid()
const preferences = usePreferencesStore()
const user = useSafeSupabaseUser()
const auth = useAuthStore()

const rdTokenInput = ref('')
const validating = ref(false)
const rdError = ref('')
const languageOptions = LANGUAGE_OPTIONS
const qualities = ['4k', '1080p', '720p', '480p']

async function connectRD() {
  validating.value = true
  rdError.value = ''

  const valid = await rd.validateToken(rdTokenInput.value)
  if (valid) {
    rdTokenInput.value = ''
  } else {
    rdError.value = 'Invalid token. Please check and try again.'
  }
  validating.value = false
}

function toggleLanguage(code: string) {
  const langs = [...preferences.preferredLanguages]
  const idx = langs.indexOf(code)
  if (idx >= 0) langs.splice(idx, 1)
  else langs.push(code)
  preferences.setLanguages(langs)
}

function toggleSubtitleLanguage(code: string) {
  const langs = [...preferences.preferredSubtitleLanguages]
  const idx = langs.indexOf(code)
  if (idx >= 0) langs.splice(idx, 1)
  else langs.push(code)
  preferences.setSubtitleLanguages(langs)
}

async function signOut() {
  await auth.signOut()
  navigateTo('/login')
}
</script>
