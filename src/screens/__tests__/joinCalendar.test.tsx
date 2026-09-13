import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import JoinCalendarScreen from '../JoinCalendarScreen'
import { sharedRpc } from '../../services/sharedCalendars'
const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockAccept = jest.fn()
let mockUser: { id: string } | null = null
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }))
jest.mock('../../contexts/HouseholdContext', () => ({ useHousehold: () => ({ acceptInvite: mockAccept }) }))
jest.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../constants/theme').LIGHT_COLORS }) }))
jest.mock('../../services/supabase', () => ({ isSupabaseConfigured: true }))
jest.mock('../../services/sharedCalendars', () => ({ ...jest.requireActual('../../services/sharedCalendars'), sharedRpc: jest.fn() }))
jest.mock('../HouseholdScreen', () => ({ styles: {} }))
jest.mock('../../components/TododoIcon', () => ({ TododoIcon: () => null }))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'View' }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace, canGoBack: () => true }), useRoute: () => ({ params: { token: 'a'.repeat(48) } }) }))
beforeEach(() => { jest.clearAllMocks(); mockUser = null })
test('retains an invitation through sign-in and requires a separate explicit join', async () => {
  const screen = render(<JoinCalendarScreen />)
  fireEvent.press(screen.getByText('Sign in to continue'))
  expect(mockNavigate).toHaveBeenCalledWith('Auth')
  mockUser = { id: 'recipient' }
  screen.rerender(<JoinCalendarScreen />)
  expect(screen.getByLabelText('Invitation link or code').props.value).toBe('a'.repeat(48))
  jest.mocked(sharedRpc).mockResolvedValue([{ household_name: 'Family', expires_at: '2026-09-25', already_member: false }])
  await act(async () => fireEvent.press(screen.getByText('View invitation')))
  expect(screen.getByText('Family')).toBeTruthy()
  expect(mockAccept).not.toHaveBeenCalled()
  await act(async () => fireEvent.press(screen.getByText('Join this calendar')))
  expect(mockAccept).toHaveBeenCalledWith('a'.repeat(48))
  expect(mockReplace).toHaveBeenCalledWith('Household')
})
test('an expired invite reports the error without granting access', async () => {
  mockUser = { id: 'recipient' }
  jest.mocked(sharedRpc).mockRejectedValue(new Error('This invitation has expired'))
  const screen = render(<JoinCalendarScreen />)
  fireEvent.press(screen.getByText('View invitation'))
  await waitFor(() => expect(screen.getByText('This invitation has expired')).toBeTruthy())
  expect(mockAccept).not.toHaveBeenCalled()
  expect(screen.queryByText('Join this calendar')).toBeNull()
})
