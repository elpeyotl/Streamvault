export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imdb = String(query.imdb || '')
  const languages = query.languages ? String(query.languages).split(',') : undefined
  const season = query.season ? Number(query.season) : undefined
  const episode = query.episode ? Number(query.episode) : undefined

  if (!imdb) {
    throw createError({ statusCode: 400, message: 'IMDB ID is required' })
  }

  const config = useRuntimeConfig()
  console.log(`[subtitles] API key loaded: ${config.opensubtitlesApiKey ? 'yes (' + config.opensubtitlesApiKey.substring(0, 6) + '...)' : 'NO'}`)

  return searchSubtitles(imdb, { languages, season, episode })
})
