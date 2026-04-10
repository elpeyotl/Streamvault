// Check if real Supabase credentials are configured (not placeholder values)
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''
const hasSupabase = supabaseUrl.includes('.supabase.co') && !supabaseUrl.includes('your-project') && supabaseKey.length > 20

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    // Only load Supabase module when real credentials are configured
    ...(hasSupabase ? ['@nuxtjs/supabase'] : []),
  ],

  components: [
    { path: '~/components', pathPrefix: false },
  ],

  css: ['~/assets/css/main.css'],

  supabase: {
    redirect: false, // Handle auth manually
  },

  runtimeConfig: {
    // Server-only keys
    tmdbApiKey: process.env.TMDB_API_KEY || '',
    tmdbBaseUrl: process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3',
    zileanApiUrl: process.env.ZILEAN_API_URL || 'https://zilean.elfhosted.com',
    torrentioApiUrl: process.env.TORRENTIO_API_URL || 'https://torrentio.strem.fun',
    opensubtitlesApiKey: process.env.OPENSUBTITLES_API_KEY || '',
    opensubtitlesBaseUrl: process.env.OPENSUBTITLES_BASE_URL || 'https://api.opensubtitles.com/api/v1',
    rdTokenEncryptionKey: process.env.RD_TOKEN_ENCRYPTION_KEY || '',

    // Public keys (available client-side)
    public: {
      tmdbImageBase: 'https://image.tmdb.org/t/p',
      supabaseUrl: process.env.SUPABASE_URL || '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    },
  },

  app: {
    head: {
      title: 'StreamVault',
      meta: [
        { name: 'description', content: 'Personal streaming aggregator' },
        { name: 'theme-color', content: '#0A0A0F' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,300;1,9..40,400&display=swap',
        },
      ],
    },
  },

  // Nitro server config
  nitro: {
    routeRules: {
      '/api/**': { cors: true },
    },
  },
})
