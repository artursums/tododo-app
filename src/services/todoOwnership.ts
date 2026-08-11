/**
 * Cross-account ownership guard for the To-Do Calendar (BA-017 T4 / H2).
 *
 * The local AsyncStorage todo cache is a single shared blob — without a guard,
 * user B signing in on user A's device would merge-push A's items into B's
 * cloud account and see them in the UI.
 *
 * Ownership model (user-approved):
 * - Guest data (owner key unset) belongs to whoever signs in FIRST — it merges
 *   up into that account (normal sync behavior).
 * - Sign-out clears nothing; data stays visible/editable and still belongs to
 *   the device's last owner.
 * - Same user signs back in → normal sync (offline edits merge up).
 * - A DIFFERENT user signs in → before their first sync we wipe the local todo
 *   cache, cancel the previous owner's scheduled reminders, and empty the
 *   home-screen widget blob. The previous owner loses nothing: their data was
 *   already synced to their own cloud account while they were signed in.
 * - Notes storage is device-local with no cloud copy — never touched here.
 *
 * Must run inside the serialized sync path (`requestSync` in todoSync.ts) so
 * the check can't race a concurrent sync.
 */
import {
  getLastOwnerUserId,
  setLastOwnerUserId,
  clearLocalTodoData,
} from './todoStorage'
import { cancelAllTodoReminders } from './todoReminders'
import { syncCalendarToWidget } from './calendarWidgetSync'

/**
 * Ensure the local todo cache belongs to `userId` before syncing under that id.
 * No-op for the same owner; adopts guest data on first-ever sign-in; wipes the
 * device copy when a different account takes over.
 */
export async function ensureLocalDataOwner(userId: string): Promise<void> {
  const owner = await getLastOwnerUserId()
  if (owner === userId) return

  if (owner === null) {
    // Guest → first ever sign-in: keep the local data so the upcoming sync
    // merges it into this account; just record the new owner.
    await setLastOwnerUserId(userId)
    return
  }

  // Different user: drop the previous owner's device copy so it is never
  // pushed to (or shown under) the new account.
  await cancelAllTodoReminders()
  await clearLocalTodoData()
  // Push the emptied state so the iOS home-screen widget stops showing the
  // previous user's items (no-op on Android).
  syncCalendarToWidget([], [])
  await setLastOwnerUserId(userId)
}
