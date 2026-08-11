import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './AppNavigator'

/**
 * Module-level navigation ref, kept in its own file so non-screen modules (e.g.
 * the notification service, realtime handlers) can navigate imperatively without
 * importing AppNavigator — which would create an import cycle. The type import is
 * erased at build time, so there is no runtime cycle.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>()
