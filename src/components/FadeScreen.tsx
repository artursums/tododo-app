import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { useIsFocused } from '@react-navigation/native'

interface FadeScreenProps {
  children: React.ReactNode
}

const FADE_DURATION = 60 // ms — instant, subconscious

const FadeScreen = ({ children }: FadeScreenProps) => {
  const isFocused = useIsFocused()
  const fadeAnim = useSharedValue(0)

  useEffect(() => {
    if (isFocused) {
      fadeAnim.value = withTiming(1, { duration: FADE_DURATION })
    } else {
      fadeAnim.value = 0
    }
  }, [isFocused])

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }))

  return <Animated.View style={[styles.container, fadeStyle]}>{children}</Animated.View>
}

export default FadeScreen

const styles = StyleSheet.create({
  container: { flex: 1 },
})
