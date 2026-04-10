import { spawn, execSync } from 'child_process'

export interface ProbeResult {
  duration: number
  audioTracks: ProbeAudioTrack[]
  subtitleTracks: ProbeSubTrack[]
  videoCodec: string
  width: number
  height: number
}

export interface ProbeAudioTrack {
  index: number
  language: string
  codec: string
  title: string
  channels: number
  isDefault: boolean
}

export interface ProbeSubTrack {
  index: number
  language: string
  title: string
}

/**
 * Probe a media URL with ffprobe to extract duration, tracks, and codec info.
 * Uses limited analyzeduration/probesize for fast results (~2-3s).
 */
export async function probeMedia(url: string): Promise<ProbeResult> {
  const ffprobePath = findBinary('ffprobe')
  if (!ffprobePath) {
    return defaultProbeResult()
  }

  return new Promise((resolve) => {
    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      '-analyzeduration', '20000000',
      '-probesize', '20000000',
      url,
    ])

    let output = ''
    proc.stdout.on('data', (data: Buffer) => { output += data.toString() })

    const timeout = setTimeout(() => {
      proc.kill()
      resolve(defaultProbeResult())
    }, 15000)

    proc.on('close', () => {
      clearTimeout(timeout)
      try {
        const data = JSON.parse(output)
        const result = parseProbeOutput(data)
        console.log(`[ffprobe] duration=${result.duration}s, video=${result.videoCodec} ${result.width}x${result.height}, audio tracks=${result.audioTracks.length}`)
        resolve(result)
      } catch (e) {
        console.warn('[ffprobe] parse failed:', e)
        resolve(defaultProbeResult())
      }
    })

    proc.on('error', () => {
      clearTimeout(timeout)
      resolve(defaultProbeResult())
    })
  })
}

function parseProbeOutput(data: any): ProbeResult {
  const streams = data.streams || []
  const format = data.format || {}

  const video = streams.find((s: any) => s.codec_type === 'video')

  const audioTracks: ProbeAudioTrack[] = streams
    .filter((s: any) => s.codec_type === 'audio')
    .map((s: any, i: number) => ({
      index: i,
      language: s.tags?.language || 'und',
      codec: s.codec_name || 'unknown',
      title: s.tags?.title || '',
      channels: s.channels || 2,
      isDefault: s.disposition?.default === 1,
    }))

  const subtitleTracks: ProbeSubTrack[] = streams
    .filter((s: any) => s.codec_type === 'subtitle')
    .map((s: any, i: number) => ({
      index: i,
      language: s.tags?.language || 'und',
      title: s.tags?.title || '',
    }))

  return {
    duration: parseFloat(format.duration) || 0,
    audioTracks,
    subtitleTracks,
    videoCodec: video?.codec_name || 'unknown',
    width: video?.width || 0,
    height: video?.height || 0,
  }
}

function defaultProbeResult(): ProbeResult {
  return {
    duration: 0,
    audioTracks: [],
    subtitleTracks: [],
    videoCodec: 'unknown',
    width: 0,
    height: 0,
  }
}

// ── Binary resolution (shared pattern) ──

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
