/**
 * Returns whether Supabase is configured and available.
 * Used to guard auth-dependent features so the app works without credentials.
 */
export function useSupabaseAvailable() {
  const config = useRuntimeConfig()
  return computed(() => {
    const url = config.public.supabaseUrl || ''
    const key = config.public.supabaseAnonKey || ''
    return url.includes('.supabase.co') && !url.includes('your-project') && key.length > 20
  })
}

/**
 * Safe wrapper for useSupabaseUser.
 * Returns null ref when Supabase module isn't loaded.
 */
export function useSafeSupabaseUser() {
  try {
    return useSupabaseUser()
  } catch {
    return ref(null)
  }
}

/**
 * Safe wrapper for useSupabaseClient.
 * Returns a stub client when Supabase module isn't loaded.
 */
export function useSafeSupabaseClient() {
  try {
    return useSupabaseClient()
  } catch {
    return createStubClient()
  }
}

function createStubClient(): any {
  const stubQuery: any = {
    select: () => stubQuery,
    eq: () => stubQuery,
    or: () => stubQuery,
    gt: () => stubQuery,
    order: () => stubQuery,
    limit: () => stubQuery,
    single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    then: (resolve: any) => resolve({ data: null, error: { message: 'Supabase not configured' } }),
  }

  return {
    auth: {
      signInWithPassword: async () => ({ error: { message: 'Supabase not configured' } }),
      signUp: async () => ({ error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    from: () => ({
      select: () => stubQuery,
      insert: () => stubQuery,
      upsert: () => stubQuery,
      update: () => stubQuery,
      delete: () => stubQuery,
    }),
  }
}
