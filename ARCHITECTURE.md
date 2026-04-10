# StreamVault — Architecture & Feature Specification

## Overview

StreamVault is a personal streaming application that aggregates torrent sources, resolves them via Real-Debrid into direct HTTPS streams, and plays them in a clean, custom UI. It replaces the need for Stremio + addons with a single, self-contained app.

**Target Platforms:**
- Phase 1: Web App (Browser — Mac, VIDAA on Hisense C2 Pro, Phone)
- Phase 2: Android TV App (Google TV via Capacitor)

---

## Tech Stack

| Layer         | Technology                     | Why                                              |
|---------------|--------------------------------|--------------------------------------------------|
| Framework     | Nuxt 3 (Vue 3, TypeScript)    | SSR-optional, API routes, your core stack        |
| Styling       | Tailwind CSS + custom tokens   | Fast iteration, TV-friendly focus states          |
| State         | Pinia                          | Client-side state (search, player, navigation)   |
| Database      | Supabase (Postgres + Auth)     | Playlists, watchlist, watch history, multi-user   |
| Video Player  | Native `<video>` + HLS.js      | Works everywhere, RD serves HTTPS links          |
| API: Metadata | TMDB API v3                    | Movies, TV shows, seasons, episodes, posters     |
| API: Hashes   | Zilean, Torrentio API, custom  | Torrent hash discovery                           |
| API: Streams  | Real-Debrid REST API           | Hash → HTTPS stream URL resolution               |
| PWA           | @vite-pwa/nuxt                 | Installable on desktop/phone                     |
| TV App        | Capacitor (Phase 2)            | Wrap web app as Android TV APK                   |

---

## Project Structure

```
streamvault/
├── nuxt.config.ts
├── app.vue
├── assets/
│   └── css/
│       └── main.css              # Tailwind + custom TV focus styles
├── components/
│   ├── ui/                       # Generic UI components
│   │   ├── AppHeader.vue
│   │   ├── AppSidebar.vue
│   │   ├── SearchBar.vue
│   │   ├── LoadingSpinner.vue
│   │   ├── FocusableCard.vue     # TV-compatible focusable card
│   │   └── Modal.vue
│   ├── media/                    # Media-specific components
│   │   ├── MediaCard.vue         # Poster card (movie/show)
│   │   ├── MediaGrid.vue         # Responsive grid of cards
│   │   ├── MediaHero.vue         # Detail page hero section
│   │   ├── SeasonSelector.vue    # TV show season/episode picker
│   │   ├── StreamList.vue        # List of available streams
│   │   └── StreamBadge.vue       # Quality/language badge
│   ├── player/
│   │   ├── VideoPlayer.vue       # Main video player wrapper
│   │   ├── PlayerControls.vue    # Play/pause/seek/volume/subtitle
│   │   └── SubtitleSelector.vue  # Subtitle language picker
│   └── playlist/
│       ├── PlaylistCard.vue
│       ├── PlaylistEditor.vue
│       └── PlaylistGrid.vue
├── composables/
│   ├── useTMDB.ts                # TMDB API composable
│   ├── useRealDebrid.ts          # Real-Debrid API composable
│   ├── useHashSearch.ts          # Torrent hash aggregation
│   ├── useStreamResolver.ts      # Full pipeline: search → hash → RD → URL
│   ├── usePlayer.ts              # Video player state & controls
│   ├── useWatchHistory.ts        # Continue watching logic
│   ├── usePlaylists.ts           # Playlist CRUD
│   ├── useTVNavigation.ts        # D-Pad / keyboard focus management
│   └── useSubtitles.ts           # OpenSubtitles integration
├── layouts/
│   ├── default.vue               # Standard layout (sidebar + content)
│   └── player.vue                # Fullscreen player layout
├── pages/
│   ├── index.vue                 # Home: trending, continue watching, playlists
│   ├── search.vue                # Search results
│   ├── movie/[id].vue            # Movie detail page
│   ├── tv/[id].vue               # TV show detail page
│   ├── tv/[id]/[season]/[episode].vue  # Episode detail → play
│   ├── play.vue                  # Player page (receives stream URL)
│   ├── playlists/index.vue       # All playlists
│   ├── playlists/[id].vue        # Single playlist view
│   ├── settings.vue              # RD token, language prefs, user profile
│   └── login.vue                 # Supabase auth
├── plugins/
│   ├── supabase.client.ts        # Supabase client init
│   └── hls.client.ts             # HLS.js init (client-only)
├── server/
│   ├── api/
│   │   ├── tmdb/
│   │   │   ├── search.get.ts     # GET /api/tmdb/search?q=...&type=movie|tv
│   │   │   ├── trending.get.ts   # GET /api/tmdb/trending
│   │   │   ├── movie/[id].get.ts # GET /api/tmdb/movie/:id
│   │   │   └── tv/[id].get.ts    # GET /api/tmdb/tv/:id (with seasons)
│   │   ├── hashes/
│   │   │   └── search.get.ts     # GET /api/hashes/search?imdb=tt1234567
│   │   ├── debrid/
│   │   │   ├── check.post.ts     # POST /api/debrid/check (instant availability)
│   │   │   ├── resolve.post.ts   # POST /api/debrid/resolve (hash → stream URL)
│   │   │   └── token.post.ts     # POST /api/debrid/token (save/validate token)
│   │   ├── subtitles/
│   │   │   └── search.get.ts     # GET /api/subtitles/search?imdb=...&lang=...
│   │   └── stream/
│   │       └── resolve.post.ts   # POST /api/stream/resolve (full pipeline)
│   └── utils/
│       ├── tmdb.ts               # TMDB client helper
│       ├── debrid.ts             # RD client helper
│       ├── hashes.ts             # Hash aggregation logic
│       └── subtitles.ts          # OpenSubtitles client
├── stores/
│   ├── auth.ts                   # User auth state (Supabase)
│   ├── player.ts                 # Current playback state
│   ├── preferences.ts            # Language, quality, UI prefs
│   └── search.ts                 # Search state & results cache
├── types/
│   ├── tmdb.ts                   # TMDB response types
│   ├── debrid.ts                 # Real-Debrid types
│   ├── media.ts                  # Internal media types
│   ├── playlist.ts               # Playlist types
│   └── stream.ts                 # Stream/hash types
├── utils/
│   ├── languages.ts              # ISO 639 language list + helpers
│   └── quality.ts                # Quality parsing (720p, 1080p, 4K, etc.)
└── public/
    └── icons/                    # PWA icons
```

