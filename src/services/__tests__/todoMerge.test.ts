import { mergeById, rowsToPush } from '../todoMerge'

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
