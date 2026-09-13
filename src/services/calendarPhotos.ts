import { Directory, File, Paths } from 'expo-file-system'
import { makeId } from '../types/todo'

const FOLDER = 'calendar-covers'
const SAFE_NAME = /^[a-z0-9-]+\.(jpg|jpeg|png|webp|heic|heif|gif)$/i

export function calendarPhotoUri(filename?: string): string | undefined {
  if (!filename || !SAFE_NAME.test(filename)) return undefined
  return new File(Paths.document, FOLDER, filename).uri
}

/** Store a private copy outside the picker cache; persist only its relative name. */
export function saveCalendarPhoto(sourceUri: string): string {
  const directory = new Directory(Paths.document, FOLDER)
  directory.create({ intermediates: true, idempotent: true })
  const extension = sourceUri.split('?')[0].match(/\.(jpg|jpeg|png|webp|heic|heif|gif)$/i)?.[1]?.toLowerCase() ?? 'jpg'
  const filename = `${makeId()}.${extension}`
  new File(sourceUri).copy(new File(directory, filename))
  return filename
}

export function removeCalendarPhoto(filename?: string): void {
  const uri = calendarPhotoUri(filename)
  if (!uri) return
  try {
    const file = new File(uri)
    if (file.exists) file.delete()
  } catch (error) {
    console.warn('Could not remove unused calendar cover', error)
  }
}
