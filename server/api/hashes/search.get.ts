export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const imdb = String(query.imdb || '')
  const season = query.season ? Number(query.season) : undefined
  const episode = query.episode ? Number(query.episode) : undefined

  if (!imdb) {
    throw createError({ statusCode: 400, message: 'IMDB ID is required' })
  }

  return searchHashes(imdb, { season, episode })
})
