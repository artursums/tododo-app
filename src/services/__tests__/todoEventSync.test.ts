import AsyncStorage from '@react-native-async-storage/async-storage'
import { itemToRow, rowToItem } from '../todoSync'
import { loadItems, saveItems } from '../todoStorage'
import { TodoItem } from '../../types/todo'
jest.mock('../supabase', () => ({ supabase: null }))
jest.mock('../todoOwnership', () => ({ ensureLocalDataOwner: jest.fn() }))
jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'))
const event: TodoItem = { id: 'test', title: 'Trip', categoryId: 'family', date: '2026-09-12', endDate: '2026-09-14', allDay: true, isMemo: false, location: 'Tallinn', url: 'https://example.com/', checklist: [{ id: 'pack', title: 'Pack', completed: true }], completed: false, createdAt: '2026-09-12T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z' }
test('new event fields survive local reload and cloud row mapping', async () => {
  await saveItems([event])
  expect(await loadItems()).toEqual([event])
  expect(rowToItem(itemToRow(event, 'user'))).toMatchObject(event)
})
test('legacy cloud rows retain their day and behave as events', () => {
  const legacy = rowToItem({ id: 'old', date: '2026-09-12', all_day: true })
  expect(legacy).toMatchObject({ date: '2026-09-12', endDate: '2026-09-12', isMemo: false, checklist: [] })
})
test('local write failures reach the editor instead of reporting a successful save', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'))
  await expect(saveItems([event])).rejects.toThrow('disk full')
})
