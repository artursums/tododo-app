/**
 * Tiny, dependency-free calendar date helpers for the To-Do Calendar (BA-015).
 *
 * We intentionally do NOT pull in `date-fns` (the repo's npm install is currently
 * blocked by an unrelated override conflict, and the math we need is small). All
 * "day" values are local-calendar `YYYY-MM-DD` strings — never UTC instants — so
 * an item stays on the day the user picked regardless of timezone/DST.
 */

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/** Local-calendar day key, e.g. 2026-06-27. */
export const toDateKey = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** Parse a YYYY-MM-DD key into a Date at local midnight. */
export const fromDateKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export const todayKey = (): string => toDateKey(new Date())

export const addMonths = (year: number, monthIndex: number, delta: number) => {
  const d = new Date(year, monthIndex + delta, 1)
  return { year: d.getFullYear(), monthIndex: d.getMonth() }
}

/** Shift a date by N calendar days (local, DST-safe). */
export const addDays = (d: Date, n: number): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** The Monday on/just before the given date (Monday-first weeks). */
export const startOfWeek = (d: Date): Date => {
  const offset = (d.getDay() + 6) % 7 // 0=Mon..6=Sun
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset)
}

export interface MonthCell {
  key: string // YYYY-MM-DD
  day: number // 1..31
  inMonth: boolean // belongs to the displayed month (vs leading/trailing spill)
  isToday: boolean
  isWeekend: boolean // Sat/Sun
}

/**
 * A 6-row × 7-col (Monday-first) matrix covering the given month, including the
 * leading/trailing days that fill the first and last weeks.
 */
export const buildMonthMatrix = (year: number, monthIndex: number): MonthCell[][] => {
  const firstOfMonth = new Date(year, monthIndex, 1)
  // JS getDay: 0=Sun..6=Sat. Convert to Monday-first offset (0=Mon..6=Sun).
  const leading = (firstOfMonth.getDay() + 6) % 7
  const today = todayKey()

  const cells: MonthCell[] = []
  // Start from the Monday on/just before the 1st.
  const start = new Date(year, monthIndex, 1 - leading)
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const dow = d.getDay()
    cells.push({
      key: toDateKey(d),
      day: d.getDate(),
      inMonth: d.getMonth() === monthIndex,
      isToday: toDateKey(d) === today,
      isWeekend: dow === 0 || dow === 6,
    })
  }

  const weeks: MonthCell[][] = []
  for (let w = 0; w < 6; w++) weeks.push(cells.slice(w * 7, w * 7 + 7))
  return weeks
}

/** ISO-8601 week number (1..53), Monday-first — for the "Week 26" agenda label. */
export const getISOWeek = (d: Date): number => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000))
}

export interface WeekDayCell {
  key: string // YYYY-MM-DD
  day: number // 1..31
  monthIndex: number // 0..11 (for cross-month weeks)
  label: string // 'MON'..'SUN'
  isToday: boolean
  isWeekend: boolean
}

/** The 7 days (Monday-first) of the week containing `d`. */
export const buildWeekDays = (d: Date): WeekDayCell[] => {
  const start = startOfWeek(d)
  const today = todayKey()
  const cells: WeekDayCell[] = []
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i)
    const dow = day.getDay()
    cells.push({
      key: toDateKey(day),
      day: day.getDate(),
      monthIndex: day.getMonth(),
      label: WEEKDAY_LABELS[i],
      isToday: toDateKey(day) === today,
      isWeekend: dow === 0 || dow === 6,
    })
  }
  return cells
}

export const WEEKDAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const

/** Single-letter weekday initials (Monday-first) for the tiny year-view grids. */
export const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** "Jun 2026" */
export const formatMonthYear = (year: number, monthIndex: number): string =>
  `${MONTHS_SHORT[monthIndex]} ${year}`

/** "23–29 Jun" (same month) or "29 Jun – 5 Jul" (crossing a month boundary). */
export const formatWeekRange = (d: Date): string => {
  const start = startOfWeek(d)
  const end = addDays(start, 6)
  const sM = MONTHS_SHORT[start.getMonth()]
  const eM = MONTHS_SHORT[end.getMonth()]
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${sM}`
    : `${start.getDate()} ${sM} – ${end.getDate()} ${eM}`
}

/** "Saturday, 27 June" */
export const formatLongDate = (key: string): string => {
  const d = fromDateKey(key)
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`
}

/** Combine a YYYY-MM-DD day key and an HH:mm time into a local Date (for reminders). */
export const combineDateTime = (dateKey: string, time?: string): Date => {
  const d = fromDateKey(dateKey)
  if (time) {
    const [h, m] = time.split(':').map(Number)
    d.setHours(h ?? 0, m ?? 0, 0, 0)
  }
  return d
}

/** Compare two HH:mm strings; all-day / missing sort first. */
export const compareTimes = (a?: string, b?: string): number => {
  if (!a && !b) return 0
  if (!a) return -1
  if (!b) return 1
  return a.localeCompare(b)
}
