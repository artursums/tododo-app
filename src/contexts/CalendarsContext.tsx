import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import {
  TodoCalendar,
  makeCalendar,
  PERSONAL_CALENDAR_ID,
  ALL_CALENDARS_ID,
} from '../types/todo'
import {
  loadCalendars,
  saveCalendars,
  visibleCalendars,
  getActiveCalendarId,
  setActiveCalendarId as persistActiveCalendarId,
} from '../services/todoStorage'

/**
 * Single source of truth for the calendar list (TimeTree-style) and which
 * calendar the Calendar tab currently shows ('all' = merged view). Backed by
 * AsyncStorage; `replaceCalendars` lets the cloud sync feed merged results back.
 */
interface CalendarsContextType {
  /** Live (non-deleted) calendars, display order. Always contains Personal. */
  calendars: TodoCalendar[]
  /** 'all' or a calendar id. */
  activeCalendarId: string
  setActiveCalendarId: (id: string) => void
  createCalendar: (name: string, color: string, emoji: string) => TodoCalendar
  updateCalendar: (cal: TodoCalendar) => void
  /** Soft-delete (Personal refuses). Items keep their calendarId; the UI maps
   *  orphans back to Personal. */
  removeCalendar: (id: string) => void
  /** Replace state with a cloud-sync merge result. */
  replaceCalendars: (cals: TodoCalendar[]) => void
}

const CalendarsContext = createContext<CalendarsContextType | undefined>(undefined)

export function CalendarsProvider({ children }: { children: ReactNode }) {
  // Raw list including tombstones (persisted as-is so deletes sync); consumers
  // only ever see the visible projection below.
  const [raw, setRaw] = useState<TodoCalendar[]>([])
  const [activeCalendarId, setActive] = useState<string>(ALL_CALENDARS_ID)

  const rawRef = useRef<TodoCalendar[]>([])
  rawRef.current = raw

  useEffect(() => {
    let alive = true
    ;(async () => {
      const [cals, active] = await Promise.all([loadCalendars(), getActiveCalendarId()])
      if (!alive) return
      setRaw(cals)
      // A previously-active calendar may have been deleted meanwhile.
      const live = new Set(visibleCalendars(cals).map(c => c.id))
      setActive(active === ALL_CALENDARS_ID || live.has(active) ? active : ALL_CALENDARS_ID)
    })()
    return () => {
      alive = false
    }
  }, [])

  const persist = useCallback((next: TodoCalendar[]) => {
    setRaw(next)
    saveCalendars(next)
  }, [])

  const setActiveCalendarId = useCallback((id: string) => {
    setActive(id)
    persistActiveCalendarId(id)
  }, [])

  const createCalendar = useCallback(
    (name: string, color: string, emoji: string): TodoCalendar => {
      const cal = makeCalendar(name, color, emoji, rawRef.current)
      persist([...rawRef.current, cal])
      return cal
    },
    [persist],
  )

  const updateCalendar = useCallback(
    (cal: TodoCalendar) => {
      const stamped = { ...cal, updatedAt: new Date().toISOString() }
      persist(rawRef.current.map(c => (c.id === stamped.id ? stamped : c)))
    },
    [persist],
  )

  const removeCalendar = useCallback(
    (id: string) => {
      if (id === PERSONAL_CALENDAR_ID) return
      const ts = new Date().toISOString()
      persist(rawRef.current.map(c => (c.id === id ? { ...c, deletedAt: ts, updatedAt: ts } : c)))
      if (activeCalendarId === id) setActiveCalendarId(ALL_CALENDARS_ID)
    },
    [persist, activeCalendarId, setActiveCalendarId],
  )

  const replaceCalendars = useCallback(
    (cals: TodoCalendar[]) => {
      setRaw(cals)
      saveCalendars(cals)
      const live = new Set(visibleCalendars(cals).map(c => c.id))
      if (activeCalendarId !== ALL_CALENDARS_ID && !live.has(activeCalendarId)) {
        setActiveCalendarId(ALL_CALENDARS_ID)
      }
    },
    [activeCalendarId, setActiveCalendarId],
  )

  const calendars = useMemo(() => visibleCalendars(raw), [raw])

  const value = useMemo(
    () => ({
      calendars,
      activeCalendarId,
      setActiveCalendarId,
      createCalendar,
      updateCalendar,
      removeCalendar,
      replaceCalendars,
    }),
    [calendars, activeCalendarId, setActiveCalendarId, createCalendar, updateCalendar, removeCalendar, replaceCalendars],
  )

  return <CalendarsContext.Provider value={value}>{children}</CalendarsContext.Provider>
}

export function useCalendars() {
  const ctx = useContext(CalendarsContext)
  if (!ctx) throw new Error('useCalendars must be used within a CalendarsProvider')
  return ctx
}
