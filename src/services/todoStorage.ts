/**
 * Local-first persistence for the To-Do Calendar (BA-015).
 *
 * AsyncStorage is the instant, offline-safe working set. It is NOT durable across
 * an app reinstall — that guarantee comes from the Supabase sync layer
 * (`todoSync.ts`). Every write stamps `updatedAt`; deletes are soft (tombstones)
 * so they propagate on sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  TodoItem,
  TodoCategory,
  TodoCalendar,
  DEFAULT_TODO_CATEGORIES,
  DEFAULT_TODO_CALENDAR,
  ALL_CALENDARS_ID,
} from '../types/todo'

export const TODO_ITEMS_KEY = 'todo_items'
export const TODO_CATEGORIES_KEY = 'todo_categories'
export const TODO_CALENDARS_KEY = 'todo_calendars'
export const TODO_ACTIVE_CALENDAR_KEY = 'todo_active_calendar'
export const TODO_ACTIVITY_KEY = 'todo_activity'
export const TODO_LAST_SYNC_KEY = 'todo_last_sync'
// The user id that the local todo cache belongs to (BA-017 T4 / H2). Set on
// every signed-in sync; used to detect a different account signing in on the
// same device so the previous owner's data is never leaked into the new account.
export const TODO_LAST_OWNER_KEY = 'todo_last_owner_user_id'

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const data = await AsyncStorage.getItem(key)
    return data ? (JSON.parse(data) as T) : fallback
  } catch (e) {
    console.error(`Failed to read ${key}`, e)
    return fallback
  }
}

async function setJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Failed to write ${key}`, e)
  }
}

export const nowISO = (): string => new Date().toISOString()

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function loadCategories(): Promise<TodoCategory[]> {
  const stored = await getJSON<TodoCategory[]>(TODO_CATEGORIES_KEY, [])
  if (stored.length > 0) return stored
  // First run: seed the defaults so the calendar has color out of the box.
  const seeded: TodoCategory[] = DEFAULT_TODO_CATEGORIES.map(c => ({ ...c, updatedAt: nowISO() }))
  await setJSON(TODO_CATEGORIES_KEY, seeded)
  return seeded
}

export const saveCategories = (cats: TodoCategory[]): Promise<void> =>
  setJSON(TODO_CATEGORIES_KEY, cats)

// ---------------------------------------------------------------------------
// Calendars (TimeTree-style: every item belongs to one)
// ---------------------------------------------------------------------------
export async function loadCalendars(): Promise<TodoCalendar[]> {
  const stored = await getJSON<TodoCalendar[]>(TODO_CALENDARS_KEY, [])
  if (stored.length > 0) return stored
  // First run: seed the private Personal calendar.
  const seeded: TodoCalendar[] = [{ ...DEFAULT_TODO_CALENDAR, updatedAt: nowISO() }]
  await setJSON(TODO_CALENDARS_KEY, seeded)
  return seeded
}

export const saveCalendars = (cals: TodoCalendar[]): Promise<void> =>
  setJSON(TODO_CALENDARS_KEY, cals)

/** Live (non-tombstoned) calendars in display order. */
export const visibleCalendars = (cals: TodoCalendar[]): TodoCalendar[] =>
  cals.filter(c => !c.deletedAt).sort((a, b) => a.order - b.order)

/** The calendar the Calendar tab currently shows ('all' = merged view). */
export async function getActiveCalendarId(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(TODO_ACTIVE_CALENDAR_KEY)) ?? ALL_CALENDARS_ID
  } catch {
    return ALL_CALENDARS_ID
  }
}

export async function setActiveCalendarId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TODO_ACTIVE_CALENDAR_KEY, id)
  } catch (e) {
    console.error(`Failed to write ${TODO_ACTIVE_CALENDAR_KEY}`, e)
  }
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export const loadItems = (): Promise<TodoItem[]> => getJSON<TodoItem[]>(TODO_ITEMS_KEY, [])

export const saveItems = (items: TodoItem[]): Promise<void> => setJSON(TODO_ITEMS_KEY, items)

// ---------------------------------------------------------------------------
// Pure mutation helpers (unit-tested; the screen owns React state)
// ---------------------------------------------------------------------------

/** Live (non-tombstoned) items. */
export const visibleItems = (items: TodoItem[]): TodoItem[] => items.filter(i => !i.deletedAt)

/** Insert or replace an item by id, stamping updatedAt. */
export function upsertItem(items: TodoItem[], item: TodoItem): TodoItem[] {
  const stamped: TodoItem = { ...item, updatedAt: nowISO() }
  const idx = items.findIndex(i => i.id === stamped.id)
  if (idx === -1) return [...items, stamped]
  const next = items.slice()
  next[idx] = stamped
  return next
}

/** Soft-delete: set a tombstone + bump updatedAt so the delete syncs. */
export function softDeleteItem(items: TodoItem[], id: string): TodoItem[] {
  const ts = nowISO()
  return items.map(i => (i.id === id ? { ...i, deletedAt: ts, updatedAt: ts } : i))
}

/** Toggle completion, stamping completedAt + updatedAt. */
export function setItemCompleted(items: TodoItem[], id: string, completed: boolean): TodoItem[] {
  const ts = nowISO()
  return items.map(i =>
    i.id === id
      ? { ...i, completed, completedAt: completed ? ts : undefined, updatedAt: ts }
      : i,
  )
}

export async function getLastSync(): Promise<string | null> {
  return (await getJSON<string | null>(TODO_LAST_SYNC_KEY, null)) ?? null
}

export const setLastSync = (iso: string): Promise<void> => setJSON(TODO_LAST_SYNC_KEY, iso)

// ---------------------------------------------------------------------------
// Ownership (BA-017 T4 / H2 — cross-account data leak)
// ---------------------------------------------------------------------------

/** The user id the local todo cache last synced under, or null for guest data
 *  that has never been synced to any account. Stored as a raw string. */
export async function getLastOwnerUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TODO_LAST_OWNER_KEY)
  } catch (e) {
    console.error(`Failed to read ${TODO_LAST_OWNER_KEY}`, e)
    return null
  }
}

export async function setLastOwnerUserId(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(TODO_LAST_OWNER_KEY, userId)
  } catch (e) {
    console.error(`Failed to write ${TODO_LAST_OWNER_KEY}`, e)
  }
}

/**
 * Wipe the device's todo cache (items, categories, last-sync marker). Used when
 * a DIFFERENT user signs in: the previous owner's data already lives in their
 * own cloud account, so the local copy is safe to drop. Does NOT touch the
 * owner key (the caller updates it) and never touches Notes storage — notes are
 * device-local with no cloud copy.
 */
export async function clearLocalTodoData(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      TODO_ITEMS_KEY,
      TODO_CATEGORIES_KEY,
      TODO_CALENDARS_KEY,
      TODO_ACTIVE_CALENDAR_KEY,
      TODO_ACTIVITY_KEY,
      TODO_LAST_SYNC_KEY,
    ])
  } catch (e) {
    console.error('Failed to clear local todo data', e)
  }
}
