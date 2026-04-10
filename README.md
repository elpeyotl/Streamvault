# StreamVault

Personal streaming aggregator. Search movies & TV shows, resolve torrent hashes via Real-Debrid, and stream directly in the browser.

## Features

- **TMDB Integration** — Search, trending, full movie/TV detail pages
- **Real-Debrid Streaming** — Hash → instant HTTPS stream (no P2P)
- **Playlists** — Create, share, reorder custom playlists
- **Language Filtering** — Filter streams by audio language at multiple levels
- **Continue Watching** — Resume where you left off
- **Watchlist** — Save movies/shows for later
- **Multi-User** — Supabase auth, per-user preferences
- **TV-Ready** — D-Pad navigation, focus management for Google TV

## Quick Start

```bash
# 1. Clone & install
git clone <your-repo>
cd streamvault
npm install

# 2. Environment
cp .env.example .env
# Fill in your API keys (see below)

# 3. Supabase setup
# Create a project at supabase.com
# Run supabase/migrations/001_initial_schema.sql in the SQL Editor

# 4. Run
npm run dev
# Open http://localhost:3000
```

## API Keys You Need

| Service | Where | Cost |
|---------|-------|------|
| TMDB | [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) | Free |
| Supabase | [supabase.com](https://supabase.com) | Free tier |
| Real-Debrid | [real-debrid.com](https://real-debrid.com) | ~€3/month |
| OpenSubtitles | [opensubtitles.com/consumers](https://www.opensubtitles.com/en/consumers) | Free tier |

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

```
Browser / VIDAA / Google TV
        ↓
   Nuxt 3 App
   ├── /pages        → UI (Vue 3 + Tailwind)
   ├── /server/api   → TMDB, Hash search, RD proxy
   ├── /composables   → Client-side logic
   └── /stores        → Pinia state
        ↓
   External APIs
   ├── TMDB (metadata)
   ├── Zilean / Torrentio (torrent hashes)
   ├── Real-Debrid (hash → HTTPS stream)
   └── Supabase (auth, playlists, history)
```

## Phase 2: Google TV

```bash
# Add Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init StreamVault com.streamvault.app
npx cap add android
npx cap sync
npx cap open android  # Opens Android Studio
```

Build APK → sideload on Google TV or submit to Play Store.
