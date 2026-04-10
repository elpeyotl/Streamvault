# StreamVault

Personal streaming app — aggregates torrent sources, resolves via Real-Debrid to HTTPS streams, plays in a custom UI. Replaces Stremio + addons.

## Tech Stack

- **Framework:** Nuxt 3 (Vue 3 + TypeScript), SSR-optional
- **Styling:** Tailwind CSS with custom `vault-*` color tokens (dark cinematic theme)
- **State:** Pinia stores (`stores/`)
- **Database:** Supabase (Postgres + Auth) — playlists, watch history, watchlist, profiles
- **Video:** Native `<video>` + HLS.js (client-only plugin)
- **APIs:** TMDB (metadata), Zilean/Torrentio (torrent hashes), Real-Debrid (hash→stream), OpenSubtitles

## Commands

```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build
npm run preview    # Preview production build
```

## Project Structure

```
pages/              → Routes (index, search, movie/[id], tv/[id], play, playlists, settings, login)
components/         → Vue components organized by domain (ui/, media/, player/, playlist/)
composables/        → Client-side logic (useTMDB, useRealDebrid, useStreamResolver, usePlayer, etc.)
server/api/         → Nitro API routes (tmdb/, hashes/, debrid/, stream/, subtitles/)
server/utils/       → Server-side helpers (tmdb.ts, debrid.ts, hashes.ts, subtitles.ts)
stores/             → Pinia stores (auth, player, preferences, search)
types/              → TypeScript type definitions (tmdb, debrid, media, playlist, stream)
utils/              → Shared utilities (languages.ts, quality.ts)
layouts/            → default.vue (sidebar + content), player.vue (fullscreen)
supabase/migrations → SQL schema migrations
```

## Architecture & Key Patterns

### Stream Resolution Pipeline (core feature)
1. Get IMDB ID from TMDB
2. Search torrent hashes via Zilean/Torrentio (`/api/hashes/search`)
3. Check Real-Debrid instant availability (`/api/debrid/check`)
4. User selects stream (or auto-select best match)
5. Resolve hash to HTTPS URL via RD (`/api/debrid/resolve`)
6. Play in VideoPlayer component

### Stream Pre-Validation (differentiator from Stremio)
- Background validation of streams before user clicks Play
- Full resolve → HEAD request → Range request (512KB) to verify video
- SSE endpoint (`/api/stream/validate-batch`) for live UI updates
- Streams show health status: verified (green), pending (yellow), dead (red)
- Verified streams bubble to top; dead streams hidden by default

### API Route Convention
- Server routes follow Nuxt/Nitro file-based routing: `server/api/[domain]/[action].[method].ts`
- All API keys are server-only via `runtimeConfig` (never exposed to client)
- RD tokens are per-user, encrypted in Supabase

### Component Patterns
- Use `vault-*` Tailwind color tokens — never hardcode hex colors
- All interactive elements use `.focusable` class for TV-compatible focus states
- Horizontal scroll rows use `.scroll-row` class (Netflix-style)
- Dark theme only: bg `#0A0A0F`, surface `#15151F`, accent amber `#F59E0B`

### TV Navigation (build for TV from the start)
- D-Pad/keyboard navigation via `useTVNavigation` composable
- Spatial navigation in grids, visible focus rings on all interactive elements
- Keyboard shortcuts: Space (play/pause), F (fullscreen), Arrow keys (seek/navigate), M (mute)

## Conventions

- **TypeScript** everywhere — types live in `types/` directory
- **Composables** for client-side API logic; server utils for server-side helpers
- **Supabase auth** handled manually (redirect disabled in nuxt config)
- **Font:** DM Sans (loaded via Google Fonts in app head)
- Auto-import is enabled for Vue/Nuxt APIs, composables, components, and utils

## Environment Variables

Server-only (in `runtimeConfig`): `TMDB_API_KEY`, `ZILEAN_API_URL`, `TORRENTIO_API_URL`, `OPENSUBTITLES_API_KEY`, `RD_TOKEN_ENCRYPTION_KEY`

Public (in `runtimeConfig.public`): `SUPABASE_URL`, `SUPABASE_ANON_KEY`

Supabase keys are also configured via `@nuxtjs/supabase` module.

## Current Phase

Phase 1 (Web MVP) — project scaffolding is done. Next up:
- TMDB integration (search, trending, detail pages)
- Real-Debrid token setup in settings
- Hash search via Zilean
- Stream resolution pipeline
- Video player with basic controls
- Continue watching
- Basic auth (single user)
