import { registerRootComponent } from 'expo'

import App from './App'
import { initMonitoring, wrapWithMonitoring } from './src/services/monitoring'

// Initialise crash reporting before anything renders, so a failure during
// startup is still captured. No-ops until EXPO_PUBLIC_SENTRY_DSN is set.
initMonitoring()

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// wrapWithMonitoring lets Sentry capture render errors (no-op when disabled).
registerRootComponent(wrapWithMonitoring(App))