---

## Core Features

### 1. Search & Discovery

**TMDB Integration:**
- Search movies and TV shows by title
- Trending content (daily/weekly)
- Movie/TV detail pages with posters, backdrop, overview, cast
- TV: full season/episode breakdown
- Filter by language (original_language field from TMDB)
- Genre filtering

**API Flow:**
```
User types "Breaking Bad"
  → GET /api/tmdb/search?q=breaking+bad&type=tv
  → TMDB returns results with id, poster, overview, languages
  → Display in MediaGrid
```

### 2. Stream Resolution Pipeline

This is the core feature — turning a movie/show selection into a playable HTTPS stream.

**Full Pipeline:**
```
User clicks "Play" on Breaking Bad S01E01
  │
  ├─ 1. Get IMDB ID from TMDB
  │     GET /api/tmdb/tv/1396 → external_ids.imdb_id = "tt0903747"
  │
  ├─ 2. Search torrent hashes
  │     GET /api/hashes/search?imdb=tt0903747&season=1&episode=1
  │     Sources: Zilean API, cached hash databases
  │     → Returns: [{ hash, title, size, quality, languages }]
  │
  ├─ 3. Check Real-Debrid instant availability
  │     POST /api/debrid/check
  │     Body: { hashes: ["abc123", "def456", ...], token: "user_rd_token" }
  │     → RD API: GET /torrents/instantAvailability/{hash}
  │     → Returns only cached (instantly playable) hashes
  │
  ├─ 4. User selects a stream (or auto-select best match)
  │     Filter by: quality preference, language, file size
  │
  ├─ 5. Resolve to HTTPS URL
  │     POST /api/debrid/resolve
  │     Body: { hash: "abc123", fileIndex: 0, token: "user_rd_token" }
  │     → RD API: POST /torrents/addMagnet
  │     → RD API: POST /torrents/selectFiles
  │     → RD API: POST /unrestrict/link
  │     → Returns: { url: "https://cdn.real-debrid.com/dl/..." }
  │
  └─ 6. Play in <video> player
        VideoPlayer.vue receives HTTPS URL
        Native playback, no special player needed
```

### 3. Video Player

**Technology:** Native `<video>` element + HLS.js (fallback for HLS streams)

**Features:**
- Play/Pause, Seek, Volume
- Fullscreen toggle
- Subtitle overlay (WebVTT/SRT from OpenSubtitles)
- Quality indicator badge
- Continue watching: save position to Supabase every 30s
- Resume prompt on return
- Keyboard shortcuts (Space, F, Arrow keys, M for mute)
- TV Remote compatible (D-Pad: play/pause on Enter, seek on Left/Right)

### 4. Playlists

**CRUD in Supabase:**
- Create named playlists
- Add movies/episodes to playlists
- Reorder items (drag & drop on web, D-Pad on TV)
- Share playlists between users (same household)
- Auto-playlist: "Spanish Language Films", "4K Available", etc.

