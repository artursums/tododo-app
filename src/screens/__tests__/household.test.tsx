import React from 'react'
import { Share } from 'react-native'
import { act, fireEvent, render } from '@testing-library/react-native'
import HouseholdScreen from '../HouseholdScreen'
const mockCreateInvite = jest.fn()
let mockRole = 'owner'
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }))
jest.mock('../../contexts/HouseholdContext', () => ({ useHousehold: () => ({
  households: [{ id: 'family', name: 'Family' }], activeHousehold: { id: 'family', name: 'Family' },
  members: [{ userId: 'me', displayName: 'Alex', color: '#6256C7', role: mockRole }], role: mockRole,
  calendars: [{ id: 'shared:cal', householdId: 'family' }], invites: [], createInvite: mockCreateInvite,
}) }))
jest.mock('../../contexts/CalendarsContext', () => ({ useCalendars: () => ({ setActiveCalendarId: jest.fn() }) }))
jest.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../constants/theme').LIGHT_COLORS }) }))
jest.mock('../../services/supabase', () => ({ isSupabaseConfigured: true }))
jest.mock('../../components/TododoIcon', () => ({ TododoIcon: () => null }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'View' }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }))
beforeEach(() => { jest.clearAllMocks(); mockRole = 'owner' })
test('an owner generates an invitation before explicitly opening the system share sheet', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction })
  mockCreateInvite.mockResolvedValue({ token: 'a'.repeat(48), expires_at: '2026-09-26' })
  const screen = render(<HouseholdScreen />)
  expect(screen.getByText('Alex (you)')).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByText('Invite someone')))
  expect(mockCreateInvite).toHaveBeenCalledWith('family')
  expect(share).not.toHaveBeenCalled()
  expect(screen.getByText('tododo://join?token=' + 'a'.repeat(48))).toBeTruthy()
  await act(async () => fireEvent.press(screen.getByText('Share invitation')))
  expect(share).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('tododo://join?token=') }), expect.any(Object))
  expect(screen.queryByText('Invitation sent')).toBeNull()
  share.mockRestore()
})
test('a regular member can open the calendar but cannot create invitations', () => {
  mockRole = 'member'
  const screen = render(<HouseholdScreen />)
  expect(screen.getByText('Open shared calendar')).toBeTruthy()
  expect(screen.queryByText('Invite someone')).toBeNull()
  expect(screen.getByText('The owner or an admin can invite more people.')).toBeTruthy()
})
