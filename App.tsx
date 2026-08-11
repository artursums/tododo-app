import React from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

import { initAnalytics, AnalyticsProvider } from './src/services/analytics'
import AppNavigator from './src/navigation/AppNavigator'
import ErrorBoundary from './src/components/ErrorBoundary'
import { AuthProvider } from './src/contexts/AuthContext'
import { ThemeProvider } from './src/contexts/ThemeContext'
import { HouseholdProvider } from './src/contexts/HouseholdContext'
import { CalendarsProvider } from './src/contexts/CalendarsContext'
import ThemedStatusBar from './src/components/ThemedStatusBar'

// Create the analytics client once at startup. No-ops (and every analytics call
// stays inert) until EXPO_PUBLIC_POSTHOG_KEY is set, so this is safe to ship now.
initAnalytics()

/**
 * Provider tree (outer → inner). Mirrors Purra's ordering. EntitlementProvider
 * (RevenueCat) is added in milestone M5; the realtime + notification listeners
 * are added in M3/M4.
 */
export default function App() {
  const tree = (
    <AuthProvider>
      <ThemeProvider>
        <HouseholdProvider>
          <CalendarsProvider>
            <SafeAreaProvider>
              <ThemedStatusBar />
              <AppNavigator />
            </SafeAreaProvider>
          </CalendarsProvider>
        </HouseholdProvider>
      </ThemeProvider>
    </AuthProvider>
  )

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        {/* Feeds the PostHog client app-wide; renders unwrapped when disabled. */}
        <AnalyticsProvider>{tree}</AnalyticsProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
