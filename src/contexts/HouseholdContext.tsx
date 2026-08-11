import React, { createContext, useContext, useMemo, ReactNode } from 'react'

/**
 * Household (shared calendar group) context — SKELETON for M0.
 *
 * In M1 this becomes the heart of the app: it loads the signed-in user's
 * households + members from Supabase, tracks the active household (persisted),
 * exposes create/invite/join/leave, and scopes the calendar + realtime sync.
 * For now it returns an empty, loading-complete state so the UI shell renders.
 */

export type MemberRole = 'owner' | 'admin' | 'member'

export interface HouseholdMember {
  userId: string
  displayName: string | null
  color: string
  role: MemberRole
}

export interface Household {
  id: string
  name: string
  createdBy: string
}

interface HouseholdContextType {
  households: Household[]
  activeHousehold: Household | null
  members: HouseholdMember[]
  role: MemberRole | null
  isLoading: boolean
  // Implemented in M1:
  createHousehold: (name: string) => Promise<{ error: string | null }>
  switchHousehold: (id: string) => void
  acceptInvite: (token: string) => Promise<{ error: string | null }>
  leaveHousehold: (id: string) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

const NOT_IMPLEMENTED = 'Households arrive in milestone M1.'

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const value = useMemo<HouseholdContextType>(
    () => ({
      households: [],
      activeHousehold: null,
      members: [],
      role: null,
      isLoading: false,
      createHousehold: async () => ({ error: NOT_IMPLEMENTED }),
      switchHousehold: () => {},
      acceptInvite: async () => ({ error: NOT_IMPLEMENTED }),
      leaveHousehold: async () => ({ error: NOT_IMPLEMENTED }),
      refresh: async () => {},
    }),
    [],
  )
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) throw new Error('useHousehold must be used within a HouseholdProvider')
  return ctx
}
