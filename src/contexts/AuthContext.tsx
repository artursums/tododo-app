import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import { Platform } from 'react-native'
import { Session, User } from '@supabase/supabase-js'
import * as AppleAuthentication from 'expo-apple-authentication'
import * as Linking from 'expo-linking'
import { supabase, isSupabaseConfigured, getSupabase } from '../services/supabase'
import { setMonitoringUser, clearMonitoringUser } from '../services/monitoring'
import { identifyUser, resetUser } from '../services/analytics'

interface AuthResult {
  error: string | null
}

interface AuthContextType {
  session: Session | null
  user: User | null
  /** true until the persisted session has been read from storage */
  initializing: boolean
  /** false when no Supabase project is wired yet — the UI can show a "coming soon" state */
  configured: boolean
  passwordRecovery: boolean
  recoveryError: string | null
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>
  signInWithGoogle: () => Promise<AuthResult>
  signInWithApple: () => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  updatePassword: (password: string) => Promise<AuthResult>
  clearRecovery: () => void
  signOut: () => Promise<void>
  deleteAccount: () => Promise<AuthResult>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const NOT_CONFIGURED = 'Accounts are not set up yet — add your Supabase project to .env.'

/** Map raw Supabase/network errors to short user-facing messages. */
function friendlyError(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('invalid login credentials')) return 'Wrong email or password.'
  if (msg.includes('already registered')) return 'This email is already registered — try signing in.'
  if (msg.includes('password should be at least')) return 'Password must be at least 6 characters.'
  if (msg.includes('network') || msg.includes('fetch')) return 'No connection — try again.'
  if (msg.includes('invalid email')) return 'Please enter a valid email address.'
  return message
}

/** Collect query + fragment params of a deep link into one map. */
function parseAuthParams(url: string): Record<string, string> {
  const out: Record<string, string> = {}
  const collect = (raw: string) => {
    if (!raw) return
    new URLSearchParams(raw).forEach((v, k) => {
      out[k] = v
    })
  }
  const hashIndex = url.indexOf('#')
  const queryIndex = url.indexOf('?')
  if (queryIndex >= 0) collect(url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined))
  if (hashIndex >= 0) collect(url.slice(hashIndex + 1))
  return out
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // No backend yet — don't hang the splash gate; boot unauthenticated.
      setInitializing(false)
      return
    }
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
        setInitializing(false)
      })
      .catch(() => setInitializing(false))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true)
      setSession(newSession)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Handle the `tododo://auth-callback` link from the password-reset email.
  useEffect(() => {
    if (!isSupabaseConfigured) return
    const handleAuthUrl = async (url: string | null) => {
      if (!url || !url.includes('auth-callback')) return
      const params = parseAuthParams(url)
      if (params.error_description || params.error) {
        setRecoveryError('That reset link is invalid or has expired — request a new one.')
        return
      }
      if (params.access_token && params.refresh_token) {
        if (params.type === 'recovery') setPasswordRecovery(true)
        const { error } = await getSupabase().auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        })
        if (error) {
          setPasswordRecovery(false)
          setRecoveryError('That reset link is invalid or has expired — request a new one.')
        }
      }
    }
    Linking.getInitialURL().then(handleAuthUrl)
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleAuthUrl(url)
    })
    return () => sub.remove()
  }, [])

  // Attach the signed-in user's id to crash reporting + analytics (Supabase UUID
  // only). Both helpers no-op when their service is disabled.
  useEffect(() => {
    const userId = session?.user?.id
    if (userId) {
      setMonitoringUser(userId)
      identifyUser(userId)
    } else {
      clearMonitoringUser()
      resetUser()
    }
  }, [session?.user?.id])

  const clearRecovery = useCallback(() => {
    setPasswordRecovery(false)
    setRecoveryError(null)
  }, [])

  const value = useMemo<AuthContextType>(
    () => ({
      session,
      user: session?.user ?? null,
      initializing,
      configured: isSupabaseConfigured,
      passwordRecovery,
      recoveryError,
      clearRecovery,

      signUpWithEmail: async (email, password) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED, needsConfirmation: false }
        const { data, error } = await getSupabase().auth.signUp({ email: email.trim(), password })
        if (error) return { error: friendlyError(error.message), needsConfirmation: false }
        return { error: null, needsConfirmation: !data.session }
      },

      signInWithEmail: async (email, password) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED }
        const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password })
        return { error: error ? friendlyError(error.message) : null }
      },

      signInWithGoogle: async () => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED }
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { GoogleSignin } = require('@react-native-google-signin/google-signin')
          GoogleSignin.configure({
            webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
            iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
          })
          await GoogleSignin.hasPlayServices()
          const response = await GoogleSignin.signIn()
          const idToken = response?.data?.idToken
          if (!idToken) return { error: null }
          const { error } = await getSupabase().auth.signInWithIdToken({ provider: 'google', token: idToken })
          return { error: error ? friendlyError(error.message) : null }
        } catch (e: any) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { statusCodes } = require('@react-native-google-signin/google-signin')
            if (e?.code === statusCodes?.SIGN_IN_CANCELLED) return { error: null }
          } catch {
            // Module unavailable (e.g. not yet wired) — fall through to generic error.
          }
          return { error: friendlyError(e?.message ?? 'Google sign-in failed.') }
        }
      },

      signInWithApple: async () => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED }
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          })
          if (!credential.identityToken) return { error: 'Apple sign-in failed.' }
          const { data, error } = await getSupabase().auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          })
          if (error) return { error: friendlyError(error.message) }
          // Apple sends the full name ONLY on first authorization — persist it now.
          const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .filter(Boolean)
            .join(' ')
          if (fullName && data.user) {
            await getSupabase().auth.updateUser({ data: { full_name: fullName } })
            const { error: profileError } = await getSupabase()
              .from('profiles')
              .update({ display_name: fullName })
              .eq('id', data.user.id)
            if (profileError) console.warn('Failed to persist Apple display name:', profileError.message)
          }
          return { error: null }
        } catch (e: any) {
          if (e?.code === 'ERR_REQUEST_CANCELED') return { error: null }
          return { error: friendlyError(e?.message ?? 'Apple sign-in failed.') }
        }
      },

      resetPassword: async (email) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED }
        const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: 'tododo://auth-callback',
        })
        return { error: error ? friendlyError(error.message) : null }
      },

      updatePassword: async (password) => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED }
        const { error } = await getSupabase().auth.updateUser({ password })
        return { error: error ? friendlyError(error.message) : null }
      },

      signOut: async () => {
        if (!isSupabaseConfigured) return
        await getSupabase().auth.signOut()
      },

      deleteAccount: async () => {
        if (!isSupabaseConfigured) return { error: NOT_CONFIGURED }
        const { error } = await getSupabase().functions.invoke('delete-account', { method: 'POST' })
        if (error) return { error: friendlyError(error.message) }
        await getSupabase().auth.signOut()
        return { error: null }
      },
    }),
    [session, initializing, passwordRecovery, recoveryError, clearRecovery],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

/** Whether the native Apple sign-in button should be offered (iOS only). */
export const appleAuthAvailable = Platform.OS === 'ios'
