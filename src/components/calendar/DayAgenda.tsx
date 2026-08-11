import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING, TYPOGRAPHY } from '../../constants/theme'
import { TodoItem, TodoCategory, FALLBACK_CATEGORY_COLOR } from '../../types/todo'
import { formatLongDate, getISOWeek, fromDateKey, compareTimes } from '../../utils/calendarDates'
import TodoItemRow from './TodoItemRow'

interface Props {
  dateKey: string
  items: TodoItem[]
  categories: TodoCategory[]
  /** Theme accent for the add button. */
  accent: string
  onToggle: (id: string) => void
  onEdit: (item: TodoItem) => void
  onAdd: () => void
}

/**
 * The selected-day list (cf. the TimeTree day view). All-day items sort first,
 * timed items by start time, completed items sink to the bottom dimmed.
 */
export default function DayAgenda({ dateKey, items, categories, accent, onToggle, onEdit, onAdd }: Props) {
  const { colors } = useTheme()
  const week = useMemo(() => getISOWeek(fromDateKey(dateKey)), [dateKey])
  const colorOf = (id: string) => categories.find(c => c.id === id)?.color ?? FALLBACK_CATEGORY_COLOR

  const sorted = useMemo(() => {
    return items.slice().sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
      return compareTimes(a.startTime, b.startTime)
    })
  }, [items])

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.date, { color: colors.text }]}>{formatLongDate(dateKey)}</Text>
          <Text style={[styles.week, { color: colors.textMuted }]}>Week {week}</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onAdd()
          }}
          hitSlop={8}
          style={[styles.addBtn, { backgroundColor: accent }]}
          accessibilityLabel="Add to this day"
        >
          <Feather name="plus" size={20} color={colors.white} />
        </Pressable>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Nothing planned — enjoy the space.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
          {sorted.map(item => (
            <TodoItemRow
              key={item.id}
              item={item}
              color={colorOf(item.categoryId)}
              onToggle={() => onToggle(item.id)}
              onPress={() => onEdit(item)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  date: { fontSize: TYPOGRAPHY.heading.size, fontWeight: '700', letterSpacing: -0.3 },
  week: { fontSize: TYPOGRAPHY.caption.size, marginTop: 2 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { fontSize: TYPOGRAPHY.body.size, fontWeight: '500' },
})