**Supabase Schema:**
```sql
-- profiles (extends supabase auth.users)
create table profiles (
  id uuid references auth.users primary key,
  username text,
  display_name text,
  avatar_url text,
  rd_token_encrypted text,        -- Real-Debrid API token (encrypted)
  preferred_languages text[],     -- e.g. ['en', 'es', 'de']
  preferred_quality text,         -- '4k' | '1080p' | '720p'
  created_at timestamptz default now()
);

-- playlists
create table playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  description text,
  is_shared boolean default false,
  cover_tmdb_id integer,          -- TMDB ID for cover image
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- playlist_items
create table playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references playlists(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null,       -- 'movie' | 'tv'
  season_number integer,          -- null for movies
  episode_number integer,         -- null for movies
  position integer not null,      -- order in playlist
  added_at timestamptz default now()
);

-- watch_history
create table watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  tmdb_id integer not null,
  media_type text not null,
  season_number integer,
  episode_number integer,
  progress_seconds integer,       -- current position
  duration_seconds integer,       -- total duration
  completed boolean default false,
  last_watched_at timestamptz default now(),
  unique(user_id, tmdb_id, media_type, season_number, episode_number)
);

-- watchlist (want to watch)
create table watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  tmdb_id integer not null,
  media_type text not null,
  added_at timestamptz default now(),
  unique(user_id, tmdb_id, media_type)
);
```

### 5. Language Filtering

**Multi-level language filtering:**
- **TMDB level:** Filter search results by `original_language` or `spoken_languages`
- **Hash level:** Parse torrent titles for language tags (e.g., "MULTI", "SPANISH", "GERMAN", "ENG+SPA")
- **Stream level:** Filter available streams by detected audio language
- **Subtitle level:** Search OpenSubtitles by language

**User preferences:**
- Set preferred audio languages (e.g., English, Spanish, German)
- Set preferred subtitle languages
- Auto-filter streams to show preferred languages first
- "Show all languages" toggle

### 6. Continue Watching

- Save playback position every 30 seconds to Supabase `watch_history`
- Home page "Continue Watching" row shows unfinished media
- Resume prompt: "Continue from 45:23?" on re-open
- Mark as completed when >90% watched
- For TV shows: auto-advance to next episode

### 7. Multi-User

- Supabase Auth (email/password or magic link)
- Each user has their own:
  - RD token
  - Language preferences
  - Watch history
  - Watchlist
  - Playlists (optionally shared)
- Profile switcher on home screen (like Netflix profiles)
- Shared playlists visible to all household users

### 8. Watchlist

- "Add to Watchlist" button on any movie/show
- Dedicated watchlist page
- Filter by type (movie/tv), genre, language

### 9. Stream Pre-Validation (Health Check)

The killer feature that differentiates StreamVault from Stremio. Before the user clicks Play, streams are validated in the background to guarantee they actually work.

**Problem solved:** In Stremio, you pick a stream → wait → "could not load" → try another → repeat. StreamVault eliminates this by pre-checking streams before you interact with them.

**Validation Pipeline (per stream):**
```
Stream hash (from instantAvailability)
        ↓
1. FULL RESOLVE through Real-Debrid
   ├── addMagnet
   ├── selectFiles (pick largest video file)
   ├── Poll for status "downloaded" (max 10s)
   └── unrestrictLink → get HTTPS URL
        ↓
2. HEAD REQUEST on the HTTPS URL
   ├── HTTP 200? ✓
   ├── Content-Type contains "video/"? ✓
   ├── Content-Length plausible (>50MB for movies)? ✓
   └── Response within 5s? ✓
        ↓
3. RANGE REQUEST (first 512KB)
   ├── Detect video file signature:
   │   ├── MP4: bytes[4..7] == "ftyp"
   │   ├── MKV/WebM: bytes[0..3] == 0x1A45DFA3
   │   ├── AVI: "RIFF" + "AVI" header
   │   └── MPEG-TS: sync byte 0x47
   ├── Measure download speed (MB/s)
   └── Confirm non-zero data
        ↓
4. CLEANUP
   └── DELETE /torrents/delete/{id} (remove from RD account)
        ↓
Result: Stream gets a health status
   🟢 verified — URL works, video confirmed, speed measured
   🟡 pending  — Not yet checked
   🔴 dead     — Resolve failed, URL broken, or not video
```

**Batch Validation via SSE:**
```
Client opens EventSource:
GET /api/stream/validate-batch?hashes=abc,def,ghi&token=xxx&max=5

Server validates top 5 streams concurrently (2 at a time):
  event: validation
  data: { hash: "abc", status: "verified", url: "https://cdn...", speed: 12.5 }

  event: validation
  data: { hash: "def", status: "dead", error: "No video files found" }

  event: done
  data: { validated: 5, verified: 3, dead: 2 }
```

