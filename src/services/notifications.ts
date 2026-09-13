/**
 * Notification permission helpers. Kept minimal for now — the full notification
 * listener/routing layer arrives in M4; todoReminders.ts only needs the
 * permission gate below.
 *
 * Local scheduled notifications are supported in Expo Go. Remote push on
 * Android requires a development/production build (SDK 53+).
 */
import * as Notifications from 'expo-notifications'

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  if (current.canAskAgain === false) return false
  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}
