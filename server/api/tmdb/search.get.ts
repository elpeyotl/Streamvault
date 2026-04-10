export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q || '')
  const type = String(query.type || 'multi') as 'movie' | 'tv' | 'multi'
  const page = Number(query.page) || 1
  const language = query.language ? String(query.language) : undefined

  if (!q) {
    throw createError({ statusCode: 400, message: 'Query parameter "q" is required' })
  }

  if (type === 'multi') {
    return searchMulti(q, page)
  }

  return searchTMDB(q, type, page, language)
})
