/**
 * Product analytics (PostHog). Env-guarded: with no EXPO_PUBLIC_POSTHOG_KEY the
 * client is never created and every function here no-ops, so the app runs
 * identically until a key is supplied.
 *
 * IMPORTANT — posthog-react-native is *lazy-required*, never imported at module
 * load (it pulls native code). Deferring the require until a key exists means the
 * app still launches on a binary built before the package was added.
 *
 * The project API key is a public, write-only key — safe to ship in the binary.
 */
import React from 'react'
import type PostHogType from 'posthog-react-native'

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

export const isAnalyticsEnabled = (): boolean => !!apiKey && apiKey.length > 0

let client: PostHogType | null = null

export function initAnalytics(): void {
  if (!isAnalyticsEnabled()) {
    if (__DEV__) {
      console.warn('[PostHog] No API key found — analytics disabled until EXPO_PUBLIC_POSTHOG_KEY is set.')
    }
    return
  }
  if (client) return
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PostHog = require('posthog-react-native').default as typeof PostHogType
  client = new PostHog(apiKey!, {
    host,
    captureAppLifecycleEvents: true,
    disabled: __DEV__,
  })
}

/** Provider feeding the client to <PostHogProvider>. Renders children unwrapped
 *  (touching no PostHog code) when analytics is disabled. */
export function AnalyticsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  if (!client) return React.createElement(React.Fragment, null, children)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PostHogProvider } = require('posthog-react-native')
  return React.createElement(PostHogProvider, { client, autocapture: false }, children)
}

/** Record a product event. Safe to call unconditionally — no-ops when disabled. */
export function track(
  event: string,
  properties?: Record<string, string | number | boolean | null>,
): void {
  client?.capture(event, properties)
}

/** Tie subsequent events to the signed-in user (Supabase id as distinct id). */
export function identifyUser(id: string): void {
  client?.identify(id)
}

/** Clear the identity on sign-out so the next anonymous session isn't merged. */
export function resetUser(): void {
  client?.reset()
}
