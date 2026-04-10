export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { hashes, token } = body as { hashes: string[]; token: string }

  if (!hashes?.length || !token) {
    throw createError({ statusCode: 400, message: 'hashes[] and token are required' })
  }

  return await checkCachedHashes(hashes, token)
})
