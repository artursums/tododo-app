import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING } from '../../constants/theme'
import { TodoItem } from '../../types/todo'
import { buildMonthMatrix, MONTHS_SHORT, WEEKDAY_INITIALS } from '../../utils/calendarDates'

interface Props {
  year: number
  itemsByDate: Record<string, TodoItem[]>
  accent: string
  /** Tap a month → jump to its Monthly view. */
  onSelectMonth: (monthIndex: number) => void
}

const MONTH_INDICES = Array.from({ length: 12 }, (_, i) => i)

/**
 * Year overview: 12 mini month grids (3 per row). Days carrying tasks get a
 * small accent dot; today's number is drawn in the theme accent. Tapping
 * a month opens it in the Monthly view. Renders inside the screen's ScrollView.
 */
export default function YearView({ year, itemsByDate, accent, onSelectMonth }: Props) {
  const { colors } = useTheme()
  // Precompute the 12 matrices once per year so re-renders (e.g. theme change) are cheap.
  const months = useMemo(() => MONTH_INDICES.map(mi => buildMonthMatrix(year, mi)), [year])

  return (
    <View style={styles.wrap}>
      {months.map((weeks, mi) => (
        <Pressable
          key={mi}
          style={styles.monthCell}
          onPress={() => {
            Haptics.selectionAsync()
            onSelectMonth(mi)
          }}
          accessibilityLabel={`Open ${MONTHS_SHORT[mi]} ${year}`}
        >
          <Text style={[styles.monthName, { color: colors.text }]}>{MONTHS_SHORT[mi]}</Text>

          <View style={styles.miniWeekdays}>
            {WEEKDAY_INITIALS.map((w, i) => (
              <Text key={i} style={[styles.miniWeekday, { color: colors.textMuted }]}>
                {w}
              </Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.miniWeek}>
              {week.map(cell => {
                const hasItems = cell.inMonth && (itemsByDate[cell.key]?.length ?? 0) > 0
                return (
                  <View key={cell.key} style={styles.miniCell}>
                    <Text
                      style={[
                        styles.miniDay,
                        {
                          color: !cell.inMonth
                            ? 'transparent'
                            : cell.isToday
                              ? accent
                              : cell.isWeekend
                                ? colors.textMuted
                                : colors.textSecondary,
                        },
                        cell.isToday && { fontWeight: '800' },
                      ]}
                    >
                      {cell.day}
                    </Text>
                    <View
                      style={[
                        styles.miniDot,
                        hasItems && { backgroundColor: accent },
                      ]}
                    />
                  </View>
                )
              })}
            </View>
          ))}
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACING.sm, paddingTop: SPACING.xs },
  monthCell: { width: '33.33%', paddingHorizontal: SPACING.xs, paddingVertical: SPACING.sm },
  monthName: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2, marginBottom: 4, paddingLeft: 2 },
  miniWeekdays: { flexDirection: 'row', marginBottom: 2 },
  miniWeekday: { flex: 1, textAlign: 'center', fontSize: 7.5, fontWeight: '600' },
  miniWeek: { flexDirection: 'row' },
  miniCell: { flex: 1, alignItems: 'center', paddingVertical: 0.5 },
  miniDay: { fontSize: 8.5, lineHeight: 11, fontWeight: '500' },
  miniDot: { width: 3, height: 3, borderRadius: 1.5, marginTop: 1, backgroundColor: 'transparent' },
})
