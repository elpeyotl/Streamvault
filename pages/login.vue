<template>
  <div class="min-h-[80vh] flex items-center justify-center px-6">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-vault-accent rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg class="w-10 h-10 text-vault-bg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </div>
        <h1 class="text-2xl font-bold">StreamVault</h1>
        <p class="text-vault-muted text-sm mt-1">{{ isLogin ? 'Welcome back' : 'Create your account' }}</p>
      </div>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div v-if="!isLogin">
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            class="focusable w-full bg-vault-surface border border-vault-border rounded-xl px-4 py-3 text-sm"
          />
        </div>

        <div>
          <input
            v-model="email"
            type="email"
            placeholder="Email"
            class="focusable w-full bg-vault-surface border border-vault-border rounded-xl px-4 py-3 text-sm"
            required
          />
        </div>

        <div>
          <input
            v-model="password"
            type="password"
            placeholder="Password"
            class="focusable w-full bg-vault-surface border border-vault-border rounded-xl px-4 py-3 text-sm"
            required
            minlength="6"
          />
        </div>

        <p v-if="auth.error" class="text-vault-error text-sm">{{ auth.error }}</p>

        <button
          type="submit"
          class="focusable w-full py-3 bg-vault-accent text-vault-bg font-semibold rounded-xl hover:bg-vault-accent-hover transition-colors disabled:opacity-50"
          :disabled="auth.loading"
        >
          {{ auth.loading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up') }}
        </button>
      </form>

      <p class="text-center text-sm text-vault-muted mt-6">
        {{ isLogin ? "Don't have an account?" : 'Already have an account?' }}
        <button class="text-vault-accent hover:underline ml-1" @click="isLogin = !isLogin">
          {{ isLogin ? 'Sign Up' : 'Sign In' }}
        </button>
      </p>

      <p class="text-center text-xs text-vault-muted/50 mt-8">
        Sign in to sync your watchlist, playlists, and watch history across devices.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()
const auth = useAuthStore()
const user = useSafeSupabaseUser()
const supabaseAvailable = useSupabaseAvailable()

const isLogin = ref(true)
const email = ref('')
const password = ref('')
const username = ref('')

// Redirect to home if Supabase isn't configured (no auth needed)
if (!supabaseAvailable.value) {
  router.push('/')
}

async function onSubmit() {
  if (isLogin.value) {
    await auth.signIn(email.value, password.value)
  } else {
    await auth.signUp(email.value, password.value, username.value)
  }
}

// Redirect if already logged in
watch(user, (u) => {
  if (u) router.push('/')
}, { immediate: true })
</script>
