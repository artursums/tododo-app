import React, { useMemo } from 'react'
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
}

/**
 * Month grid (Monday-first, 6 weeks) matching the TimeTree widget's density:
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
  maxChips = 5,
  compact = false,
}: Props) {
  const { colors } = useTheme()
  const weeks = useMemo(() => buildMonthMatrix(year, monthIndex), [year, monthIndex])

  return (
    <View style={styles.wrap}>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map(d => (
          <Text key={d} style={[styles.weekday, { color: colors.textMuted }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={[styles.grid, { borderColor: colors.border }]}>
        {weeks.map((week, wi) => (
          <View key={wi} style={[styles.week, compact && styles.weekCompact, { borderTopColor: colors.border }]}>
            {week.map(cell => {
              const dayItems = (itemsByDate[cell.key] ?? []).slice()
              const isSelected = cell.key === selectedKey
              const numberColor = !cell.inMonth
                ? colors.textMuted
                : cell.isWeekend
                  ? colors.tint5
                  : colors.text
              return (
                <Pressable
                  key={cell.key}
                  style={styles.cell}
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
                        { color: cell.isToday ? colors.white : numberColor },
                        cell.isToday && { fontWeight: '700' },
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </View>

                  <View style={styles.chips}>
                    {dayItems.slice(0, maxChips).map(it => (
                      <View
                        key={it.id}
                        style={[
                          styles.chip,
                          { backgroundColor: categoryColor(it.categoryId) + (it.completed ? '40' : 'E6') },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.chipText,
                            it.completed && styles.chipTextDone,
                          ]}
                        >
                          {it.title}
                        </Text>
                      </View>
                    ))}
                    {dayItems.length > maxChips && (
                      <Text style={[styles.more, { color: colors.textMuted }]}>
                        +{dayItems.length - maxChips}
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
  wrap: { paddingHorizontal: SPACING.md },
  weekdayRow: { flexDirection: 'row', paddingBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', letterSpacing: 0.4 },
  grid: { borderTopWidth: StyleSheet.hairlineWidth },
  // Tall enough for the day number + 5 stacked event bars, kept compact so the
  // whole month still fits comfortably with room to spare below the grid.
  week: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, minHeight: 114 },
  weekCompact: { minHeight: 44 },
  cell: { flex: 1, paddingTop: 4, paddingHorizontal: 2, alignItems: 'center' },
  dayNumWrap: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
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
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  chipText: { fontSize: 9.5, lineHeight: 12, includeFontPadding: false, fontWeight: '600', color: '#FFFFFF' },
  chipTextDone: { textDecorationLine: 'line-through', color: 'rgba(255,255,255,0.85)' },
  more: { fontSize: 9.5, fontWeight: '600', paddingLeft: 4 },
})
