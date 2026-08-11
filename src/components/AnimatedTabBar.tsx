import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, LayoutRectangle, useWindowDimensions } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useTheme } from '../contexts/ThemeContext'
import { RADIUS, SPACING } from '../constants/theme'

const PILL_INSET_X = SPACING.sm
const PILL_INSET_Y = SPACING.xs - 2
const SPRING = { damping: 18, stiffness: 180, mass: 1 }
// Selector tint: ~25% of the accent color (8-digit hex alpha).
const PILL_ALPHA = '40'

/**
 * Faithful re-render of the default bottom tab bar with a soft selector pill that
 * springs from the old tab to the newly active one (ported from Purra BA-004).
 */
export default function AnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme()
  const { width } = useWindowDimensions()
  const [layouts, setLayouts] = useState<Record<number, LayoutRectangle>>({})

  const pillX = useSharedValue(0)
  const pillY = useSharedValue(0)
  const pillW = useSharedValue(0)
  const pillH = useSharedValue(0)
  const ready = useSharedValue(0)

  const active = state.index
  const activeLayout = layouts[active]

  useEffect(() => {
    if (!activeLayout) return
    const x = activeLayout.x + PILL_INSET_X
    const y = activeLayout.y + PILL_INSET_Y
    const w = activeLayout.width - PILL_INSET_X * 2
    const h = activeLayout.height - PILL_INSET_Y * 2

    if (ready.value === 0) {
      pillX.value = x
      pillY.value = y
      pillW.value = w
      pillH.value = h
      ready.value = 1
    } else {
      pillX.value = withSpring(x, SPRING)
      pillY.value = withSpring(y, SPRING)
      pillW.value = withSpring(w, SPRING)
      pillH.value = withSpring(h, SPRING)
    }
  }, [active, activeLayout, width])

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }, { translateY: pillY.value }],
    width: pillW.value,
    height: pillH.value,
    opacity: ready.value,
  }))

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, { backgroundColor: colors.accent + PILL_ALPHA }, pillStyle]}
      />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const focused = state.index === index
        const color = focused ? colors.text : colors.textMuted

        const rawLabel = options.tabBarLabel ?? options.title ?? route.name
        const label = typeof rawLabel === 'string' ? rawLabel : undefined

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            Haptics.selectionAsync()
            navigation.navigate(route.name)
          }
        }

        return (
          <Pressable
            key={route.key}
            style={styles.slot}
            onPress={onPress}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout
              setLayouts((prev) => ({ ...prev, [index]: layout }))
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
          >
            {options.tabBarIcon?.({ focused, color, size: 24 })}
            {label != null && (
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {label}
              </Text>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 88,
    paddingTop: 8,
    paddingBottom: SPACING.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  slot: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 },
  label: { fontSize: 11, fontWeight: '500' },
  pill: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
  },
})
