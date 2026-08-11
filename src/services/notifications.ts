/**
 * Notification permission helpers. Kept minimal for now — the full notification
 * listener/routing layer arrives in M4; todoReminders.ts only needs the
 * permission gate below.
 *
 * Note: scheduled local notifications require a dev-client / production build —
 * they do not fire in Expo Go (SDK 53+). The calls are safe to make there; they
 * simply resolve without a visible notification.
 */
import * as Notifications from 'expo-notifications'

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (current.canAskAgain === false) return false
  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}
