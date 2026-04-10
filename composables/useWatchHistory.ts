import type { WatchHistoryEntry } from '~/types/playlist'

export function useWatchHistory() {
  const client = useSafeSupabaseClient()
  const user = useSafeSupabaseUser()

  async function saveProgress(entry: {
    tmdbId: number
    mediaType: 'movie' | 'tv'
    seasonNumber?: number
    episodeNumber?: number
    progressSeconds: number
    durationSeconds: number
  }) {
    if (!user.value) return

    const completed = entry.durationSeconds > 0 && entry.progressSeconds / entry.durationSeconds > 0.9

    const { error } = await client.from('watch_history').upsert({
      user_id: user.value.id,
      tmdb_id: entry.tmdbId,
      media_type: entry.mediaType,
      season_number: entry.seasonNumber || null,
      episode_number: entry.episodeNumber || null,
      progress_seconds: Math.floor(entry.progressSeconds),
      duration_seconds: Math.floor(entry.durationSeconds),
      completed,
      last_watched_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,tmdb_id,media_type,season_number,episode_number',
    })

    if (error) console.error('Failed to save watch progress:', error)
  }

  async function getProgress(tmdbId: number, mediaType: 'movie' | 'tv', season?: number, episode?: number) {
    if (!user.value) return null

    const query = client
      .from('watch_history')
      .select('*')
      .eq('user_id', user.value.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)

    if (season !== undefined) query.eq('season_number', season)
    if (episode !== undefined) query.eq('episode_number', episode)

    const { data } = await query.single()
    return data as WatchHistoryEntry | null
  }

  async function getContinueWatching(limit = 20): Promise<WatchHistoryEntry[]> {
    if (!user.value) return []

    const { data } = await client
      .from('watch_history')
      .select('*')
      .eq('user_id', user.value.id)
      .eq('completed', false)
      .gt('progress_seconds', 60)
      .order('last_watched_at', { ascending: false })
      .limit(limit)

    return (data || []) as WatchHistoryEntry[]
  }

  async function getRecentlyWatched(limit = 20): Promise<WatchHistoryEntry[]> {
    if (!user.value) return []

    const { data } = await client
      .from('watch_history')
      .select('*')
      .eq('user_id', user.value.id)
      .order('last_watched_at', { ascending: false })
      .limit(limit)

    return (data || []) as WatchHistoryEntry[]
  }

  async function markCompleted(tmdbId: number, mediaType: 'movie' | 'tv', season?: number, episode?: number) {
    if (!user.value) return

    const query = client
      .from('watch_history')
      .update({ completed: true })
      .eq('user_id', user.value.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)

    if (season !== undefined) query.eq('season_number', season)
    if (episode !== undefined) query.eq('episode_number', episode)

    await query
  }

  return {
    saveProgress,
    getProgress,
    getContinueWatching,
    getRecentlyWatched,
    markCompleted,
  }
}
