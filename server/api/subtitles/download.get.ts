/**
 * Download a subtitle file as WebVTT.
 * GET /api/subtitles/download?fileId=12345
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const fileId = Number(query.fileId)

  if (!fileId) {
    throw createError({ statusCode: 400, message: 'fileId is required' })
  }

  const vtt = await downloadSubtitleAsVtt(fileId)

  setResponseHeaders(event, {
    'Content-Type': 'text/vtt; charset=utf-8',
    'Cache-Control': 'max-age=3600',
  })

  return vtt
})
