import { spawn, execSync } from 'child_process'
import { createError, getQuery, setResponseHeaders } from 'h3'

/**
 * Transcoding proxy: streams a remote video URL through ffmpeg,
 * remuxing to MP4 and transcoding audio to AAC for browser compatibility.
 *
 * GET /api/stream/proxy?url=<encoded_url>
 *
 * Always copies video (no re-encoding) — fast and lossless.
 * Always transcodes audio to AAC — fixes AC3/EAC3/DTS that browsers can't decode.
 */
export default defineEventHandler((event) => {
  const query = getQuery(event)
  const url = String(query.url || '')

  if (!url) {
    throw createError({ statusCode: 400, message: 'url parameter is required' })
  }

  const ffmpegPath = findBinary('ffmpeg')
  if (!ffmpegPath) {
    return sendRedirect(event, url, 302)
  }

  // Return a promise that resolves only when ffmpeg is done —
  // this keeps the H3 handler alive for the duration of the stream.
  return new Promise<void>((resolve) => {
    const res = event.node.res

    setResponseHeaders(event, {
      'Content-Type': 'video/mp4',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'none',
    })

    const ffmpeg = spawn(ffmpegPath, [
      '-hide_banner',
      '-i', url,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ac', '2',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      '-f', 'mp4',
      '-loglevel', 'warning',
      'pipe:1',
    ])

    ffmpeg.stdout.pipe(res)

    ffmpeg.stderr.on('data', (data: Buffer) => {
      console.warn('[ffmpeg]', data.toString().trim())
    })

    ffmpeg.on('error', (err) => {
      console.error('[ffmpeg] spawn error:', err.message)
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('ffmpeg error')
      }
      resolve()
    })

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        console.error(`[ffmpeg] exited with code ${code}`)
      }
      if (!res.writableEnded) {
        res.end()
      }
      resolve()
    })

    // If client disconnects, kill ffmpeg
    res.on('close', () => {
      if (!ffmpeg.killed) {
        ffmpeg.kill('SIGTERM')
      }
      resolve()
    })
  })
})

// ── Binary resolution ──

const _binaryCache = new Map<string, string | false>()

function findBinary(name: string): string | null {
  const cached = _binaryCache.get(name)
  if (cached !== undefined) return cached || null

  try {
    const path = execSync(`which ${name} 2>/dev/null`, { encoding: 'utf-8' }).trim()
    if (path) { _binaryCache.set(name, path); return path }
  } catch { /* not in PATH */ }

  const commonPaths = [
    `/opt/homebrew/bin/${name}`,
    `/usr/local/bin/${name}`,
    `/usr/bin/${name}`,
    `/snap/bin/${name}`,
  ]

  for (const p of commonPaths) {
    try {
      execSync(`"${p}" -version`, { stdio: 'ignore' })
      _binaryCache.set(name, p)
      return p
    } catch { /* not here */ }
  }

  _binaryCache.set(name, false)
  return null
}
