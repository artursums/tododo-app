import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { TododoIcon } from '../../components/TododoIcon'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING, TYPOGRAPHY } from '../../constants/theme'
import { formatEventDate } from '../../utils/todoEvent'
import { TodoItem } from '../../types/todo'

interface Props {
  item: TodoItem
  color: string
  categoryName?: string
  onToggle: () => void
  onPress: () => void
}

/**
 * One agenda row (cf. the TimeTree day view): time column, category color bar,
 * title, an alarm glyph when a reminder is set, and a tap-to-complete checkbox.
 * The single-user model drops the screenshot's trailing avatar.
 */
export default function TodoItemRow({ item, color, categoryName, onToggle, onPress }: Props) {
  const { colors } = useTheme()
  const done = item.completed

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={onPress} style={({ pressed }) => [styles.eventBody, { opacity: pressed ? 0.65 : 1 }]}>

      {/* Time column */}
      <View style={styles.timeCol}>
        {item.isMemo ? <TododoIcon name="bookmark" size={20} color={colors.textSecondary} /> : item.allDay ? (
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
        {!!item.endDate && item.endDate !== item.date && !item.isMemo && <Text style={[styles.category, { color: colors.textSecondary, marginTop: 4 }]}>{formatEventDate(item.date)} – {formatEventDate(item.endDate)}</Text>}
        {!!item.location && <Text numberOfLines={1} style={[styles.category, { color: colors.textSecondary, marginTop: 4 }]}>{item.location}</Text>}
        <View style={styles.meta}>
          {!!categoryName && <Text style={[styles.category, { color: colors.textSecondary }]}>{categoryName}</Text>}
          {!!item.checklist?.length && <Text style={[styles.category, { color: colors.textSecondary }]}>{item.checklist.filter(task => task.completed).length}/{item.checklist.length} to-dos</Text>}
          {!!item.reminderAt && <TododoIcon name="bell" size={12} color={colors.textSecondary} />}
          {done && <Text style={[styles.category, { color: colors.textSecondary }]}>Done</Text>}
        </View>
      </View>

      </Pressable>
      {/* Completion checkbox */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={`Mark ${item.title} as ${done ? 'not done' : 'done'}`}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          onToggle()
        }}
        style={styles.checkTarget}
      >
      <View style={[
          styles.check,
          { borderColor: done ? color : colors.border, backgroundColor: done ? color : 'transparent' },
        ]}
      >
        {done && <TododoIcon name="check" size={15} color={colors.white} />}
      </View>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: 8,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  eventBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  category: { fontSize: 12 },
  checkTarget: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  timeCol: { width: 52 },
  timeStart: { fontSize: 14, fontWeight: '600' },
  timeEnd: { fontSize: 12, marginTop: 1 },
  timeMuted: { fontSize: 12, fontWeight: '500' },
  bar: { width: 3, alignSelf: 'stretch', borderRadius: 2, marginHorizontal: SPACING.sm, minHeight: 34 },
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
