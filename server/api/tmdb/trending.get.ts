export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const type = String(query.type || 'all') as 'movie' | 'tv' | 'all'
  const timeWindow = String(query.window || 'week') as 'day' | 'week'

  return getTrending(type, timeWindow)
})