**Client-side behavior:**
- Streams initially appear with 🟡 (pending) status
- Background validation starts automatically when streams load
- UI updates live as each stream is validated (🟡 → 🟢 or 🔴)
- Verified streams bubble to the top of the list
- Dead streams are hidden by default (toggle to show)
- "Best stream ready" banner appears when first 🟢 stream is available
- Speed indicator (MB/s) shown next to verified streams
- Pre-resolved URLs are cached client-side (45min TTL)
- Clicking a verified stream plays instantly (URL already resolved)
- Re-check button on dead streams for manual retry

**Rate limit handling:**
- Max 5-8 streams validated per search (configurable)
- Concurrency limit of 2 parallel validations
- Early exit: stop after 3 verified streams found
- RD API allows ~250 requests/min — validation uses ~5 calls per stream

**API Routes:**
```
POST /api/stream/validate        — Validate single stream
  Body: { hash, token, fileIndex?, cleanup? }
  Response: { hash, status, url?, speed?, error?, ... }

GET  /api/stream/validate-batch  — SSE batch validation
  Query: hashes, token, max
  Events: validation (per stream), done (summary)
```

---

## TV Navigation (Phase 2 Prep)

Even in Phase 1, build with TV in mind:

**Focus Management:**
```css
/* All interactive elements need visible focus */
.focusable:focus-visible {
  outline: 3px solid var(--color-accent);
  outline-offset: 2px;
  transform: scale(1.05);
  transition: all 0.15s ease;
}
```

**Keyboard/D-Pad Mapping:**
| Remote Button  | Key Event    | Action                    |
|----------------|--------------|---------------------------|
| OK / Select    | Enter        | Activate focused element  |
| Back           | Escape / Backspace | Go back / Close modal |
| Up/Down/L/R    | Arrow keys   | Navigate focus            |
| Play/Pause     | Space        | Toggle playback           |
| Fast Forward   | Right (held) | Seek forward              |
| Rewind         | Left (held)  | Seek backward             |

**composables/useTVNavigation.ts:**
- Track focused element
- Arrow key navigation between grid items
- Spatial navigation (move focus in 2D grid)
- Scroll into view on focus change

---

## API Keys & Environment Variables

```env
# .env
TMDB_API_KEY=your_tmdb_v3_api_key
TMDB_BASE_URL=https://api.themoviedb.org/3

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# Hash sources
ZILEAN_API_URL=https://zilean.elfhosted.com
TORRENTIO_API_URL=https://torrentio.strem.fun

# OpenSubtitles
OPENSUBTITLES_API_KEY=your_api_key
OPENSUBTITLES_BASE_URL=https://api.opensubtitles.com/api/v1

# Encryption key for RD tokens stored in Supabase
RD_TOKEN_ENCRYPTION_KEY=random_32_char_string
```

---

## Design Direction

**Aesthetic:** Dark, cinematic, minimal. Think: a premium streaming app, not a torrent client.

**Colors:**
- Background: near-black (#0A0A0F)
- Surface: dark gray (#15151F)
- Accent: warm amber (#F59E0B) — for focus states, CTAs
- Text primary: white (#F5F5F5)
- Text secondary: muted gray (#9CA3AF)

**Typography:**
- Headings: bold, clean sans-serif
- Body: light weight, high readability on dark bg

**Layout:**
- Sidebar navigation (collapsible on TV)
- Content area with horizontal scroll rows (Netflix-style)
- Detail pages with backdrop hero image
- Player: fullscreen with overlay controls

---

## Development Phases

### Phase 1: Web MVP (Weeks 1-3)
- [x] Project setup (Nuxt 3 + Tailwind + Supabase)
- [ ] TMDB integration (search, trending, details)
- [ ] Real-Debrid token setup in settings
- [ ] Hash search (Zilean)
- [ ] Stream resolution pipeline
- [ ] Video player with basic controls
- [ ] Continue watching
- [ ] Basic auth (single user)

### Phase 2: Full Features (Weeks 4-6)
- [ ] Playlists (CRUD)
- [ ] Language filtering (multi-level)
- [ ] Watchlist
- [ ] Subtitle integration (OpenSubtitles)
- [ ] Multi-user profiles
- [ ] Quality preferences
- [ ] PWA setup

### Phase 3: TV App (Weeks 7-8)
- [ ] D-Pad navigation polish
- [ ] Capacitor Android TV wrapper
- [ ] Remote control optimization
- [ ] Sideload on Google TV / Hisense
- [ ] Play Store submission (optional)

---

## Running the Project

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Android TV (Phase 2)
npx cap add android
npx cap sync
npx cap open android   # Opens in Android Studio
```
