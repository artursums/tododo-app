import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'

/**
 * Supabase client — env-guarded so the app boots even before a project is wired.
 * When EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY are set, `supabase` is a real
 * client; otherwise it is null and callers (AuthContext, sync) treat accounts as
 * "not configured yet" instead of crashing. This mirrors the lazy/guarded pattern
 * used for Sentry, PostHog and RevenueCat.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseKey!, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // native app: no URL-based sessions
      },
    })
  : null

if (!isSupabaseConfigured && __DEV__) {
  console.warn(
    '[Supabase] No EXPO_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY — accounts & sync ' +
      'are disabled until you create a tododo Supabase project and fill .env.',
  )
}

// Refresh tokens only while the app is foregrounded (Supabase-recommended).
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh()
    else supabase.auth.stopAutoRefresh()
  })
}

/** Non-null accessor for code paths that have already checked isSupabaseConfigured. */
export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}
