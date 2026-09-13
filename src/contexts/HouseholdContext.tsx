import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import { AppState } from 'react-native'
import { useAuth } from './AuthContext'
import { getSupabase, supabase } from '../services/supabase'
import { sharedCalendarId, sharedEventFromRow, sharedEventToRow, sharedRpc, rpcRow, fetchSharedRows } from '../services/sharedCalendars'
import { TodoCalendar, TodoCategory, TodoItem } from '../types/todo'

export type MemberRole = 'owner' | 'admin' | 'member'
export interface HouseholdMember { householdId: string; userId: string; displayName: string | null; color: string; role: MemberRole }
export interface Household { id: string; name: string; createdBy: string }
export interface CalendarInvite { id: string; householdId: string; expiresAt: string; acceptedBy: string | null; revokedAt: string | null }
interface Snapshot { households: Household[]; allMembers: HouseholdMember[]; calendars: TodoCalendar[]; items: TodoItem[]; categories: TodoCategory[]; invites: CalendarInvite[] }
const EMPTY: Snapshot = { households: [], allMembers: [], calendars: [], items: [], categories: [], invites: [] }
interface HouseholdContextType extends Snapshot {
  activeHousehold: Household | null; members: HouseholdMember[]; role: MemberRole | null; isLoading: boolean; error: string | null
  switchHousehold: (id: string) => void
  createHousehold: (name: string) => Promise<string>
  acceptInvite: (token: string) => Promise<string>
  leaveHousehold: (id: string) => Promise<void>
  removeMember: (householdId: string, userId: string) => Promise<void>
  createInvite: (householdId: string) => Promise<{ token: string; expires_at: string }>
  revokeInvite: (id: string) => Promise<void>
  saveEvent: (item: TodoItem, category?: TodoCategory) => Promise<void>
  refresh: () => Promise<void>
}
const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [snapshotUser, setSnapshotUser] = useState<string>()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentUser = useRef(userId)
  currentUser.current = userId
  const generation = useRef(0)
  const refresh = useCallback(async () => {
    const request = ++generation.current
    if (!userId || !supabase) { setSnapshot(EMPTY); setLoading(false); return }
    setLoading(true)
    try {
      const [households, members, profiles, calendars, events, invites] = await Promise.all([
        fetchSharedRows('households'), fetchSharedRows('household_members'),
        fetchSharedRows('profiles', 'id,display_name,email'), fetchSharedRows('calendars'),
        fetchSharedRows('events'), fetchSharedRows('invites', 'id,household_id,expires_at,accepted_by,revoked_at'),
      ])
      if (request !== generation.current || currentUser.current !== userId) return
      const names = new Map(profiles.map(p => [p.id, p.display_name ?? p.email]))
      const categories = new Map<string, TodoCategory>()
      const items = events.map(row => {
        const item = sharedEventFromRow(row)
        categories.set(item.categoryId, { id: item.categoryId, name: row.topic_name ?? 'General', color: row.color ?? '#6256C7', order: categories.size, updatedAt: row.updated_at })
        return item
      })
      setSnapshotUser(userId)
      setSnapshot({
        households: households.map(h => ({ id: h.id, name: h.name, createdBy: h.created_by })),
        allMembers: members.map(m => ({ householdId: m.household_id, userId: m.user_id, displayName: names.get(m.user_id) ?? null, color: m.color, role: m.role })),
        calendars: calendars.map(c => ({ id: sharedCalendarId(c.id), householdId: c.household_id, name: c.name, color: c.color, emoji: c.emoji, order: c.sort, updatedAt: c.updated_at })),
        items, categories: [...categories.values()],
        invites: invites.map(i => ({ id: i.id, householdId: i.household_id, expiresAt: i.expires_at, acceptedBy: i.accepted_by, revokedAt: i.revoked_at })),
      })
      setActiveId(previous => households.some(h => h.id === previous) ? previous : households[0]?.id ?? null)
      setError(null)
    } catch {
      if (request === generation.current && currentUser.current === userId) {
        // Fail closed: revoked memberships must not leave an editable stale cache.
        setSnapshot(EMPTY)
        setError('Could not load shared calendars. Check your connection and try again.')
      }
    } finally { if (request === generation.current) setLoading(false) }
  }, [userId])
  useEffect(() => {
    setSnapshot(EMPTY); setActiveId(null); setError(null)
    refresh()
    if (!userId || !supabase) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const queue = () => { clearTimeout(timer); timer = setTimeout(() => { refresh() }, 250) }
    const channel = supabase.channel(`shared-${userId}`)
    for (const table of ['events', 'calendars', 'household_members']) channel.on('postgres_changes', { event: '*', schema: 'public', table }, queue)
    channel.subscribe()
    // Polling also reconciles removed memberships, whose DELETE notifications
    // are not a reliable authorization signal under Realtime RLS.
    const interval = setInterval(() => { if (AppState.currentState === 'active') refresh() }, 30000)
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh() })
    const invalidate = () => { ++generation.current }
    return () => { invalidate(); clearTimeout(timer); clearInterval(interval); sub.remove(); supabase?.removeChannel(channel) }
  }, [refresh, userId])
  const checked = useCallback(async <T,>(name: string, params: Record<string, unknown>) => {
    if (!userId) throw new Error('Sign in to plan together.')
    const result = await sharedRpc<T>(name, params)
    if (currentUser.current !== userId) throw new Error('Your account changed. Please reopen this calendar.')
    await refresh()
    return result
  }, [refresh, userId])
  const createHousehold = useCallback(async (name: string) => {
    const h = rpcRow(await checked<{ id: string } | { id: string }[]>('create_household', { p_name: name.trim() }))
    setActiveId(h.id); return h.id
  }, [checked])
  const acceptInvite = useCallback(async (token: string) => {
    const id = await checked<string>('accept_invite', { p_token: token })
    setActiveId(id); return id
  }, [checked])
  const removeMember = useCallback(async (householdId: string, memberId: string) => {
    await checked('remove_household_member', { p_household_id: householdId, p_user_id: memberId })
  }, [checked])
  const leaveHousehold = useCallback(async (id: string) => { if (userId) await removeMember(id, userId) }, [removeMember, userId])
  const createInvite = useCallback(async (householdId: string) => rpcRow(await checked<{ token: string; expires_at: string } | { token: string; expires_at: string }[]>('create_invite', { p_household_id: householdId })), [checked])
  const revokeInvite = useCallback(async (id: string) => { await checked('revoke_invite', { p_invite_id: id }) }, [checked])
  const saveEvent = useCallback(async (item: TodoItem, category?: TodoCategory) => {
    const calendar = snapshot.calendars.find(c => c.id === item.calendarId)
    if (!calendar || !userId) throw new Error('This shared calendar is no longer available. Reopen it and try again.')
    const row = sharedEventToRow(item, calendar, category ?? snapshot.categories.find(c => c.id === item.categoryId))
    const { error: saveError } = await getSupabase().from('events').upsert(row, { onConflict: 'household_id,id' })
    if (saveError) throw new Error(saveError.message)
    await refresh()
  }, [snapshot.calendars, snapshot.categories, userId, refresh])
  const visibleSnapshot = userId && snapshotUser === userId ? snapshot : EMPTY
  const activeHousehold = visibleSnapshot.households.find(h => h.id === activeId) ?? null
  const members = useMemo(() => visibleSnapshot.allMembers.filter(m => m.householdId === activeHousehold?.id), [visibleSnapshot.allMembers, activeHousehold])
  const role = members.find(m => m.userId === userId)?.role ?? null
  // Hide the previous account's snapshot immediately, before effects run.
  return <HouseholdContext.Provider value={{ ...visibleSnapshot, activeHousehold, members, role, isLoading, error, switchHousehold: setActiveId, createHousehold, acceptInvite, leaveHousehold, removeMember, createInvite, revokeInvite, saveEvent, refresh }}>{children}</HouseholdContext.Provider>
}
export function useHousehold() {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold must be used within a HouseholdProvider')
  return value
}
