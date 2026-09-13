import { mergeById, rowsToPush, mergeCalendars } from '../todoMerge'

const row = (id: string, updatedAt: string, extra = '') => ({ id, updatedAt, extra })

describe('todoMerge', () => {
  it('keeps the newer row per id (last-write-wins)', () => {
    const local = [row('a', '2026-06-01T00:00:00Z', 'local-a'), row('b', '2026-06-05T00:00:00Z', 'local-b')]
    const remote = [row('a', '2026-06-10T00:00:00Z', 'remote-a'), row('c', '2026-06-02T00:00:00Z', 'remote-c')]
    const merged = mergeById(local, remote).sort((x, y) => x.id.localeCompare(y.id))
    expect(merged.map(r => r.id)).toEqual(['a', 'b', 'c'])
    expect(merged.find(r => r.id === 'a')?.extra).toBe('remote-a') // remote newer
    expect(merged.find(r => r.id === 'b')?.extra).toBe('local-b') // only local
  })

  it('treats a newer tombstone as the winner', () => {
    const local = [row('a', '2026-06-01T00:00:00Z')]
    const remote = [{ id: 'a', updatedAt: '2026-06-09T00:00:00Z', deletedAt: '2026-06-09T00:00:00Z' }]
    const merged = mergeById(local as any, remote as any)
    expect((merged[0] as any).deletedAt).toBe('2026-06-09T00:00:00Z')
  })

  it('pushes only local rows newer than or missing from remote', () => {
    const local = [
      row('a', '2026-06-10T00:00:00Z'), // newer than remote → push
      row('b', '2026-06-01T00:00:00Z'), // older than remote → skip
      row('d', '2026-06-01T00:00:00Z'), // absent remote → push
    ]
    const remote = [row('a', '2026-06-05T00:00:00Z'), row('b', '2026-06-05T00:00:00Z')]
    const push = rowsToPush(local, remote).map(r => r.id).sort()
    expect(push).toEqual(['a', 'd'])
  })
})


describe('device-local calendar covers', () => {
  const calendar = { id: 'family', name: 'Family', color: '#6256C7', emoji: '🏠', order: 0, updatedAt: '2026-09-09T00:00:00Z' }

  it('keeps the local photo when newer cloud calendar metadata arrives', () => {
    const merged = mergeCalendars([{ ...calendar, coverImage: 'local-photo.jpg' }], [{ ...calendar, name: 'Our family', updatedAt: '2026-09-10T00:00:00Z' }])
    expect(merged[0].name).toBe('Our family')
    expect(merged[0].coverImage).toBe('local-photo.jpg')
  })

  it('does not restore a removed photo or import a remote device path', () => {
    const remote = { ...calendar, coverImage: 'foreign-photo.jpg', updatedAt: '2026-09-10T00:00:00Z' }
    expect(mergeCalendars([calendar], [remote])[0].coverImage).toBeUndefined()
    expect(mergeCalendars([], [remote])[0].coverImage).toBeUndefined()
  })
})
