import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    loading: false,
    error: null as string | null,
  }),

  getters: {
    user: () => useSafeSupabaseUser().value,
    isAuthenticated: () => !!useSafeSupabaseUser().value,
  },

  actions: {
    async signIn(email: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const client = useSafeSupabaseClient()
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async signUp(email: string, password: string, username?: string) {
      this.loading = true
      this.error = null
      try {
        const client = useSafeSupabaseClient()
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { data: { username } },
        })
        if (error) this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async signOut() {
      const client = useSafeSupabaseClient()
      await client.auth.signOut()
    },
  },
})
