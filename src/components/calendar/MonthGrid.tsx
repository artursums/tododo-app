import React, { useMemo, useState } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING } from '../../constants/theme'
import { TodoItem } from '../../types/todo'
import { buildMonthMatrix, WEEKDAY_LABELS } from '../../utils/calendarDates'

interface Props {
  year: number
  monthIndex: number
  /** Visible items keyed by 'YYYY-MM-DD'. */
  itemsByDate: Record<string, TodoItem[]>
  categoryColor: (id: string) => string
  selectedKey: string | null
  onSelectDay: (key: string) => void
  /** Theme accent, used for the "today" pill and selection ring. */
  accent: string
  /** Max event chips drawn per day before "+N". */
  maxChips?: number
  /** Short cells with no event chips — used by the editor's date picker. */
  compact?: boolean
  /** Fill the available screen height without a scrolling month. */
  fill?: boolean
}

/**
 * Month grid (Monday-first) matching the TimeTree widget's density:
 * day number + small category-colored event chips. Today is an accent pill,
 * the selected day a soft ring. Completed items render dimmed + struck through.
 */
export default function MonthGrid({
  year,
  monthIndex,
  itemsByDate,
  categoryColor,
  selectedKey,
  onSelectDay,
  accent,
  maxChips = 2,
  compact = false,
  fill = false,
}: Props) {
  const { colors } = useTheme()
  const [gridHeight, setGridHeight] = useState(0)
  const weeks = useMemo(() => buildMonthMatrix(year, monthIndex).filter(week => week.some(day => day.inMonth)), [year, monthIndex])

  const visibleChips = fill && gridHeight > 0
    ? Math.min(maxChips, Math.max(0, Math.floor((gridHeight / weeks.length - 54) / 16)))
    : maxChips

  return (
    <View style={[styles.wrap, fill && styles.fill]}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map(d => (
          <Text key={d} style={[styles.weekday, { color: colors.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      <View onLayout={event => setGridHeight(event.nativeEvent.layout.height)} style={[styles.grid, fill && styles.fill, { borderColor: colors.border }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={[styles.week, compact && styles.weekCompact, fill && styles.weekFill, { borderTopColor: colors.border }]}>
            {week.map(cell => {
              const dayItems = (itemsByDate[cell.key] ?? []).slice()
              const isSelected = cell.key === selectedKey
              const numberColor = !cell.inMonth
                ? colors.textMuted
                : cell.isWeekend
                  ? colors.textSecondary
                  : colors.text
              return (
                <Pressable
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.key}${cell.isToday ? ', today' : ''}, ${dayItems.length} plans`}
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.cell, isSelected && { backgroundColor: colors.accentLight }, !cell.inMonth && { opacity: 0.45 }]}
                  onPress={() => {
                    Haptics.selectionAsync()
                    onSelectDay(cell.key)
                  }}
                >
                  <View
                    style={[
                      styles.dayNumWrap,
                      cell.isToday && { backgroundColor: accent },
                      isSelected && !cell.isToday && { borderWidth: 1.5, borderColor: accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        { color: cell.isToday ? colors.onAccent : numberColor },
                        cell.isToday && { fontWeight: '700' },
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>

                  <View style={styles.chips}>
                    {dayItems.slice(0, visibleChips).map(it => (
                      <View
                        key={it.id}
                        style={[
                          styles.chip,
                          { backgroundColor: categoryColor(it.categoryId) + '20', borderLeftColor: categoryColor(it.categoryId), opacity: it.completed ? 0.55 : 1 },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.chipText,
                            { color: colors.text },
                            it.completed && styles.chipTextDone,
                          ]}
                        >
                          {it.title}
                        </Text>
                      </View>
                    ))}
                    {dayItems.length > visibleChips && (
                      <Text style={[styles.more, { color: colors.textMuted }]}>
                        +{dayItems.length - visibleChips}
                      </Text>
                    )}
                  </View>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACING.sm, paddingTop: SPACING.md },
  weekdayRow: { flexDirection: 'row', paddingBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  grid: { borderTopWidth: StyleSheet.hairlineWidth },
  fill: { flex: 1, minHeight: 0 },
  weekFill: { flex: 1, minHeight: 0 },
  week: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, minHeight: 72 },
  weekCompact: { minHeight: 44 },
  cell: { flex: 1, minWidth: 0, overflow: 'hidden', paddingTop: 5, paddingBottom: 5, paddingHorizontal: 2, alignItems: 'center', borderRadius: 10 },
  dayNumWrap: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dayNum: { fontSize: 13, fontWeight: '500' },
  chips: { width: '100%', gap: 2 },
  chip: {
    borderRadius: 4,
    borderCurve: 'continuous',
    borderLeftWidth: 2,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  chipText: { fontSize: 9.5, lineHeight: 12, includeFontPadding: false, fontWeight: '600', color: '#FFFFFF' },
  chipTextDone: { textDecorationLine: 'line-through' },
  more: { fontSize: 9.5, fontWeight: '600', paddingLeft: 4 },
})
