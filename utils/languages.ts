export const LANGUAGES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  sv: 'Swedish',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  cs: 'Czech',
  hu: 'Hungarian',
  ro: 'Romanian',
  el: 'Greek',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  tl: 'Filipino',
  multi: 'Multi-Language',
}

export function getLanguageName(code: string): string {
  return LANGUAGES[code] || code.toUpperCase()
}

export function getLanguageFlag(code: string): string {
  const flags: Record<string, string> = {
    en: '🇬🇧', es: '🇪🇸', de: '🇩🇪', fr: '🇫🇷', it: '🇮🇹',
    pt: '🇵🇹', nl: '🇳🇱', sv: '🇸🇪', ru: '🇷🇺', ja: '🇯🇵',
    ko: '🇰🇷', zh: '🇨🇳', ar: '🇸🇦', hi: '🇮🇳', tr: '🇹🇷',
    pl: '🇵🇱', da: '🇩🇰', fi: '🇫🇮', no: '🇳🇴', multi: '🌍',
  }
  return flags[code] || '🏳️'
}

export const LANGUAGE_OPTIONS = Object.entries(LANGUAGES)
  .filter(([code]) => code !== 'multi')
  .map(([code, name]) => ({ code, name, flag: getLanguageFlag(code) }))
  .sort((a, b) => a.name.localeCompare(b.name))
