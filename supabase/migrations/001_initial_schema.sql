-- StreamVault Database Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  display_name text,
  avatar_url text,
  rd_token_encrypted text,
  preferred_languages text[] default array['en']::text[],
  preferred_subtitle_languages text[] default array['en']::text[],
  preferred_quality text default '1080p',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PLAYLISTS
-- ============================================================
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  is_shared boolean default false,
  cover_tmdb_id integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_playlists_user_id on public.playlists(user_id);

-- ============================================================
-- PLAYLIST ITEMS
-- ============================================================
create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid references public.playlists(id) on delete cascade not null,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  season_number integer,
  episode_number integer,
  position integer not null default 0,
  added_at timestamptz default now()
);

create index if not exists idx_playlist_items_playlist on public.playlist_items(playlist_id);

-- ============================================================
-- WATCH HISTORY
-- ============================================================
create table if not exists public.watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  season_number integer,
  episode_number integer,
  progress_seconds integer default 0,
  duration_seconds integer default 0,
  completed boolean default false,
  last_watched_at timestamptz default now()
);

-- Upsert constraint: one entry per user+media+episode
create unique index if not exists idx_watch_history_unique
  on public.watch_history(user_id, tmdb_id, media_type, coalesce(season_number, -1), coalesce(episode_number, -1));

create index if not exists idx_watch_history_user on public.watch_history(user_id, last_watched_at desc);

-- ============================================================
-- WATCHLIST
-- ============================================================
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  added_at timestamptz default now()
);

create unique index if not exists idx_watchlist_unique
  on public.watchlist(user_id, tmdb_id, media_type);

create index if not exists idx_watchlist_user on public.watchlist(user_id, added_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Profiles: users can read/update their own
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Playlists: own + shared
alter table public.playlists enable row level security;

create policy "Users can view own and shared playlists"
  on public.playlists for select
  using (auth.uid() = user_id or is_shared = true);

create policy "Users can insert own playlists"
  on public.playlists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own playlists"
  on public.playlists for update
  using (auth.uid() = user_id);

create policy "Users can delete own playlists"
  on public.playlists for delete
  using (auth.uid() = user_id);

-- Playlist items: accessible if playlist is accessible
alter table public.playlist_items enable row level security;

create policy "Users can view playlist items"
  on public.playlist_items for select
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_items.playlist_id
      and (playlists.user_id = auth.uid() or playlists.is_shared = true)
    )
  );

create policy "Users can insert into own playlists"
  on public.playlist_items for insert
  with check (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_items.playlist_id
      and playlists.user_id = auth.uid()
    )
  );

create policy "Users can delete from own playlists"
  on public.playlist_items for delete
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_items.playlist_id
      and playlists.user_id = auth.uid()
    )
  );

create policy "Users can update own playlist items"
  on public.playlist_items for update
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_items.playlist_id
      and playlists.user_id = auth.uid()
    )
  );

-- Watch history: own only
alter table public.watch_history enable row level security;

create policy "Users can view own watch history"
  on public.watch_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own watch history"
  on public.watch_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update own watch history"
  on public.watch_history for update
  using (auth.uid() = user_id);

-- Watchlist: own only
alter table public.watchlist enable row level security;

create policy "Users can view own watchlist"
  on public.watchlist for select
  using (auth.uid() = user_id);

create policy "Users can insert own watchlist"
  on public.watchlist for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own watchlist"
  on public.watchlist for delete
  using (auth.uid() = user_id);
