import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING, TYPOGRAPHY } from '../../constants/theme'
import { TodoItem, TodoCategory, FALLBACK_CATEGORY_COLOR } from '../../types/todo'
import { buildWeekDays, compareTimes } from '../../utils/calendarDates'
import TodoItemRow from './TodoItemRow'

interface Props {
  /** Any date inside the week to display. */
  anchor: Date
  itemsByDate: Record<string, TodoItem[]>
  categories: TodoCategory[]
  accent: string
  onToggle: (id: string) => void
  onEdit: (item: TodoItem) => void
  /** Open the editor for a new item on the given day. */
  onAdd: (dayKey: string) => void
}

const sortDayItems = (items: TodoItem[]): TodoItem[] =>
  items.slice().sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1
    return compareTimes(a.startTime, b.startTime)
  })

/**
 * Weekly agenda: one section per weekday (Monday-first) with its task rows.
 * Today's date pill takes the theme accent. Renders inside the screen's
 * outer ScrollView, so it owns no scroll container of its own.
 */
export default function WeekView({ anchor, itemsByDate, categories, accent, onToggle, onEdit, onAdd }: Props) {
  const { colors } = useTheme()
  const days = useMemo(() => buildWeekDays(anchor), [anchor])
  const colorOf = (id: string) => categories.find(c => c.id === id)?.color ?? FALLBACK_CATEGORY_COLOR

  return (
    <View style={styles.wrap}>
      {days.map(d => {
        const items = sortDayItems(itemsByDate[d.key] ?? [])
        return (
          <View key={d.key} style={[styles.dayBlock, { borderTopColor: colors.border }]}>
            <Pressable
              style={styles.dayHeader}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onAdd(d.key)
              }}
              accessibilityLabel={`Add to ${d.label} ${d.day}`}
            >
              <View style={styles.dayLabel}>
                <Text style={[styles.weekday, { color: d.isWeekend ? colors.tint5 : colors.textMuted }]}>
                  {d.label}
                </Text>
                <View style={[styles.numWrap, d.isToday && { backgroundColor: accent }]}>
                  <Text
                    style={[
                      styles.dayNum,
                      { color: d.isToday ? colors.white : d.isWeekend ? colors.tint5 : colors.text },
                      d.isToday && { fontWeight: '700' },
                    ]}
                  >
                    {d.day}
                  </Text>
                </View>
                {items.length > 0 && (
                  <Text style={[styles.count, { color: colors.textMuted }]}>
                    {items.length} {items.length === 1 ? 'task' : 'tasks'}
                  </Text>
                )}
              </View>
              <Feather name="plus" size={18} color={accent} />
            </Pressable>

            {items.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>—</Text>
            ) : (
              items.map(item => (
                <TodoItemRow
                  key={item.id}
                  item={item}
                  color={colorOf(item.categoryId)}
                  onToggle={() => onToggle(item.id)}
                  onPress={() => onEdit(item)}
                />
              ))
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.xs },
  dayBlock: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: SPACING.xs },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  dayLabel: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  weekday: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, width: 30 },
  numWrap: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    borderCurve: 'continuous',
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 15, fontWeight: '600' },
  count: { fontSize: TYPOGRAPHY.caption.size, fontWeight: '500' },
  empty: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xs, fontSize: 14, fontWeight: '500' },
})
