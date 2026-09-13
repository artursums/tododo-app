import { TodoItem } from '../types/todo'
import { addDays, combineDateTime, fromDateKey, MONTHS_SHORT, toDateKey } from './calendarDates'

export const REMINDER_OPTIONS = [
  { label: 'No notification', value: null },
  { label: 'At start time', value: 0 },
  { label: '5 min before', value: 5 },
  { label: '10 min before', value: 10 },
  { label: '30 min before', value: 30 },
  { label: '1 hour before', value: 60 },
  { label: '1 day before', value: 1440 },
] as const

export function reminderMinutes(item: TodoItem): number | null {
  if (!item.reminderAt) return null
  const start = combineDateTime(item.date, item.allDay ? '09:00' : item.startTime)
  return Math.round((start.getTime() - new Date(item.reminderAt).getTime()) / 60000)
}

export function reminderLabel(minutes: number | null): string {
  return REMINDER_OPTIONS.find(option => option.value === minutes)?.label ?? `${minutes} min before`
}

export function eventTimeError(date: string, endDate: string, allDay: boolean, start: string, end: string): string | null {
  if (endDate < date) return 'End date must be on or after the start date.'
  if (!allDay && combineDateTime(endDate, end) <= combineDateTime(date, start)) {
    return 'End time must be after the start time.'
  }
  return null
}

export function formatEventDate(key: string): string {
  const date = fromDateKey(key)
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`
}

/** Bound expansion to the visible period, even for years-long events. */
export function indexEventsByDate(items: TodoItem[], first: string, last: string): Record<string, TodoItem[]> {
  const result: Record<string, TodoItem[]> = {}
  for (const item of items) {
    if (item.isMemo || item.deletedAt) continue
    const start = item.date > first ? item.date : first
    const end = (item.endDate ?? item.date) < last ? (item.endDate ?? item.date) : last
    for (let day = start; day <= end; day = toDateKey(addDays(fromDateKey(day), 1))) {
      ;(result[day] ??= []).push(item)
    }
  }
  return result
}

export function normalizedEventUrl(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.')) {
    throw new Error('Enter a valid website address, such as https://example.com.')
  }
  return url.toString()
}
