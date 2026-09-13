import { fetchSharedRows, invitationUrl, inviteToken, rpcRow, sharedEventFromRow, sharedEventToRow } from '../sharedCalendars'
import { getSupabase } from '../supabase'
import { TodoCalendar, TodoItem } from '../../types/todo'
jest.mock('../supabase', () => ({ getSupabase: jest.fn() }))
const token = 'a'.repeat(48)
const cal: TodoCalendar = { id: 'shared:calendar-id', householdId: 'group', name: 'Family', emoji: '🏠', color: '#6256C7', order: 0, updatedAt: '' }
const item: TodoItem = { id: 'plan', calendarId: cal.id, title: 'Trip', categoryId: 'cat-personal', date: '2026-09-12', endDate: '2026-09-14', allDay: true, completed: false, createdAt: '', updatedAt: '', reminderNotificationId: 'private-device-id', reminderAt: '2026-09-12T08:00:00Z', checklist: [{ id: 'pack', title: 'Pack', completed: true }] }

test('share URLs and pasted invitation codes resolve to the same token', () => {
  expect(inviteToken(invitationUrl(token))).toBe(token)
  expect(inviteToken(`  ${token.toUpperCase()} `)).toBe(token)
  expect(inviteToken(`tododo://join/${'b'.repeat(24)}`)).toBe('b'.repeat(24))
})
test.each(['https://unrelated.test/join?token=' + token, 'tododo://auth-callback?token=' + token, 'a'.repeat(25), 'x'.repeat(48), ''])('rejects malformed or unrelated invitations: %s', value => {
  expect(() => inviteToken(value)).toThrow('Paste a complete tododo invitation')
})
test('shared event roundtrip preserves details while keeping device reminders private', () => {
  const row = sharedEventToRow(item, cal, { id: item.categoryId, name: 'Travel', color: '#FB7185', order: 0, updatedAt: '' })
  expect(row).toMatchObject({ household_id: 'group', calendar_id: 'calendar-id', id: 'plan', topic_name: 'Travel', end_date: '2026-09-14', checklist: item.checklist })
  expect(row).not.toHaveProperty('reminder_at')
  expect(row).not.toHaveProperty('reminderNotificationId')
  const read = sharedEventFromRow(row)
  expect(read).toMatchObject({ id: 'shared:group:plan', householdId: 'group', categoryId: 'shared:group:cat-personal', calendarId: cal.id, endDate: item.endDate, checklist: item.checklist })
  expect(sharedEventToRow(read, cal).id).toBe('plan')
})
test('a shared edit cannot accidentally be redirected into another group or private calendar', () => {
  expect(() => sharedEventToRow({ ...item, householdId: 'another' }, cal)).toThrow('cannot move')
  expect(() => sharedEventToRow(item, { ...cal, householdId: undefined })).toThrow('Choose a shared calendar')
})
test('composite RPC responses support PostgREST one-row arrays', () => {
  expect(rpcRow([{ token }])).toEqual({ token })
  expect(rpcRow({ token })).toEqual({ token })
  expect(() => rpcRow([])).toThrow('server did not return')
})
test('loads past the first page without truncating large shared calendars', async () => {
  const range = jest.fn().mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }).mockResolvedValueOnce({ data: [{ id: 500 }], error: null })
  const query: any = { select: jest.fn(() => query), is: jest.fn(() => query), order: jest.fn(() => query), range }
  jest.mocked(getSupabase).mockReturnValue({ from: () => query } as any)
  expect(await fetchSharedRows('events')).toHaveLength(501)
  expect(range.mock.calls).toEqual([[0, 499], [500, 999]])
  expect(query.is).toHaveBeenCalledWith('deleted_at', null)
})
