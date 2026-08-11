import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING, TYPOGRAPHY } from '../../constants/theme'
import { TodoItem } from '../../types/todo'

interface Props {
  item: TodoItem
  color: string
  onToggle: () => void
  onPress: () => void
}

/**
 * One agenda row (cf. the TimeTree day view): time column, category color bar,
 * title, an alarm glyph when a reminder is set, and a tap-to-complete checkbox.
 * The single-user model drops the screenshot's trailing avatar.
 */
export default function TodoItemRow({ item, color, onToggle, onPress }: Props) {
  const { colors } = useTheme()
  const done = item.completed

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : done ? 0.55 : 1 }]}
    >
      {/* Time column */}
      <View style={styles.timeCol}>
        {item.allDay ? (
          <Text style={[styles.timeMuted, { color: colors.textMuted }]}>all-day</Text>
        ) : (
          <>
            <Text style={[styles.timeStart, { color: colors.text }]}>{item.startTime ?? '--:--'}</Text>
            {!!item.endTime && (
              <Text style={[styles.timeEnd, { color: colors.textMuted }]}>{item.endTime}</Text>
            )}
          </>
        )}
      </View>

      {/* Category color bar */}
      <View style={[styles.bar, { backgroundColor: color }]} />

      {/* Title + reminder glyph */}
      <View style={styles.body}>
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            { color: colors.text },
            done && { textDecorationLine: 'line-through', color: colors.textMuted },
          ]}
        >
          {item.title}
        </Text>
        {!!item.reminderAt && (
          <Feather name="bell" size={13} color={colors.textMuted} style={{ marginTop: 3 }} />
        )}
      </View>

      {/* Completion checkbox */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onToggle()
        }}
        hitSlop={10}
        style={[
          styles.check,
          { borderColor: done ? color : colors.border, backgroundColor: done ? color : 'transparent' },
        ]}
      >
        {done && <Feather name="check" size={15} color={colors.white} />}
      </Pressable>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  timeCol: { width: 52 },
  timeStart: { fontSize: 14, fontWeight: '600' },
  timeEnd: { fontSize: 12, marginTop: 1 },
  timeMuted: { fontSize: 12, fontWeight: '500' },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginHorizontal: SPACING.md, minHeight: 34 },
  body: { flex: 1 },
  title: { fontSize: TYPOGRAPHY.body.size, fontWeight: '700', letterSpacing: -0.2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
  },
})
