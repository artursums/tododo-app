import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { TododoIcon } from '../../components/TododoIcon'
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
  embedded?: boolean
  filtered?: boolean
  onClearFilters?: () => void
}

/**
 * The selected-day list (cf. the TimeTree day view). All-day items sort first,
 * timed items by start time, completed items sink to the bottom dimmed.
 */
export default function DayAgenda({ dateKey, items, categories, accent, onToggle, onEdit, onAdd, embedded = false, filtered = false, onClearFilters }: Props) {
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
    <View style={embedded ? styles.embedded : styles.wrap}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.date, { color: colors.text }]}>{formatLongDate(dateKey)}</Text>
          <Text style={[styles.week, { color: colors.textMuted }]}>{items.length > 0 ? `${items.filter(item => !item.completed).length} to do · ${items.filter(item => item.completed).length} done` : `Week ${week}`}</Text>
        </View>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onAdd()
          }}
          accessibilityRole="button"
          hitSlop={8}
          style={[styles.addBtn, { backgroundColor: accent }]}
          accessibilityLabel="Add to this day"
        >
          <TododoIcon name="plus" size={20} color={colors.onAccent} />
        </Pressable>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accentLight }]}>
            <TododoIcon name={filtered ? 'filter' : 'sun'} size={24} color={accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{filtered ? 'No plans in these topics' : 'A little room to breathe'}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {filtered ? 'Try all topics to see the rest of your day.' : 'Add something to look forward to, or enjoy an open day.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={filtered ? onClearFilters : onAdd} style={styles.emptyAction}>
            <Text style={{ color: accent, fontWeight: '700', fontSize: 14 }}>{filtered ? 'Show all topics' : 'Add a plan'}</Text>
            <TododoIcon name="arrow-right" size={16} color={accent} />
          </Pressable>
        </View>
      ) : (
        embedded ? (
          <View>{sorted.map(item => (
            <TodoItemRow key={item.id} item={item} color={colorOf(item.categoryId)} categoryName={categories.find(cat => cat.id === item.categoryId)?.name} onToggle={() => onToggle(item.id)} onPress={() => onEdit(item)} />
          ))}</View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xl }}>
            {sorted.map(item => (
              <TodoItemRow key={item.id} item={item} color={colorOf(item.categoryId)} categoryName={categories.find(cat => cat.id === item.categoryId)?.name} onToggle={() => onToggle(item.id)} onPress={() => onEdit(item)} />
            ))}
          </ScrollView>
        )
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  embedded: { paddingTop: 8 },
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
    width: 44,
    height: 44,
    borderRadius: 16,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: SPACING.lg, paddingHorizontal: 32 },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  emptyText: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
})
