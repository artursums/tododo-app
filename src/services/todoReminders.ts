/**
 * Per-item local reminders for the To-Do Calendar.
 *
 * Uses the shared permission flow (`ensureNotificationPermission`) but schedules
 * one-shot date notifications on its own gentle Android channel. The returned id
 * is stored on the item (`reminderNotificationId`) so it can be cancelled/rescheduled.
 *
 * Note: scheduled notifications require a dev-client / production build with
 * expo-notifications — they do not fire in Expo Go.
 */
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { ensureNotificationPermission } from './notifications'

const TODO_CHANNEL_ID = 'todo-reminders'

async function ensureTodoChannel(): Promise<void> {
  if (Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(TODO_CHANNEL_ID, {
    name: 'To-do reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  })
}

/** Schedule a one-shot reminder. Returns the notification id, or null if it
 *  couldn't be scheduled (past time, permission denied). */
export async function scheduleTodoReminder(opts: {
  title: string
  body?: string
  fireAt: Date
}): Promise<string | null> {
  if (opts.fireAt.getTime() <= Date.now()) return null
  const granted = await ensureNotificationPermission()
  if (!granted) return null
  await ensureTodoChannel()
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body ?? '',
        sound: false,
        data: { kind: 'todo-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: opts.fireAt,
        channelId: TODO_CHANNEL_ID,
      },
    })
  } catch (e) {
    console.warn('Failed to schedule todo reminder', e)
    return null
  }
}

export async function cancelTodoReminder(id?: string): Promise<void> {
  if (!id) return
  try {
    await Notifications.cancelScheduledNotificationAsync(id)
  } catch {
    // already fired / unknown id — nothing to do
  }
}

/**
 * Cancel every scheduled todo reminder on this device. Used when the local todo
 * cache changes owner: pending reminders reference the previous user's items.
 * Filters by the `kind: 'todo-reminder'` tag stamped at schedule time so other
 * notifications are untouched.
 */
export async function cancelAllTodoReminders(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync()
    await Promise.all(
      all
        .filter(n => n.content.data?.kind === 'todo-reminder')
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    )
  } catch (e) {
    console.warn('Failed to cancel todo reminders', e)
  }
}
