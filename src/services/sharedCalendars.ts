import { getSupabase } from './supabase'
import { TodoCalendar, TodoCategory, TodoItem } from '../types/todo'

export const sharedCalendarId = (id: string) => `shared:${id}`
export const rawCalendarId = (id: string) => id.replace(/^shared:/, '')
export function inviteToken(input: string): string {
  const value = input.trim()
  if (/^(?:[a-f0-9]{24}|[a-f0-9]{48})$/i.test(value)) return value.toLowerCase()
  try {
    const url = new URL(value)
    if (url.protocol !== 'tododo:' || url.hostname !== 'join') throw new Error()
    const token = url.searchParams.get('token') ?? url.pathname.slice(1)
    if (/^(?:[a-f0-9]{24}|[a-f0-9]{48})$/i.test(token)) return token.toLowerCase()
  } catch { /* Reject unrelated URLs instead of forwarding them to a service. */ }
  throw new Error('Paste a complete tododo invitation link or invitation code.')
}
export const invitationUrl = (token: string) => `tododo://join?token=${encodeURIComponent(inviteToken(token))}`
export const sharedEventId = (householdId: string, id: string) => `shared:${householdId}:${id}`
export function sharedEventFromRow(row: any): TodoItem {
  return { id: sharedEventId(row.household_id, row.id), householdId: row.household_id, calendarId: sharedCalendarId(row.calendar_id), title: row.title, notes: row.notes ?? undefined, date: row.date, endDate: row.end_date ?? undefined, allDay: row.all_day, startTime: row.start_time ?? undefined, endTime: row.end_time ?? undefined, isMemo: row.is_memo, location: row.location ?? undefined, url: row.url ?? undefined, checklist: row.checklist ?? [], completed: row.completed, categoryId: `shared:${row.household_id}:${row.category_id ?? 'general'}`, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at ?? undefined }
}
export function sharedEventToRow(item: TodoItem, calendar: TodoCalendar, category?: TodoCategory) {
  if (!calendar.householdId) throw new Error('Choose a shared calendar.')
  if (item.householdId && item.householdId !== calendar.householdId) throw new Error('Plans cannot move between private and shared calendars. Create a new plan in the destination calendar.')
  const prefix = `shared:${calendar.householdId}:`
  return { household_id: calendar.householdId, id: item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.id, calendar_id: rawCalendarId(calendar.id), title: item.title, notes: item.notes ?? null, date: item.date, end_date: item.endDate ?? null, all_day: item.allDay, start_time: item.startTime ?? null, end_time: item.endTime ?? null, is_memo: item.isMemo ?? false, location: item.location ?? null, url: item.url ?? null, checklist: item.checklist ?? [], completed: item.completed, category_id: item.categoryId.replace(prefix, ''), topic_name: category?.name ?? 'General', color: category?.color ?? calendar.color, deleted_at: item.deletedAt ?? null, updated_at: new Date().toISOString() }
}
export async function sharedRpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, params)
  if (error) throw new Error(error.message)
  return data as T
}

/** Composite RPCs may be wrapped as a one-row collection by PostgREST. */
export function rpcRow<T>(data: T | T[]): T {
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('The server did not return a result. Refresh and try again.')
  return row
}

export async function fetchSharedRows(table: string, columns = '*'): Promise<any[]> {
  const rows: any[] = []
  const pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    let query = getSupabase().from(table).select(columns)
    if (table === 'events') query = query.is('deleted_at', null).order('household_id').order('id')
    else if (table === 'household_members') query = query.order('household_id').order('user_id')
    else query = query.order('id')
    const { data, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}
