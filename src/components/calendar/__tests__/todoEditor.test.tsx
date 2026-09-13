import React from 'react'
import { Alert } from 'react-native'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import TodoEditor from '../TodoEditor'
import { TodoItem } from '../../../types/todo'

jest.mock('../../../contexts/ThemeContext', () => ({ useTheme: () => ({ colors: jest.requireActual('../../../constants/theme').LIGHT_COLORS }) }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }) }))
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }))
jest.mock('../CalendarArtwork', () => () => null)
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' }, selectionAsync: jest.fn() }))

const calendars = [{ id: 'cal-personal', name: 'Personal', color: '#6366F1', emoji: '🗓️', order: 0, updatedAt: '' }, { id: 'family', name: 'Family', color: '#10B981', emoji: '🏠', order: 1, updatedAt: '' }]
const categories = [{ id: 'work', name: 'Work', color: '#6366F1', order: 0, updatedAt: '' }]
const item: TodoItem = { id: 'plan', title: 'Weekend away', categoryId: 'work', date: '2026-09-12', endDate: '2026-09-14', allDay: true, completed: false, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' }
const props = { visible: true, editing: null, defaultDate: '2026-09-12', defaultCalendarId: 'cal-personal', calendars, categories, onClose: jest.fn(), onSave: jest.fn(), onDelete: jest.fn(), onCreateCategory: jest.fn() }
beforeEach(() => jest.clearAllMocks())

test('calendar, reminder, memo and optional details save through the real model', async () => {
  const onSave = jest.fn()
  const screen = render(<TodoEditor {...props} onSave={onSave} />)
  fireEvent.changeText(screen.getByLabelText('Plan title'), 'Weekend ideas')
  fireEvent.press(screen.getByLabelText('Choose plan calendar'))
  fireEvent.press(screen.getByRole('radio', { name: 'Family' }))
  fireEvent.press(screen.getByLabelText('Choose notification'))
  fireEvent.press(screen.getByRole('radio', { name: '30 min before' }))
  fireEvent(screen.getByLabelText('Save as memo'), 'valueChange', true)
  expect(screen.queryByLabelText('Start date')).toBeNull()
  expect(screen.queryByLabelText('Choose notification')).toBeNull()
  fireEvent.press(screen.getByLabelText('Add Location'))
  fireEvent.changeText(screen.getByLabelText('Location'), 'Tallinn')
  fireEvent.press(screen.getByLabelText('Add URL'))
  fireEvent.changeText(screen.getByLabelText('URL'), 'example.com')
  fireEvent.press(screen.getByLabelText('Add To-do list'))
  fireEvent.press(screen.getByText('+ Add to-do'))
  fireEvent.changeText(screen.getByLabelText('Checklist item 1'), 'Pack a bag')
  fireEvent.press(screen.getByLabelText('Complete checklist item 1'))
  fireEvent.press(screen.getByLabelText('Save plan'))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  expect(onSave.mock.calls[0][0]).toMatchObject({ title: 'Weekend ideas', calendarId: 'family', isMemo: true, location: 'Tallinn', url: 'https://example.com/', reminderAt: undefined, checklist: [{ title: 'Pack a bag', completed: true }] })
})

test('background updates retain drafts, and closing asks before discarding', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const onClose = jest.fn()
  const screen = render(<TodoEditor {...props} editing={item} onClose={onClose} />)
  fireEvent.changeText(screen.getByLabelText('Plan title'), 'Updated title')
  screen.rerender(<TodoEditor {...props} editing={{ ...item, title: 'Remote title' }} onClose={onClose} />)
  expect(screen.getByLabelText('Plan title').props.value).toBe('Updated title')
  fireEvent.press(screen.getByLabelText('Close plan editor'))
  expect(onClose).not.toHaveBeenCalled()
  expect(alert).toHaveBeenCalledWith('Discard changes?', expect.any(String), expect.any(Array))
  alert.mock.calls[0][2]?.find(button => button.text === 'Discard')?.onPress?.()
  expect(onClose).toHaveBeenCalledTimes(1)
  alert.mockRestore()
})

test('save failure keeps the draft and duplicate taps do not create duplicate events', async () => {
  let rejectSave!: (reason: Error) => void
  const onSave = jest.fn(() => new Promise<void>((_, reject) => { rejectSave = reject }))
  const screen = render(<TodoEditor {...props} editing={item} onSave={onSave} />)
  fireEvent.press(screen.getByLabelText('Save plan'))
  fireEvent.press(screen.getByLabelText('Save plan'))
  expect(onSave).toHaveBeenCalledTimes(1)
  rejectSave(new Error('disk full'))
  await waitFor(() => expect(screen.getByText('Could not save. Your changes are still here. Please try again.')).toBeTruthy())
  expect(screen.getByLabelText('Plan title').props.value).toBe(item.title)
})

test('editing retains the date range and checklist, deleting requires confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  const onSave = jest.fn()
  const onDelete = jest.fn()
  const screen = render(<TodoEditor {...props} editing={{ ...item, checklist: [{ id: 'pack', title: 'Pack', completed: true }] }} onSave={onSave} onDelete={onDelete} />)
  fireEvent.press(screen.getByLabelText('Save plan'))
  await waitFor(() => expect(onSave).toHaveBeenCalled())
  expect(onSave.mock.calls[0][0]).toMatchObject({ id: item.id, date: item.date, endDate: item.endDate, checklist: [{ id: 'pack', title: 'Pack', completed: true }] })
  await waitFor(() => expect(screen.getByLabelText('Save plan').props.accessibilityState.disabled).toBe(false))
  fireEvent.press(screen.getByLabelText('Delete plan'))
  expect(onDelete).not.toHaveBeenCalled()
  await act(async () => { await alert.mock.calls[0][2]?.find(button => button.text === 'Delete')?.onPress?.() })
  await waitFor(() => expect(onDelete).toHaveBeenCalledWith(item.id))
  alert.mockRestore()
})
