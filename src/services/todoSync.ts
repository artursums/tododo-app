/**
 * Supabase sync for the To-Do Calendar — the durable layer that makes entered
 * items survive an app delete + reinstall.
 *
 * Strategy: offline-first, last-write-wins by `updatedAt`. On each sync we pull
 * the user's rows, merge them with the local cache (newest wins, tombstones
 * respected), push locally-newer rows back up, and persist the merged set.
 *
 * Requires the user to be signed in (`userId`). When signed out — or when
 * Supabase isn't configured yet (env-guarded, see services/supabase.ts) — we
 * no-op: the local AsyncStorage cache still works, it just won't survive a
 * reinstall.
 *
 * `reminderNotificationId` is device-local and intentionally NOT synced.
 */
import { supabase } from './supabase'
import { TodoItem, TodoCategory, TodoCalendar } from '../types/todo'
import {
  loadItems,
  saveItems,
  loadCategories,
  saveCategories,
  loadCalendars,
  saveCalendars,
  setLastSync,
} from './todoStorage'
import { mergeById, rowsToPush, mergeCalendars } from './todoMerge'
import { ensureLocalDataOwner } from './todoOwnership'

export { mergeById, rowsToPush } from './todoMerge'

// ---------------------------------------------------------------------------
// Row <-> model mapping (snake_case DB columns)
// ---------------------------------------------------------------------------
type ItemRow = Record<string, unknown>

/** Composite PK — shared default category ids ('cat-personal') are unique per user. */
const ON_CONFLICT = 'user_id,id'

/**
 * Normalise a timestamp to canonical ISO ('…Z'). Local writes use
 * `toISOString()` while PostgREST returns '…+00:00'; without this the
 * last-write-wins string compare in mergeById would be comparing mixed formats.
 */
const toIso = (v: unknown): string => (v ? new Date(v as string).toISOString() : '')

export function itemToRow(item: TodoItem, userId: string): ItemRow {
  return {
    id: item.id,
    user_id: userId,
    title: item.title,
    notes: item.notes ?? null,
    end_date: item.endDate ?? item.date,
    is_memo: item.isMemo ?? false,
    location: item.location ?? null,
    url: item.url ?? null,
    checklist: item.checklist ?? [],
    category_id: item.categoryId,
    calendar_id: item.calendarId ?? null,
    date: item.date,
    all_day: item.allDay,
    start_time: item.startTime ?? null,
    end_time: item.endTime ?? null,
    completed: item.completed,
    completed_at: item.completedAt ?? null,
    reminder_at: item.reminderAt ?? null,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    deleted_at: item.deletedAt ?? null,
  }
}

export function rowToItem(row: any): TodoItem {
  return {
    id: row.id,
    title: row.title ?? '',
    notes: row.notes ?? undefined,
    endDate: row.end_date ?? row.date,
    isMemo: !!row.is_memo,
    location: row.location ?? undefined,
    url: row.url ?? undefined,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    categoryId: row.category_id ?? '',
    calendarId: row.calendar_id ?? undefined,
    date: row.date,
    allDay: !!row.all_day,
    startTime: row.start_time ?? undefined,
    endTime: row.end_time ?? undefined,
    completed: !!row.completed,
    completedAt: row.completed_at ?? undefined,
    reminderAt: row.reminder_at ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : undefined,
  }
}

function categoryToRow(cat: TodoCategory, userId: string): ItemRow {
  return {
    id: cat.id,
    user_id: userId,
    name: cat.name,
    color: cat.color,
    order: cat.order,
    updated_at: cat.updatedAt,
    deleted_at: cat.deletedAt ?? null,
  }
}

function rowToCategory(row: any): TodoCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    order: row.order ?? 0,
    updatedAt: toIso(row.updated_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : undefined,
  }
}

function calendarToRow(cal: TodoCalendar, userId: string): ItemRow {
  return {
    id: cal.id,
    user_id: userId,
    name: cal.name,
    color: cal.color,
    emoji: cal.emoji,
    order: cal.order,
    updated_at: cal.updatedAt,
    deleted_at: cal.deletedAt ?? null,
  }
}

function rowToCalendar(row: any): TodoCalendar {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    emoji: row.emoji ?? '🗓️',
    order: row.order ?? 0,
    updatedAt: toIso(row.updated_at),
    deletedAt: row.deleted_at ? toIso(row.deleted_at) : undefined,
  }
}

export interface SyncResult {
  ok: boolean
  items: TodoItem[]
  categories: TodoCategory[]
  calendars: TodoCalendar[]
  error?: string
}

// ---------------------------------------------------------------------------
// Serialized sync entry point
// ---------------------------------------------------------------------------
// Every mutation triggers a full sync; unserialized concurrent syncs race
// (sync A's stale snapshot overwrites a mid-sync edit B on save). All callers
// go through requestSync: a single in-flight promise plus a "dirty" flag that
// coalesces sync requests arriving mid-flight into exactly one follow-up sync.
// The dirty flag carries the LATEST requested user id so a follow-up runs for
// the right account even if the signed-in user changed mid-flight.
let inFlight: Promise<SyncResult> | null = null
let pendingUserId: string | null = null

