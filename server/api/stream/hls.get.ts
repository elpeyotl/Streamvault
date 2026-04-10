import { spawn, execSync } from 'child_process'
import { createError, getQuery, setResponseHeaders } from 'h3'
import { mkdirSync, existsSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

const HLS_BASE = '/tmp/streamvault-hls'
const SESSION_TTL = 60 * 60 * 1000 // 1 hour

const sessions = new Map<string, {
  pid: number
  dir: string
  createdAt: number
  url: string
}>()

/**
 * HLS transcoding endpoint.
 *
 * GET /api/stream/hls?url=<url>                        → probe + start transcode, return session info
 * GET /api/stream/hls?session=<id>&file=playlist.m3u8  → serve playlist
 * GET /api/stream/hls?session=<id>&file=seg000.ts      → serve segment
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  // Serve existing session files
  if (query.session && query.file) {
    return serveSessionFile(String(query.session), String(query.file), event)
  }

  // Start new transcode
  const url = String(query.url || '')
  if (!url) {
    throw createError({ statusCode: 400, message: 'url parameter is required' })
  }

  const audioTrackIndex = Number(query.audioTrack) || 0
  const seekTo = Number(query.seek) || 0
  const ffmpegPath = findBinary('ffmpeg')
  if (!ffmpegPath) {
    throw createError({ statusCode: 500, message: 'ffmpeg not available' })
  }

  // Probe media for duration, tracks, codec info
  const probe = await probeMedia(url)

  // Create session
  const sessionId = createHash('md5').update(url + Date.now()).digest('hex').substring(0, 12)
  const sessionDir = join(HLS_BASE, sessionId)
  mkdirSync(sessionDir, { recursive: true })

  const playlistPath = join(sessionDir, 'playlist.m3u8')

  // Build ffmpeg args with explicit stream mapping
  const ffmpegArgs = [
    '-hide_banner',
    // Seek before input for fast seeking (keyframe-accurate)
    ...(seekTo > 0 ? ['-ss', String(seekTo)] : []),
    '-i', url,
    '-map', '0:v:0',                             // First video stream
    '-map', `0:a:${audioTrackIndex}?`,            // Selected audio track (? = optional)
    '-c:v', 'copy',                               // Copy video (fast)
    '-c:a', 'aac',                                // Transcode audio to AAC
    '-b:a', '192k',
    '-ac', '2',
    '-f', 'hls',
    '-hls_time', '6',                             // 6 second segments
    '-hls_list_size', '0',                        // Keep all segments in playlist
    '-hls_playlist_type', 'event',                // Tells players this is finite, not live
    '-start_number', '0',
    '-hls_segment_filename', join(sessionDir, 'seg%03d.ts'),
    '-hls_flags', 'independent_segments+temp_file',
    playlistPath,
  ]

  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] })

  ffmpeg.stderr.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg && !msg.startsWith('frame=') && !msg.startsWith('size=')) {
      console.warn(`[hls:${sessionId}]`, msg)
    }
  })

  ffmpeg.on('close', (code) => {
    if (code !== 0) console.error(`[hls:${sessionId}] ffmpeg exited with code ${code}`)
    setTimeout(() => cleanupSession(sessionId), SESSION_TTL)
  })

  sessions.set(sessionId, {
    pid: ffmpeg.pid!,
    dir: sessionDir,
    createdAt: Date.now(),
    url,
  })

  // Wait for first segment
  const ready = await waitForFile(playlistPath, 30000)
  if (!ready) {
    cleanupSession(sessionId)
    throw createError({ statusCode: 504, message: 'Transcode timeout — ffmpeg could not process the stream' })
  }

  // Build resolution string
  const resolution = probe.width && probe.height ? `${probe.width}x${probe.height}` : ''

  return {
    session: sessionId,
    playlist: `/api/stream/hls?session=${sessionId}&file=playlist.m3u8`,
    duration: probe.duration,
    seekOffset: seekTo,
    audioTracks: probe.audioTracks,
    subtitleTracks: probe.subtitleTracks,
    videoCodec: probe.videoCodec,
    resolution,
  }
})

function serveSessionFile(sessionId: string, filename: string, event: any) {
  const dir = join(HLS_BASE, sessionId)
  if (!sessions.has(sessionId) && !existsSync(dir)) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(dir, safeName)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const data = readFileSync(filePath)

  if (safeName.endsWith('.m3u8')) {
    let playlist = data.toString()
    playlist = playlist.replace(/^(seg\d+\.ts)$/gm, `/api/stream/hls?session=${sessionId}&file=$1`)

    setResponseHeaders(event, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache',
    })
    return playlist
  }

  if (safeName.endsWith('.ts')) {
    setResponseHeaders(event, {
      'Content-Type': 'video/mp2t',
      'Cache-Control': 'max-age=3600',
    })
    return data
  }

  throw createError({ statusCode: 400, message: 'Unknown file type' })
}

async function waitForFile(path: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (existsSync(path)) {
      const content = readFileSync(path, 'utf-8')
      if (content.includes('.ts')) return true
    }
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session) {
    try { process.kill(session.pid, 'SIGTERM') } catch { /* already dead */ }
    sessions.delete(sessionId)
  }
  const dir = join(HLS_BASE, sessionId)
  if (existsSync(dir)) {
    try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ }
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) cleanupSession(id)
  }
}, 5 * 60 * 1000)

// ── Binary resolution ──

const _binaryCache = new Map<string, string | false>()

function findBinary(name: string): string | null {
  const cached = _binaryCache.get(name)
  if (cached !== undefined) return cached || null

  try {
    const path = execSync(`which ${name} 2>/dev/null`, { encoding: 'utf-8' }).trim()
    if (path) { _binaryCache.set(name, path); return path }
  } catch { /* not in PATH */ }

  for (const p of [`/opt/homebrew/bin/${name}`, `/usr/local/bin/${name}`, `/usr/bin/${name}`]) {
    try { execSync(`"${p}" -version`, { stdio: 'ignore' }); _binaryCache.set(name, p); return p }
    catch { /* not here */ }
  }

  _binaryCache.set(name, false)
  return null
}
