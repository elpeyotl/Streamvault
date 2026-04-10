export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!id) throw createError({ statusCode: 400, message: 'TV ID is required' })

  const query = getQuery(event)
  const season = query.season ? Number(query.season) : undefined

  const detail = await getTVDetail(id)

  // If season requested, also fetch season detail with episodes
  if (season !== undefined) {
    const seasonDetail = await getSeasonDetail(id, season)
    return { ...detail, seasonDetail }
  }

  return detail
})
