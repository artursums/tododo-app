// jest-expo does not auto-mock AsyncStorage; todoStorage imports it at module
// load, so wire up the library's in-memory mock (mirrors storage.test.ts).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

import { TodoItem } from '../../types/todo'
import {
  visibleItems,
  upsertItem,
  softDeleteItem,
  setItemCompleted,
} from '../todoStorage'

function item(id: string, over: Partial<TodoItem> = {}): TodoItem {
  return {
    id,
    title: `Item ${id}`,
    categoryId: 'cat-personal',
    date: '2026-06-27',
    allDay: true,
    completed: false,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...over,
  }
}

describe('todoStorage pure helpers', () => {
  it('upsert inserts a new item and bumps updatedAt', () => {
    const before = [item('a')]
    const next = upsertItem(before, item('b'))
    expect(next).toHaveLength(2)
    expect(before).toHaveLength(1) // input not mutated
    expect(next[1].updatedAt).not.toBe('2026-06-01T00:00:00.000Z')
  })

  it('upsert replaces an existing item by id', () => {
    const before = [item('a', { title: 'Old' })]
    const next = upsertItem(before, item('a', { title: 'New' }))
    expect(next).toHaveLength(1)
    expect(next[0].title).toBe('New')
  })

  it('soft delete sets a tombstone and hides the item', () => {
    const before = [item('a'), item('b')]
    const next = softDeleteItem(before, 'a')
    expect(next.find(i => i.id === 'a')?.deletedAt).toBeTruthy()
    expect(visibleItems(next).map(i => i.id)).toEqual(['b'])
  })

  it('setItemCompleted stamps completedAt only when completing', () => {
    const done = setItemCompleted([item('a')], 'a', true)
    expect(done[0].completed).toBe(true)
    expect(done[0].completedAt).toBeTruthy()
    const undone = setItemCompleted(done, 'a', false)
    expect(undone[0].completed).toBe(false)
    expect(undone[0].completedAt).toBeUndefined()
  })
})
