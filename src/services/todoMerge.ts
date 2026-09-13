import type { TodoCalendar } from '../types/todo'

/**
 * Pure last-write-wins merge helpers for To-Do sync (BA-015).
 *
 * Kept separate from `todoSync.ts` (which imports the Supabase client, and thus
 * env vars) so the merge logic can be unit-tested in isolation.
 */

export interface HasIdAndUpdatedAt {
  id: string
  updatedAt: string
}

/** Merge local + remote by id, keeping the row with the newer `updatedAt`. */
export function mergeById<T extends HasIdAndUpdatedAt>(local: T[], remote: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of local) map.set(row.id, row)
  for (const row of remote) {
    const existing = map.get(row.id)
    if (!existing || row.updatedAt > existing.updatedAt) map.set(row.id, row)
  }
  return Array.from(map.values())
}

/** Local rows newer than (or absent from) the remote set — these get pushed. */
export function rowsToPush<T extends HasIdAndUpdatedAt>(local: T[], remote: T[]): T[] {
  const remoteMap = new Map(remote.map(r => [r.id, r]))
  return local.filter(l => {
    const r = remoteMap.get(l.id)
    return !r || l.updatedAt > r.updatedAt
  })
}

/** Remote metadata must not overwrite a device-local cover or import another device's path. */
export function mergeCalendars(local: TodoCalendar[], remote: TodoCalendar[]): TodoCalendar[] {
  const covers = new Map(local.map(calendar => [calendar.id, calendar.coverImage]))
  return mergeById(local, remote).map(calendar => ({ ...calendar, coverImage: covers.get(calendar.id) }))
}
