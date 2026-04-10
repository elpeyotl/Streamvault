import type { StreamQuality } from '~/types/stream'

export const QUALITY_ORDER: StreamQuality[] = ['4k', '2160p', '1080p', '720p', '480p', 'unknown']

export function qualityLabel(q: StreamQuality): string {
  const labels: Record<StreamQuality, string> = {
    '4k': '4K UHD',
    '2160p': '4K',
    '1080p': '1080p',
    '720p': '720p',
    '480p': '480p',
    'unknown': 'SD',
  }
  return labels[q] || q
}

export function qualityColor(q: StreamQuality): string {
  switch (q) {
    case '4k':
    case '2160p': return 'text-yellow-400'
    case '1080p': return 'text-green-400'
    case '720p': return 'text-blue-400'
    default: return 'text-vault-muted'
  }
}
