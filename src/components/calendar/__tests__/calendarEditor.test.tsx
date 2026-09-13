import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { CalendarEditorModal } from '../../../screens/CalendarListScreen'
import * as ImagePicker from 'expo-image-picker'
import { saveCalendarPhoto, removeCalendarPhoto } from '../../../services/calendarPhotos'

jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../constants/theme').LIGHT_COLORS }) }))
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('../../../contexts/CalendarsContext', () => ({ useCalendars: jest.fn() }))
jest.mock('../../../services/supabase', () => ({ isSupabaseConfigured: false }))
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 20 }), SafeAreaView: 'View' }))
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }))
jest.mock('expo-image', () => ({ Image: 'Image' }))
jest.mock('../CalendarArtwork', () => ({ __esModule: true, ...jest.requireActual('../CalendarArtwork'), default: () => null }))
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }))
jest.mock('../../../services/calendarPhotos', () => ({ calendarPhotoUri: (file?: string) => file ? `file:///${file}` : undefined, saveCalendarPhoto: jest.fn(() => 'new-cover.jpg'), removeCalendarPhoto: jest.fn() }))
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }))
const props = { visible: true, editing: null, onClose: jest.fn(), onCreate: jest.fn(), onUpdate: jest.fn(), onDelete: jest.fn() }
beforeEach(() => jest.clearAllMocks())

test('choosing a template prefills editable calendar details and creates the chosen calendar', async () => {
  const onCreate = jest.fn()
  const screen = render(<CalendarEditorModal {...props} onCreate={onCreate} />)
  fireEvent.press(screen.getByLabelText('Create Family calendar'))
  expect(screen.getByLabelText('Calendar name').props.value).toBe('Family')
  fireEvent.changeText(screen.getByLabelText('Calendar name'), 'Our family')
  fireEvent.press(screen.getByLabelText('Save calendar'))
  await waitFor(() => expect(onCreate).toHaveBeenCalledWith('Our family', '#10B981', '🏠', undefined))
})

test('failed photo replacement retains the draft and the previous saved photo', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const onUpdate = jest.fn().mockRejectedValue(new Error('disk full'))
  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///picked.jpg', width: 100, height: 100 }] })
  const screen = render(<CalendarEditorModal {...props} editing={{ id: 'family', name: 'Family', color: '#10B981', emoji: '🏠', coverImage: 'old-cover.jpg', order: 1, updatedAt: '' }} onUpdate={onUpdate} />)
  await act(async () => { fireEvent.press(screen.getByLabelText('Change calendar photo')) })
  await act(async () => { fireEvent.press(screen.getByLabelText('Save calendar')) })
  expect(saveCalendarPhoto).toHaveBeenCalledWith('file:///picked.jpg')
  expect(removeCalendarPhoto).toHaveBeenCalledWith('new-cover.jpg')
  expect(removeCalendarPhoto).not.toHaveBeenCalledWith('old-cover.jpg')
  expect(props.onClose).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Calendar name').props.value).toBe('Family')
  expect(alert).toHaveBeenCalledWith('Could not save calendar', expect.any(String))
  alert.mockRestore()
})
