/**
 * Crash & error reporting (Sentry). Env-guarded: if EXPO_PUBLIC_SENTRY_DSN is
 * empty the SDK is never loaded and every function here no-ops, so the app runs
 * identically with monitoring "off" until a DSN is supplied.
 *
 * IMPORTANT — Sentry is *lazy-required*, never imported at module load. Because
 * @sentry/react-native ships a native module, touching it on a binary built
 * BEFORE the package was added crashes the app on launch under the New
 * Architecture. Deferring the require until a DSN exists means: no DSN -> the
 * native module is never referenced -> the app still launches on the old binary.
 *
 * The DSN is a public, write-only key — safe to ship in the app binary.
 */
import type * as SentryType from '@sentry/react-native'

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

export const isMonitoringEnabled = (): boolean => !!dsn && dsn.length > 0

let sentry: typeof SentryType | null = null

function getSentry(): typeof SentryType | null {
  if (!isMonitoringEnabled()) return null
  if (!sentry) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require('@sentry/react-native')
  }
  return sentry
}

/** Initialise Sentry once, as early as possible (index.ts). No-ops with no DSN. */
export function initMonitoring(): void {
  const S = getSentry()
  if (!S) {
    if (__DEV__) {
      console.warn('[Sentry] No DSN found — crash reporting disabled until EXPO_PUBLIC_SENTRY_DSN is set.')
    }
    return
  }
  S.init({
    dsn,
    enabled: !__DEV__,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}

/** Wrap the root component so Sentry can capture render errors. No-op when off. */
export function wrapWithMonitoring<T>(App: T): T {
  const S = getSentry()
  if (!S) return App
  return S.wrap(App as never) as T
}

/** Report a caught error. Safe to call unconditionally — no-ops when disabled. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const S = getSentry()
  if (!S) return
  S.captureException(error, context ? { extra: context } : undefined)
}

/** Associate subsequent events with a signed-in user (Supabase id only). */
export function setMonitoringUser(id: string): void {
  const S = getSentry()
  if (!S) return
  S.setUser({ id })
}

/** Detach the user on sign-out so later events aren't misattributed. */
export function clearMonitoringUser(): void {
  const S = getSentry()
  if (!S) return
  S.setUser(null)
}
