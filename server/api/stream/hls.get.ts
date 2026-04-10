import { spawn, execSync } from 'child_process'
import { createError, getQuery, setResponseHeaders } from 'h3'
import { mkdirSync, existsSync, readFileSync, readdirSync, statSync, rmSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'

const HLS_BASE = '/tmp/streamvault-hls'
const SESSION_TTL = 60 * 60 * 1000 // 1 hour

// Track active sessions
const sessions = new Map<string, {
  pid: number
  dir: string
  createdAt: number
  url: string
}>()

/**
 * HLS transcoding endpoint.
 *
 * GET /api/stream/hls?url=<encoded_url>                → starts transcode, returns m3u8
 * GET /api/stream/hls?session=<id>&file=playlist.m3u8  → serves playlist
 * GET /api/stream/hls?session=<id>&file=seg000.ts      → serves segment
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

  const ffmpegPath = findBinary('ffmpeg')
  if (!ffmpegPath) {
    throw createError({ statusCode: 500, message: 'ffmpeg not available' })
  }

  // Create session
  const sessionId = createHash('md5').update(url + Date.now()).digest('hex').substring(0, 12)
  const sessionDir = join(HLS_BASE, sessionId)
  mkdirSync(sessionDir, { recursive: true })

  const playlistPath = join(sessionDir, 'playlist.m3u8')

  // Start ffmpeg HLS transcoding
  const ffmpeg = spawn(ffmpegPath, [
    '-hide_banner',
    '-i', url,
    '-c:v', 'copy',              // Copy video (fast)
    '-c:a', 'aac',               // Transcode audio to AAC
    '-b:a', '192k',
    '-ac', '2',
    '-f', 'hls',
    '-hls_time', '6',            // 6 second segments
    '-hls_list_size', '0',       // Keep all segments in playlist
    '-hls_segment_filename', join(sessionDir, 'seg%03d.ts'),
    '-hls_flags', 'independent_segments+temp_file',
    playlistPath,
  ], { stdio: ['ignore', 'ignore', 'pipe'] })

  ffmpeg.stderr.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg && !msg.startsWith('frame=')) {
      console.warn(`[hls:${sessionId}]`, msg)
    }
  })

  ffmpeg.on('close', (code) => {
    if (code !== 0) console.error(`[hls:${sessionId}] ffmpeg exited with code ${code}`)
  })

  sessions.set(sessionId, {
    pid: ffmpeg.pid!,
    dir: sessionDir,
    createdAt: Date.now(),
    url,
  })

  // Clean up on process exit
  ffmpeg.on('close', () => {
    // Don't remove session immediately — client still needs to read segments
    setTimeout(() => cleanupSession(sessionId), SESSION_TTL)
  })

  // Wait for the playlist to be created (ffmpeg needs to process first segment)
  const ready = await waitForFile(playlistPath, 30000)
  if (!ready) {
    cleanupSession(sessionId)
    throw createError({ statusCode: 504, message: 'Transcode timeout — ffmpeg could not process the stream' })
  }

  // Return the playlist URL
  const playlistUrl = `/api/stream/hls?session=${sessionId}&file=playlist.m3u8`
  return { session: sessionId, playlist: playlistUrl }
})

function serveSessionFile(sessionId: string, filename: string, event: any) {
  const session = sessions.get(sessionId)
  if (!session) {
    // Session might have been cleaned up, but files might still exist
    const dir = join(HLS_BASE, sessionId)
    if (!existsSync(dir)) {
      throw createError({ statusCode: 404, message: 'Session not found' })
    }
  }

  // Sanitize filename to prevent path traversal
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '')
  const filePath = join(HLS_BASE, sessionId, safeName)

  if (!existsSync(filePath)) {
    throw createError({ statusCode: 404, message: 'File not found' })
  }

  const data = readFileSync(filePath)

  if (safeName.endsWith('.m3u8')) {
    // Rewrite segment paths in the playlist to go through our API
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
      // Wait a bit more for the first segment to be ready
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

// Periodic cleanup of stale sessions
setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      cleanupSession(id)
    }
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
