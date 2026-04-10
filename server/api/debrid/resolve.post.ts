export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { hash, token, fileIndex } = body as { hash: string; token: string; fileIndex?: number }

  if (!hash || !token) {
    throw createError({ statusCode: 400, message: 'hash and token are required' })
  }

  const result = await resolveHashToStream(hash, token, fileIndex)

  return {
    url: result.download,
    filename: result.filename,
    filesize: result.filesize,
    mimeType: result.mimeType,
  }
})
