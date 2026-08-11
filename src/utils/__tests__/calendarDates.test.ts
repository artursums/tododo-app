import {
  toDateKey,
  fromDateKey,
  buildMonthMatrix,
  getISOWeek,
  formatMonthYear,
  formatLongDate,
  addMonths,
  addDays,
  startOfWeek,
  buildWeekDays,
  formatWeekRange,
  combineDateTime,
  compareTimes,
} from '../calendarDates'

describe('calendarDates', () => {
  it('round-trips a local date key', () => {
    const d = new Date(2026, 5, 27) // 27 Jun 2026 (month is 0-based)
    expect(toDateKey(d)).toBe('2026-06-27')
    const back = fromDateKey('2026-06-27')
    expect(back.getFullYear()).toBe(2026)
    expect(back.getMonth()).toBe(5)
    expect(back.getDate()).toBe(27)
  })

  it('builds a Monday-first 6x7 month matrix', () => {
    const weeks = buildMonthMatrix(2026, 5) // June 2026
    expect(weeks).toHaveLength(6)
    weeks.forEach(w => expect(w).toHaveLength(7))
    // 1 June 2026 is a Monday → first cell of the grid is the 1st, in-month.
    expect(weeks[0][0].day).toBe(1)
    expect(weeks[0][0].inMonth).toBe(true)
    // Sunday column is index 6.
    expect(weeks[0][6].isWeekend).toBe(true)
  })

  it('marks leading/trailing spill days as out-of-month', () => {
    const weeks = buildMonthMatrix(2026, 6) // July 2026 — 1 Jul is a Wednesday
    // Wednesday is index 2; cells 0,1 are leading June days.
    expect(weeks[0][0].inMonth).toBe(false)
    expect(weeks[0][2].inMonth).toBe(true)
    expect(weeks[0][2].day).toBe(1)
  })

  it('computes ISO week numbers', () => {
    // 27 Jun 2026 falls in ISO week 26 (matches the reference screenshot).
    expect(getISOWeek(new Date(2026, 5, 27))).toBe(26)
    // 1 Jan 2026 is a Thursday → ISO week 1.
    expect(getISOWeek(new Date(2026, 0, 1))).toBe(1)
  })

  it('formats month/year and long dates', () => {
    expect(formatMonthYear(2026, 5)).toBe('Jun 2026')
    expect(formatLongDate('2026-06-27')).toBe('Saturday, 27 June')
  })

  it('adds months across a year boundary', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, monthIndex: 0 })
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, monthIndex: 11 })
  })

  it('adds days across a month boundary (DST-safe)', () => {
    expect(toDateKey(addDays(new Date(2026, 5, 29), 3))).toBe('2026-07-02') // 29 Jun + 3 = 2 Jul
    expect(toDateKey(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31')
  })

  it('snaps to the Monday on/just before a date', () => {
    // 27 Jun 2026 is a Saturday → its week starts Monday 22 Jun.
    expect(toDateKey(startOfWeek(new Date(2026, 5, 27)))).toBe('2026-06-22')
    // A Monday returns itself.
    expect(toDateKey(startOfWeek(new Date(2026, 5, 22)))).toBe('2026-06-22')
  })

  it('builds a Monday-first 7-day week', () => {
    const days = buildWeekDays(new Date(2026, 5, 27)) // week of 22–28 Jun 2026
    expect(days).toHaveLength(7)
    expect(days[0].key).toBe('2026-06-22')
    expect(days[0].label).toBe('MON')
    expect(days[6].key).toBe('2026-06-28')
    expect(days[6].isWeekend).toBe(true) // Sunday
  })

  it('formats a week range, collapsing the month when shared', () => {
    expect(formatWeekRange(new Date(2026, 5, 24))).toBe('22–28 Jun')
    // Week of 29 Jun crosses into July.
    expect(formatWeekRange(new Date(2026, 5, 30))).toBe('29 Jun – 5 Jul')
  })

  it('combines a day key and HH:mm into a local Date', () => {
    const d = combineDateTime('2026-06-27', '16:30')
    expect(d.getHours()).toBe(16)
    expect(d.getMinutes()).toBe(30)
    expect(d.getDate()).toBe(27)
  })

  it('sorts all-day (missing time) before timed', () => {
    expect(compareTimes(undefined, '09:00')).toBeLessThan(0)
    expect(compareTimes('09:00', undefined)).toBeGreaterThan(0)
    expect(compareTimes('09:00', '10:00')).toBeLessThan(0)
    expect(compareTimes('10:00', '09:00')).toBeGreaterThan(0)
  })
})
