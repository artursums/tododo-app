import { calendarPhotoUri, saveCalendarPhoto } from '../calendarPhotos'

const mockCopy = jest.fn()

beforeEach(() => mockCopy.mockReset())

jest.mock('expo-file-system', () => {
  class File {
    uri: string
    constructor(...parts: any[]) { this.uri = parts.map(part => typeof part === 'string' ? part : part.uri).join('/') }
    copy = mockCopy
  }
  class Directory {
    uri: string
    constructor(...parts: string[]) { this.uri = parts.join('/') }
    create = jest.fn()
  }
  return { File, Directory, Paths: { document: 'file:///documents' } }
})

test('stores a gallery photo in documents and persists a relative filename', () => {
  const filename = saveCalendarPhoto('file:///cache/selected.PNG')
  expect(mockCopy).toHaveBeenCalledWith(expect.objectContaining({ uri: `file:///documents/calendar-covers/${filename}` }))
  expect(filename).toMatch(/^[a-z0-9-]+\.png$/)
  expect(calendarPhotoUri(filename)).toBe(`file:///documents/calendar-covers/${filename}`)
})

test('rejects external paths and traversal in persisted cover names', () => {
  expect(calendarPhotoUri('../other/photo.jpg')).toBeUndefined()
  expect(calendarPhotoUri('https://example.com/photo.jpg')).toBeUndefined()
  expect(calendarPhotoUri()).toBeUndefined()
})

test('propagates a failed file copy so the editor can keep the draft open', () => {
  mockCopy.mockImplementationOnce(() => { throw new Error('Disk full') })
  expect(() => saveCalendarPhoto('file:///cache/photo.jpg')).toThrow('Disk full')
})
