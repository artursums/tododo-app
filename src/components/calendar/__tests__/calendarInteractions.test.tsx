import React from 'react'
import { View } from 'react-native'
import MonthGrid from '../MonthGrid'
import { fireEvent, render } from '@testing-library/react-native'
import CategoryFilterChips from '../CategoryFilterChips'
import TodoItemRow from '../TodoItemRow'
import DayAgenda from '../DayAgenda'
import { TodoItem } from '../../../types/todo'

jest.mock('../../../contexts/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('../../../constants/theme').LIGHT_COLORS, isDark: false }),
}))
jest.mock('@expo/vector-icons', () => ({ Feather: () => null }))
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }))

const categories = [{ id: 'work', name: 'Work', color: '#6256C7', order: 0, updatedAt: '2026-09-09' }]
const item: TodoItem = { id: 'plan', title: 'Plan the weekend', categoryId: 'work', date: '2026-09-09', allDay: true, completed: false, createdAt: '2026-09-09', updatedAt: '2026-09-09' }

test('compact filters reveal hidden topics without horizontal scrolling', () => {
  const onClear = jest.fn()
  const onToggle = jest.fn()
  const topics = ['Personal', 'Work', 'Health', 'Errands', 'Social'].map((name, order) => ({ id: name.toLowerCase(), name, order, color: '#6256C7', updatedAt: '2026-09-09' }))
  const screen = render(<CategoryFilterChips categories={topics} active={new Set(['social'])} onClear={onClear} onToggle={onToggle} />)
  expect(screen.queryByText('All topics')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Filter by Social' })).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Expand topic filters, 1 hidden selected' }))
  expect(screen.getByRole('button', { name: 'Filter by Social' }).props.accessibilityState.selected).toBe(true)
  fireEvent.press(screen.getByRole('button', { name: 'Filter by Social' }))
  expect(onToggle).toHaveBeenCalledWith('social')
  fireEvent.press(screen.getByRole('button', { name: 'Clear selection' }))
  expect(onClear).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByRole('button', { name: 'Collapse topic filters' }))
  expect(screen.queryByRole('button', { name: 'Filter by Social' })).toBeNull()
})

test('completing a plan does not open its editor', () => {
  const onToggle = jest.fn()
  const onPress = jest.fn()
  const screen = render(<TodoItemRow item={item} color="#6256C7" onToggle={onToggle} onPress={onPress} />)
  fireEvent.press(screen.getByRole('checkbox'))
  expect(onToggle).toHaveBeenCalledTimes(1)
  expect(onPress).not.toHaveBeenCalled()
  fireEvent.press(screen.getByRole('button', { name: 'Edit Plan the weekend' }))
  expect(onPress).toHaveBeenCalledTimes(1)
})

test('filtered empty days offer a reset instead of suggesting all plans are missing', () => {
  const onClearFilters = jest.fn()
  const onAdd = jest.fn()
  const screen = render(<DayAgenda embedded filtered dateKey="2026-09-09" items={[]} categories={categories} accent="#6256C7" onToggle={jest.fn()} onEdit={jest.fn()} onAdd={onAdd} onClearFilters={onClearFilters} />)
  expect(screen.getByText('No plans in these topics')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Show all topics' }))
  expect(onClearFilters).toHaveBeenCalledTimes(1)
  expect(onAdd).not.toHaveBeenCalled()
})


test('a short six-week month keeps every date reachable and reports dense-day overflow', () => {
  const onSelectDay = jest.fn()
  const plans = Array.from({ length: 5 }, (_, index) => ({ ...item, id: `dense-${index}`, date: '2026-11-30' }))
  const screen = render(<MonthGrid year={2026} monthIndex={10} fill itemsByDate={{ '2026-11-30': plans }} categoryColor={() => '#6256C7'} selectedKey={null} accent="#6256C7" onSelectDay={onSelectDay} />)
  const grid = screen.UNSAFE_getAllByType(View).find(view => typeof view.props.onLayout === 'function')!
  fireEvent(grid, 'layout', { nativeEvent: { layout: { height: 276, width: 350, x: 0, y: 0 } } })
  expect(screen.getAllByRole('button')).toHaveLength(42)
  expect(screen.getByText('+5')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: '2026-11-30, 5 plans' }))
  expect(onSelectDay).toHaveBeenCalledWith('2026-11-30')
})
