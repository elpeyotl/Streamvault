export function useRealDebrid() {
  const token = useState<string>('rd-token', () => '')
  const rdUser = useState<{ username: string; premium: boolean; expiration: string } | null>('rd-user', () => null)

  // Load token from localStorage on client
  if (import.meta.client) {
    const saved = localStorage.getItem('streamvault_rd_token')
    if (saved) token.value = saved
  }

  function setToken(newToken: string) {
    token.value = newToken
    if (import.meta.client) {
      localStorage.setItem('streamvault_rd_token', newToken)
    }
  }

  function clearToken() {
    token.value = ''
    rdUser.value = null
    if (import.meta.client) {
      localStorage.removeItem('streamvault_rd_token')
    }
  }

  async function validateToken(t?: string) {
    const tokenToValidate = t || token.value
    if (!tokenToValidate) return false

    try {
      const result = await $fetch<{
        valid: boolean
        username?: string
        premium?: boolean
        expiration?: string
      }>('/api/debrid/token', {
        method: 'POST',
        body: { token: tokenToValidate },
      })

      if (result.valid) {
        rdUser.value = {
          username: result.username!,
          premium: result.premium!,
          expiration: result.expiration!,
        }
        if (t) setToken(t)
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async function resolveStream(hash: string, fileIndex?: number) {
    if (!token.value) throw new Error('No Real-Debrid token set')

    return $fetch<{
      url: string
      filename: string
      filesize: number
      mimeType: string
    }>('/api/debrid/resolve', {
      method: 'POST',
      body: { hash, token: token.value, fileIndex },
    })
  }

  const isConfigured = computed(() => !!token.value)
  const isPremium = computed(() => rdUser.value?.premium ?? false)

  return {
    token: readonly(token),
    rdUser: readonly(rdUser),
    isConfigured,
    isPremium,
    setToken,
    clearToken,
    validateToken,
    resolveStream,
  }
}
