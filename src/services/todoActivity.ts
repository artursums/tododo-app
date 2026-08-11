/**
 * Local activity log feeding the Activity tab (cf. TimeTree's Activity feed).
 *
 * Every mutation on a to-do (create / edit / complete / reopen / delete) appends
 * an entry. The feed groups entries per event, newest first. Entries snapshot
 * the item's title/date/color at the moment of the action so the feed stays
 * readable even after the item is edited or deleted.
 *
 * Device-local for now: once the shared-calendar backend is wired (M1/M2) the
 * feed becomes the household's merged activity, with one avatar per member.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import { TODO_ACTIVITY_KEY } from './todoStorage'

export type ActivityAction = 'created' | 'edited' | 'completed' | 'reopened' | 'deleted'

export interface ActivityEntry {
  id: string
  action: ActivityAction
  /** When the action happened (ISO). */
  at: string
  /** Snapshot of the acted-on item. */
  itemId: string
  itemTitle: string
  itemDate: string // 'YYYY-MM-DD'
  itemAllDay: boolean
  itemStartTime?: string
  itemEndTime?: string
  /** Category color at action time (drives the card's left bar). */
  itemColor: string
  calendarId: string
}

/** Cap the log so the AsyncStorage blob stays small; the feed shows recent history. */
const MAX_ENTRIES = 200

export async function loadActivity(): Promise<ActivityEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(TODO_ACTIVITY_KEY)
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : []
  } catch (e) {
    console.error('Failed to read activity log', e)
    return []
  }
}

/** Append an entry (fire-and-forget from the mutation handlers). */
export async function recordActivity(entry: Omit<ActivityEntry, 'id' | 'at'>): Promise<void> {
  try {
    const list = await loadActivity()
    const full: ActivityEntry = {
      ...entry,
      id: `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`,
      at: new Date().toISOString(),
    }
    // Newest first; trim the tail.
    const next = [full, ...list].slice(0, MAX_ENTRIES)
    await AsyncStorage.setItem(TODO_ACTIVITY_KEY, JSON.stringify(next))
  } catch (e) {
    console.error('Failed to record activity', e)
  }
}

/** One event's worth of feed: latest snapshot + its action rows (newest first). */
export interface ActivityGroup {
  itemId: string
  latest: ActivityEntry
  entries: ActivityEntry[]
}

/** Group a raw (newest-first) log per event, ordered by most recent action. */
export function groupActivity(entries: ActivityEntry[]): ActivityGroup[] {
  const byItem = new Map<string, ActivityEntry[]>()
  for (const e of entries) {
    const list = byItem.get(e.itemId)
    if (list) list.push(e)
    else byItem.set(e.itemId, [e])
  }
  // Map preserves first-seen order and the input is newest-first, so groups are
  // already ordered by their most recent entry.
  return Array.from(byItem.entries()).map(([itemId, list]) => ({
    itemId,
    latest: list[0],
    entries: list,
  }))
}
