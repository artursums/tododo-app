import { TodoItem } from '../../types/todo'
import { indexEventsByDate, eventTimeError, normalizedEventUrl, reminderMinutes } from '../todoEvent'
import { combineDateTime } from '../calendarDates'
const base: TodoItem = { id: 'trip', title: 'Trip', date: '2026-10-24', endDate: '2026-10-27', allDay: true, categoryId: 'family', completed: false, createdAt: '', updatedAt: '' }

test('multi-day events span every visible day, including a DST boundary, without changing their identity', () => {
  const days = indexEventsByDate([base, { ...base, id: 'memo', isMemo: true }, { ...base, id: 'deleted', deletedAt: 'today' }], '2026-10-25', '2026-10-26')
  expect(Object.keys(days)).toEqual(['2026-10-25', '2026-10-26'])
  expect(days['2026-10-26']).toEqual([base])
})
test('legacy one-day events still appear once and events outside the period are skipped', () => {
  const item = { ...base, endDate: undefined }
  expect(indexEventsByDate([item], '2026-10-01', '2026-10-31')).toEqual({ '2026-10-24': [item] })
  expect(indexEventsByDate([base], '2026-11-01', '2026-11-30')).toEqual({})
})
test('end validation allows overnight and same-day all-day events but rejects backwards times', () => {
  expect(eventTimeError('2026-09-12', '2026-09-12', false, '11:00', '10:00')).toBeTruthy()
  expect(eventTimeError('2026-09-12', '2026-09-12', false, '11:00', '11:00')).toBeTruthy()
  expect(eventTimeError('2026-09-12', '2026-09-13', false, '23:00', '01:00')).toBeNull()
  expect(eventTimeError('2026-09-12', '2026-09-12', true, '11:00', '10:00')).toBeNull()
})
test('existing reminders retain their offset instead of resetting on edit', () => {
  const reminderAt = new Date(combineDateTime(base.date, '09:00').getTime() - 30 * 60000).toISOString()
  expect(reminderMinutes({ ...base, reminderAt })).toBe(30)
  expect(reminderMinutes(base)).toBeNull()
})
test('website links allow only web protocols and normalize bare domains', () => {
  expect(normalizedEventUrl('example.com')).toBe('https://example.com/')
  expect(normalizedEventUrl(' ')).toBeUndefined()
  expect(() => normalizedEventUrl('file:///etc/passwd')).toThrow()
  expect(() => normalizedEventUrl('javascript:alert(1)')).toThrow()
})
