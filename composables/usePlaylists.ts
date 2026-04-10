import type { Playlist, PlaylistItem } from '~/types/playlist'

export function usePlaylists() {
  const client = useSafeSupabaseClient()
  const user = useSafeSupabaseUser()

  async function getPlaylists(): Promise<Playlist[]> {
    if (!user.value) return []

    const { data } = await client
      .from('playlists')
      .select('*, playlist_items(count)')
      .or(`user_id.eq.${user.value.id},is_shared.eq.true`)
      .order('updated_at', { ascending: false })

    return (data || []).map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      title: p.title,
      description: p.description,
      isShared: p.is_shared,
      coverTmdbId: p.cover_tmdb_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      itemCount: p.playlist_items?.[0]?.count || 0,
    }))
  }

  async function createPlaylist(title: string, description?: string): Promise<Playlist | null> {
    if (!user.value) return null

    const { data, error } = await client
      .from('playlists')
      .insert({
        user_id: user.value.id,
        title,
        description: description || null,
      })
      .select()
      .single()

    if (error) { console.error('Failed to create playlist:', error); return null }
    return data as unknown as Playlist
  }

  async function deletePlaylist(id: string) {
    await client.from('playlists').delete().eq('id', id)
  }

  async function updatePlaylist(id: string, updates: { title?: string; description?: string; isShared?: boolean }) {
    const mapped: Record<string, any> = {}
    if (updates.title !== undefined) mapped.title = updates.title
    if (updates.description !== undefined) mapped.description = updates.description
    if (updates.isShared !== undefined) mapped.is_shared = updates.isShared
    mapped.updated_at = new Date().toISOString()

    await client.from('playlists').update(mapped).eq('id', id)
  }

  async function getPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
    const { data } = await client
      .from('playlist_items')
      .select('*')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: true })

    return (data || []) as unknown as PlaylistItem[]
  }

  async function addToPlaylist(playlistId: string, item: {
    tmdbId: number
    mediaType: 'movie' | 'tv'
    seasonNumber?: number
    episodeNumber?: number
  }) {
    // Get current max position
    const { data: existing } = await client
      .from('playlist_items')
      .select('position')
      .eq('playlist_id', playlistId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existing?.length ? (existing[0] as any).position + 1 : 0

    await client.from('playlist_items').insert({
      playlist_id: playlistId,
      tmdb_id: item.tmdbId,
      media_type: item.mediaType,
      season_number: item.seasonNumber || null,
      episode_number: item.episodeNumber || null,
      position: nextPosition,
    })

    // Update playlist timestamp
    await client.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', playlistId)
  }

  async function removeFromPlaylist(itemId: string) {
    await client.from('playlist_items').delete().eq('id', itemId)
  }

  async function reorderPlaylistItem(playlistId: string, itemId: string, newPosition: number) {
    await client
      .from('playlist_items')
      .update({ position: newPosition })
      .eq('id', itemId)
      .eq('playlist_id', playlistId)
  }

  // Watchlist (special case — no playlist needed)
  async function addToWatchlist(tmdbId: number, mediaType: 'movie' | 'tv') {
    if (!user.value) return
    await client.from('watchlist').upsert({
      user_id: user.value.id,
      tmdb_id: tmdbId,
      media_type: mediaType,
    }, { onConflict: 'user_id,tmdb_id,media_type' })
  }

  async function removeFromWatchlist(tmdbId: number, mediaType: 'movie' | 'tv') {
    if (!user.value) return
    await client
      .from('watchlist')
      .delete()
      .eq('user_id', user.value.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
  }

  async function getWatchlist() {
    if (!user.value) return []
    const { data } = await client
      .from('watchlist')
      .select('*')
      .eq('user_id', user.value.id)
      .order('added_at', { ascending: false })
    return data || []
  }

  async function isInWatchlist(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<boolean> {
    if (!user.value) return false
    const { data } = await client
      .from('watchlist')
      .select('id')
      .eq('user_id', user.value.id)
      .eq('tmdb_id', tmdbId)
      .eq('media_type', mediaType)
      .limit(1)
    return (data?.length || 0) > 0
  }

  return {
    getPlaylists,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    getPlaylistItems,
    addToPlaylist,
    removeFromPlaylist,
    reorderPlaylistItem,
    addToWatchlist,
    removeFromWatchlist,
    getWatchlist,
    isInWatchlist,
  }
}
