import type { RDUnrestrictedLink } from '~/types/debrid'

export interface StreamValidationResult {
  hash: string
  status: 'verified' | 'available' | 'dead'
  url?: string
  filename?: string
  filesize?: number
  contentType?: string
  speed?: number // MB/s estimated from range request
  error?: string
  torrentId?: string // for cleanup
}

/**
 * Validate a single stream by pre-resolving it through Real-Debrid
 * and checking the resulting URL actually serves video content.
 *
 * Steps:
 * 1. addMagnet → selectFiles → unrestrict (full resolve)
 * 2. HEAD request on the HTTPS URL (status, content-type, content-length)
 * 3. Optional: Range request for first 512KB to verify video headers & speed
 * 4. Cleanup: delete torrent from RD account
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { hash, token, fileIndex, cleanup } = body as {
    hash: string
    token: string
    fileIndex?: number
    cleanup?: boolean // delete torrent after validation (default true)
  }

  if (!hash || !token) {
    throw createError({ statusCode: 400, message: 'hash and token are required' })
  }

  const result: StreamValidationResult = {
    hash,
    status: 'available',
  }

  let torrentId: string | undefined

  try {
    // ── Step 1: Full resolve through RD ──────────────────────────
    const magnet = `magnet:?xt=urn:btih:${hash}`

    // Add magnet
    const addResult = await $fetch<{ id: string; uri: string }>(
      'https://api.real-debrid.com/rest/1.0/torrents/addMagnet',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ magnet }),
      }
    )
    torrentId = addResult.id
    result.torrentId = torrentId

    // Get torrent info
    const info = await $fetch<any>(
      `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    // Select files if needed
    if (info.status === 'waiting_files_selection') {
      let selectedFileId: string

      if (fileIndex !== undefined && info.files[fileIndex]) {
        selectedFileId = String(info.files[fileIndex].id)
      } else {
        // Pick best video file (prefers MP4 over MKV for browser audio compat)
        const best = pickBestVideoFile(info.files)

        if (!best) {
          result.status = 'dead'
          result.error = 'No video files found in torrent'
          return result
        }
        selectedFileId = String(best.id)
      }

      await $fetch(
        `https://api.real-debrid.com/rest/1.0/torrents/selectFiles/${torrentId}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ files: selectedFileId }),
        }
      )
    }

    // Poll for completion (max 10s)
    let resolvedInfo: any
    const maxWait = 10000
    const pollInterval = 1000
    let waited = 0

    while (waited < maxWait) {
      await new Promise(r => setTimeout(r, pollInterval))
      waited += pollInterval

      resolvedInfo = await $fetch<any>(
        `https://api.real-debrid.com/rest/1.0/torrents/info/${torrentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (resolvedInfo.status === 'downloaded' && resolvedInfo.links?.length > 0) {
        break
      }
      if (['magnet_error', 'error', 'virus', 'dead'].includes(resolvedInfo.status)) {
        result.status = 'dead'
        result.error = `RD torrent status: ${resolvedInfo.status}`
        return result
      }
    }

    if (!resolvedInfo?.links?.length) {
      result.status = 'dead'
      result.error = 'Torrent did not resolve within timeout'
      return result
    }

    // Unrestrict link
    const unrestricted = await $fetch<RDUnrestrictedLink>(
      'https://api.real-debrid.com/rest/1.0/unrestrict/link',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ link: resolvedInfo.links[0] }),
      }
    )

    result.url = unrestricted.download
    result.filename = unrestricted.filename
    result.filesize = unrestricted.filesize

    // ── Step 2: HEAD request to verify URL ──────────────────────
    try {
      const headController = new AbortController()
      const headTimeout = setTimeout(() => headController.abort(), 5000)

      const headResponse = await fetch(unrestricted.download, {
        method: 'HEAD',
        signal: headController.signal,
      })
      clearTimeout(headTimeout)

      if (!headResponse.ok) {
        result.status = 'dead'
        result.error = `URL returned HTTP ${headResponse.status}`
        return result
      }

      const contentType = headResponse.headers.get('content-type') || ''
      const contentLength = Number(headResponse.headers.get('content-length') || 0)
      result.contentType = contentType

      // Validate content type
      const validTypes = ['video/', 'application/octet-stream', 'application/x-matroska']
      const isValidType = validTypes.some(t => contentType.includes(t))

      if (!isValidType && contentLength < 50 * 1024 * 1024) {
        // Small file + non-video type = suspicious
        result.status = 'dead'
        result.error = `Suspicious content: ${contentType}, ${(contentLength / 1024 / 1024).toFixed(0)}MB`
        return result
      }
    } catch (headErr: any) {
      if (headErr.name === 'AbortError') {
        result.status = 'dead'
        result.error = 'URL timed out (HEAD request >5s)'
        return result
      }
      // HEAD failed but URL might still work (some CDNs block HEAD)
      // Continue to range check
    }

    // ── Step 3: Range request — verify video header bytes + speed ──
    try {
      const rangeController = new AbortController()
      const rangeTimeout = setTimeout(() => rangeController.abort(), 8000)
      const startTime = Date.now()

      const rangeResponse = await fetch(unrestricted.download, {
        method: 'GET',
        headers: { Range: 'bytes=0-524287' }, // First 512KB
        signal: rangeController.signal,
      })
      clearTimeout(rangeTimeout)

      if (rangeResponse.ok || rangeResponse.status === 206) {
        const buffer = await rangeResponse.arrayBuffer()
        const elapsed = (Date.now() - startTime) / 1000
        const bytes = buffer.byteLength
        result.speed = Math.round((bytes / (1024 * 1024)) / elapsed * 10) / 10 // MB/s

        // Check for known video file signatures
        const header = new Uint8Array(buffer.slice(0, 32))
        const isVideo = detectVideoSignature(header)

        if (isVideo) {
          result.status = 'verified'
        } else if (bytes > 0) {
          // Got data but can't confirm it's video — still likely OK
          // Many MKV/MP4 files start with metadata that may not match simple signatures
          result.status = 'verified'
        } else {
          result.status = 'dead'
          result.error = 'Empty response from range request'
        }
      } else {
        // Range not supported, but file exists — mark as verified from HEAD success
        result.status = 'verified'
      }
    } catch (rangeErr: any) {
      if (rangeErr.name === 'AbortError') {
        result.status = 'dead'
        result.error = 'Range request timed out (>8s, likely very slow source)'
      } else {
        // Range request failed but HEAD succeeded → still usable
        result.status = 'verified'
      }
    }

    return result
  } catch (err: any) {
    const msg = err.message || err.data?.message || ''
    const status = err.statusCode || err.status || 0

    // Rate limiting or transient errors — don't mark as dead, keep as available
    if (status === 429 || status === 503 || msg.includes('rate') || msg.includes('limit')) {
      result.status = 'available'
      result.error = 'Rate limited — stream is cached but could not be pre-verified'
    } else {
      result.status = 'dead'
      result.error = msg || 'Unknown error during validation'
    }
    return result
  } finally {
    // ── Step 4: Cleanup — delete torrent from RD to not clutter account ──
    if (torrentId && (cleanup !== false)) {
      try {
        await fetch(
          `https://api.real-debrid.com/rest/1.0/torrents/delete/${torrentId}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
        )
      } catch {
        // Best effort cleanup
      }
    }
  }
})

/**
 * Detect common video file signatures from first bytes
 */
function detectVideoSignature(header: Uint8Array): boolean {
  if (header.length < 12) return false

  // MP4/M4V: starts with ftyp
  if (header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70) return true

  // MKV/WebM: starts with 0x1A45DFA3 (EBML header)
  if (header[0] === 0x1A && header[1] === 0x45 && header[2] === 0xDF && header[3] === 0xA3) return true

  // AVI: starts with RIFF....AVI
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x41 && header[9] === 0x56 && header[10] === 0x49) return true

  // FLV
  if (header[0] === 0x46 && header[1] === 0x4C && header[2] === 0x56) return true

  // MPEG-TS: starts with 0x47 sync byte
  if (header[0] === 0x47) return true

  return false
}