/**
 * Request a sync for the given signed-in user. If a sync is already running,
 * marks it dirty and returns the in-flight promise; the running loop performs
 * one follow-up sync afterwards, picking up whatever changed in the meantime.
 * Also runs the cross-account ownership guard inside the mutex so the owner
 * check can never race a concurrent sync.
 */
export function requestSync(userId: string): Promise<SyncResult> {
  if (inFlight) {
    pendingUserId = userId
    return inFlight
  }
  inFlight = (async () => {
    let uid = userId
    try {
      await ensureLocalDataOwner(uid)
      let result = await syncTodos(uid)
      // Requests that arrived mid-sync collapse into one follow-up pass each.
      while (pendingUserId !== null) {
        uid = pendingUserId
        pendingUserId = null
        await ensureLocalDataOwner(uid)
        result = await syncTodos(uid)
      }
      return result
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

/**
 * Two-way sync the local cache with Supabase for the given signed-in user.
 * Returns the merged sets so the caller can update React state. Network/RLS
 * failures resolve to `{ ok: false }` with the local data untouched.
 */
export async function syncTodos(userId: string): Promise<SyncResult> {
  const [localItems, localCats, localCals] = await Promise.all([
    loadItems(),
    loadCategories(),
    loadCalendars(),
  ])

  // Supabase not wired yet (empty .env) — stay local-only, no error noise.
  if (!supabase) {
    return {
      ok: false,
      items: localItems,
      categories: localCats,
      calendars: localCals,
      error: 'supabase-not-configured',
    }
  }

  try {
    // Pull everything for this user (RLS scopes to auth.uid()). Volumes are small
    // for a personal to-do list, so a full pull keeps the merge dead simple.
    const [
      { data: remoteItemRows, error: itemErr },
      { data: remoteCatRows, error: catErr },
      { data: remoteCalRows, error: calErr },
    ] = await Promise.all([
      supabase.from('todo_items').select('*').eq('user_id', userId),
      supabase.from('todo_categories').select('*').eq('user_id', userId),
      supabase.from('todo_calendars').select('*').eq('user_id', userId),
    ])
    if (itemErr) throw itemErr
    if (catErr) throw catErr
    if (calErr) throw calErr

    const remoteItems = (remoteItemRows ?? []).map(rowToItem)
    const remoteCats = (remoteCatRows ?? []).map(rowToCategory)
    const remoteCals = (remoteCalRows ?? []).map(rowToCalendar)

    const mergedItems = mergeById(localItems, remoteItems)
    const mergedCats = mergeById(localCats, remoteCats)
    const mergedCals = mergeCalendars(localCals, remoteCals)

    const pushItems = rowsToPush(localItems, remoteItems)
    const pushCats = rowsToPush(localCats, remoteCats)
    const pushCals = rowsToPush(localCals, remoteCals)

    if (pushCals.length > 0) {
      const { error } = await supabase
        .from('todo_calendars')
        .upsert(pushCals.map(c => calendarToRow(c, userId)), { onConflict: ON_CONFLICT })
      if (error) throw error
    }
    if (pushCats.length > 0) {
      const { error } = await supabase
        .from('todo_categories')
        .upsert(pushCats.map(c => categoryToRow(c, userId)), { onConflict: ON_CONFLICT })
      if (error) throw error
    }
    if (pushItems.length > 0) {
      const { error } = await supabase
        .from('todo_items')
        .upsert(pushItems.map(i => itemToRow(i, userId)), { onConflict: ON_CONFLICT })
      if (error) throw error
    }

    // Re-read local state right before persisting: a user edit made while the
    // network round-trips above were in flight has a newer `updatedAt`, so the
    // last-write-wins merge keeps it instead of clobbering it with the stale
    // snapshot. (The edit itself gets pushed by the follow-up sync that
    // requestSync's dirty flag schedules.)
    const [freshItems, freshCats, freshCals] = await Promise.all([
      loadItems(),
      loadCategories(),
      loadCalendars(),
    ])
    const finalItems = mergeById(freshItems, mergedItems)
    const finalCats = mergeById(freshCats, mergedCats)
    const finalCals = mergeCalendars(freshCals, mergedCals)

    await Promise.all([
      saveItems(finalItems),
      saveCategories(finalCats),
      saveCalendars(finalCals),
      setLastSync(new Date().toISOString()),
    ])
    return { ok: true, items: finalItems, categories: finalCats, calendars: finalCals }
  } catch (e: any) {
    // Offline or RLS/permission error — keep working locally.
    console.warn('todo sync failed (working offline):', e?.message ?? e)
    return { ok: false, items: localItems, categories: localCats, calendars: localCals, error: e?.message }
  }
}
