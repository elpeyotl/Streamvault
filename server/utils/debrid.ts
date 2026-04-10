import type { RDUser, RDAddMagnetResponse, RDTorrentInfo, RDUnrestrictedLink, RDCachedResult } from '~/types/debrid'

const RD_BASE = 'https://api.real-debrid.com/rest/1.0'

async function rdFetch<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${RD_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const error = await response.text()
    throw createError({
      statusCode: response.status,
      message: `Real-Debrid API error: ${error}`,
    })
  }

  return response.json()
}

/**
 * Validate a Real-Debrid token and return user info
 */
export async function validateRDToken(token: string): Promise<RDUser> {
  return rdFetch<RDUser>('/user', token)
}

/**
 * Check which hashes are cached on Real-Debrid.
 *
 * Since /torrents/instantAvailability was deprecated (error_code 37),
 * we use addMagnet → getTorrentInfo to check if it's instantly ready.
 * If status is "waiting_files_selection" or "downloaded", it's cached.
 * Each magnet is cleaned up (deleted) after checking.
 *
 * Processes hashes in parallel batches to stay within RD rate limits.
 */
export async function checkCachedHashes(
  hashes: string[],
  token: string,
): Promise<Record<string, RDCachedResult>> {
  if (hashes.length === 0) return {}

  const results: Record<string, RDCachedResult> = {}
  const concurrency = 2 // Keep low to avoid RD rate limits (~250 req/min)

  for (let i = 0; i < hashes.length; i += concurrency) {
    const batch = hashes.slice(i, i + concurrency)

    const settled = await Promise.allSettled(
      batch.map(hash => checkSingleHash(hash, token))
    )

    for (let j = 0; j < batch.length; j++) {
      const hash = batch[j]
      if (settled[j].status === 'fulfilled') {
        results[hash] = settled[j].value
      } else {
        console.warn(`[RD] Hash check failed for ${hash.substring(0, 8)}:`, settled[j].reason)
        results[hash] = { cached: false, files: [] }
      }
    }

    // Brief pause between batches to avoid rate limiting
    if (i + concurrency < hashes.length) {
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return results
}

/**
 * Check a single hash: addMagnet → poll info → cleanup.
 * Returns file list if cached.
 */
async function checkSingleHash(hash: string, token: string): Promise<RDCachedResult> {
  let torrentId: string | undefined

  try {
    // Add the magnet
    const magnetResult = await addMagnet(hash, token)
    torrentId = magnetResult.id

    // Poll torrent info — cached torrents settle quickly but may start as magnet_conversion
    const readyStatuses = ['waiting_files_selection', 'downloaded', 'queued', 'compressing', 'uploading']
    const deadStatuses = ['magnet_error', 'error', 'virus', 'dead']
    const maxAttempts = 5
    const pollDelay = 600 // ms

    let info: RDTorrentInfo | undefined

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      info = await getTorrentInfo(torrentId, token)

      if (readyStatuses.includes(info.status)) break
      if (deadStatuses.includes(info.status)) return { cached: false, files: [] }

      // Transient states: magnet_conversion, downloading, etc. — wait briefly
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, pollDelay))
      }
    }

    if (!info || !readyStatuses.includes(info.status)) {
      return { cached: false, files: [] }
    }

    const videoExtensions = ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.ts']
    const videoFiles = info.files
      .filter(f => videoExtensions.some(ext => f.path.toLowerCase().endsWith(ext)))
      .map(f => ({
        id: f.id,
        filename: f.path.split('/').pop() || f.path,
        filesize: f.bytes,
      }))

    return {
      cached: true,
      files: videoFiles.length > 0 ? videoFiles : info.files.map(f => ({
        id: f.id,
        filename: f.path.split('/').pop() || f.path,
        filesize: f.bytes,
      })),
    }
  } catch {
    return { cached: false, files: [] }
  } finally {
    // Always clean up — don't leave orphan torrents on the account
    if (torrentId) {
      try { await deleteTorrent(torrentId, token) } catch { /* best effort */ }
    }
  }
}

/**
 * Add a magnet link to Real-Debrid
 */
