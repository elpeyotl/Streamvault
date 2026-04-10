export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token } = body as { token: string }

  if (!token) {
    throw createError({ statusCode: 400, message: 'token is required' })
  }

  try {
    const user = await validateRDToken(token)
    return {
      valid: true,
      username: user.username,
      email: user.email,
      premium: user.premium > 0,
      expiration: user.expiration,
    }
  } catch {
    return { valid: false }
  }
})
