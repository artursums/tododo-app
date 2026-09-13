import React, { useState } from 'react'
import { StyleSheet } from 'react-native'
import CalendarIllustration from './CalendarIllustration'
import { Image } from 'expo-image'
import { calendarPhotoUri } from '../../services/calendarPhotos'

export const ARTWORK_NAMES: Record<string, string> = { '🗓️': 'calendar', '🏠': 'home', '👨‍👩‍👧': 'users', '❤️': 'heart', '💼': 'work', '🎉': 'party', '🕒': 'clock', '📚': 'book', '🎒': 'school', '🎨': 'palette', '✈️': 'plane', '🏃': 'activity', '✦': 'layers' }

export default function CalendarArtwork({ coverImage, emoji, size = 28, radius = 16 }: { coverImage?: string; emoji: string; size?: number; radius?: number }) {
  const uri = calendarPhotoUri(coverImage)
  const [failedUri, setFailedUri] = useState<string>()
  if (!uri || failedUri === uri) return <CalendarIllustration name={ARTWORK_NAMES[emoji] ?? 'calendar'} size={size} />
  return <Image source={{ uri }} contentFit="cover" style={[StyleSheet.absoluteFill, { borderRadius: radius }]} onError={() => setFailedUri(uri)} />
}