export async function addMagnet(hash: string, token: string): Promise<RDAddMagnetResponse> {
  const magnet = `magnet:?xt=urn:btih:${hash}`
  return rdFetch<RDAddMagnetResponse>('/torrents/addMagnet', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ magnet }),
  })
}

/**
 * Get torrent info (files, status, links)
 */
export async function getTorrentInfo(torrentId: string, token: string): Promise<RDTorrentInfo> {
  return rdFetch<RDTorrentInfo>(`/torrents/info/${torrentId}`, token)
}

/**
 * Select files to download from a torrent
 */
export async function selectFiles(torrentId: string, fileIds: string, token: string): Promise<void> {
  await fetch(`${RD_BASE}/torrents/selectFiles/${torrentId}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ files: fileIds }),
  })
}

/**
 * Unrestrict a link — converts a RD download link to a direct HTTPS stream URL
 */
export async function unrestrictLink(link: string, token: string): Promise<RDUnrestrictedLink> {
  return rdFetch<RDUnrestrictedLink>('/unrestrict/link', token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ link }),
  })
}

/**
 * Full resolve pipeline: hash → magnet → select files → unrestrict → stream URL
 */
export async function resolveHashToStream(
  hash: string,
  token: string,
  fileIndex?: number
): Promise<RDUnrestrictedLink> {
  // 1. Add magnet
  const magnetResult = await addMagnet(hash, token)

  // 2. Get torrent info to find the right file
  const info = await getTorrentInfo(magnetResult.id, token)

  // 3. Select the right file
  if (info.status === 'waiting_files_selection') {
    if (fileIndex !== undefined) {
      // Select specific file
      const file = info.files[fileIndex]
      if (file) {
        await selectFiles(magnetResult.id, String(file.id), token)
      }
    } else {
      // Select best video file — prefer MP4 (browser-compatible audio) over MKV
      const best = pickBestVideoFile(info.files)
      if (best) {
        await selectFiles(magnetResult.id, String(best.id), token)
      } else {
        // Fallback: select all
        await selectFiles(magnetResult.id, 'all', token)
      }
    }
  }

  // 4. Wait briefly for RD to process, then get updated info with links
  await new Promise(resolve => setTimeout(resolve, 1000))
  const updatedInfo = await getTorrentInfo(magnetResult.id, token)

  if (!updatedInfo.links || updatedInfo.links.length === 0) {
    throw createError({ statusCode: 500, message: 'No download links available from Real-Debrid' })
  }

  // 5. Unrestrict the first link to get direct HTTPS URL
  return unrestrictLink(updatedInfo.links[0], token)
}

/**
 * Delete a torrent from RD (cleanup)
 */
export async function deleteTorrent(torrentId: string, token: string): Promise<void> {
  await fetch(`${RD_BASE}/torrents/delete/${torrentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  })
}

/**
 * Pick the best video file from a torrent's file list.
 * Prefers MP4/WebM (browser-native codecs) over MKV (often has AC3/DTS audio
 * that browsers can't play). Falls back to largest video file.
 */
export function pickBestVideoFile(files: RDTorrentFile[]): RDTorrentFile | null {
  const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.ts']

  const videoFiles = files.filter(f =>
    videoExtensions.some(ext => f.path.toLowerCase().endsWith(ext))
  )

  if (videoFiles.length === 0) return null

  // Separate browser-friendly (MP4/WebM) from others
  const browserFriendly = videoFiles.filter(f => {
    const p = f.path.toLowerCase()
    return p.endsWith('.mp4') || p.endsWith('.webm')
  })

  // If there's a reasonably sized MP4/WebM (>500MB for movies), prefer it
  const largeFriendly = browserFriendly.filter(f => f.bytes > 500 * 1024 * 1024)
  if (largeFriendly.length > 0) {
    return largeFriendly.sort((a, b) => b.bytes - a.bytes)[0]
  }

  // If there's any MP4/WebM, prefer it over MKV
  if (browserFriendly.length > 0) {
    return browserFriendly.sort((a, b) => b.bytes - a.bytes)[0]
  }

  // Fallback: largest video file (likely MKV)
  return videoFiles.sort((a, b) => b.bytes - a.bytes)[0]
}
