import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'

import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { SPACING, RADIUS, TYPOGRAPHY, MEMBER_COLORS } from '../constants/theme'
import { loadActivity, groupActivity, ActivityGroup, ActivityAction } from '../services/todoActivity'
import { fromDateKey, MONTHS_SHORT } from '../utils/calendarDates'

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const ACTION_LABEL: Record<ActivityAction, string> = {
  created: 'Event created',
  edited: 'Event edited',
  completed: 'Event completed',
  reopened: 'Event reopened',
  deleted: 'Event deleted',
}

/** "Wed, 26. Aug at 19:30 - 20:30" (times only for timed items). */
function formatCardDate(dateKey: string, allDay: boolean, start?: string, end?: string): string {
  const d = fromDateKey(dateKey)
  const base = `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTHS_SHORT[d.getMonth()]}`
  if (allDay || !start) return base
  return end ? `${base} at ${start} - ${end}` : `${base} at ${start}`
}

/** "Wed, 05.08, 19:05" from an ISO timestamp. */
function formatActionTime(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${p(d.getDate())}.${p(d.getMonth() + 1)}, ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Rows shown per event card before the feed truncates. */
const MAX_ROWS_PER_EVENT = 4

/**
 * Activity feed (cf. TimeTree): one card per event — colored bar, title, date,
 * actor avatar — followed by its action rows (created / edited / completed…),
 * newest event first. Fed by the local activity log; becomes the shared
 * calendar's member feed once the backend is wired.
 */
export default function ActivityScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const [groups, setGroups] = useState<ActivityGroup[]>([])

  const selfInitial = (user?.email?.[0] ?? 'M').toUpperCase()

  // Reload whenever the tab gains focus so fresh actions show up immediately.
  useFocusEffect(
    useCallback(() => {
      let alive = true
      loadActivity().then(entries => {
        if (alive) setGroups(groupActivity(entries))
      })
      return () => {
        alive = false
      }
    }, []),
  )

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Activity</Text>
      </View>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent + '14' }]}>
            <Feather name="bell" size={28} color={colors.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Create your first event and everything that happens to it shows up here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
          {groups.map(group => {
            const e = group.latest
            const done = e.action === 'deleted'
            return (
              <View
                key={group.itemId}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                {/* Event header */}
                <View style={styles.cardHeader}>
                  <View style={[styles.colorBar, { backgroundColor: e.itemColor }]} />
                  <View style={styles.cardHeaderBody}>
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.cardTitle,
                        { color: colors.text },
                        done && { textDecorationLine: 'line-through', color: colors.textMuted },
                      ]}
                    >
                      {e.itemTitle}
                    </Text>
                    <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                      {formatCardDate(e.itemDate, e.itemAllDay, e.itemStartTime, e.itemEndTime)}
                    </Text>
                  </View>
                  <View style={[styles.avatar, { backgroundColor: MEMBER_COLORS[0] }]}>
                    <Text style={styles.avatarText}>{selfInitial}</Text>
                  </View>
                </View>

                {/* Action rows */}
                {group.entries.slice(0, MAX_ROWS_PER_EVENT).map(entry => (
                  <View key={entry.id} style={[styles.actionRow, { borderTopColor: colors.border }]}>
                    <View style={[styles.avatarSm, { backgroundColor: MEMBER_COLORS[0] }]}>
                      <Text style={styles.avatarSmText}>{selfInitial}</Text>
                    </View>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>
                      {ACTION_LABEL[entry.action]}
                    </Text>
                    <Text style={[styles.actionTime, { color: colors.textMuted }]}>
                      {formatActionTime(entry.at)}
                    </Text>
                  </View>
                ))}
                {group.entries.length > MAX_ROWS_PER_EVENT && (
                  <Text style={[styles.moreRows, { color: colors.textMuted }]}>
                    +{group.entries.length - MAX_ROWS_PER_EVENT} more
                  </Text>
                )}
              </View>
            )
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: TYPOGRAPHY.title.size, fontWeight: TYPOGRAPHY.title.weight, letterSpacing: -0.5 },
  card: {
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.md,
  },
  colorBar: { width: 4, alignSelf: 'stretch', borderRadius: 2, minHeight: 40 },
  cardHeaderBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: TYPOGRAPHY.body.size + 1, fontWeight: '700', letterSpacing: -0.2 },
  cardDate: { fontSize: TYPOGRAPHY.caption.size },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  avatarSm: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  actionLabel: { flex: 1, fontSize: TYPOGRAPHY.body.size - 1, fontWeight: '600' },
  actionTime: { fontSize: TYPOGRAPHY.caption.size },
  moreRows: {
    fontSize: TYPOGRAPHY.caption.size,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: TYPOGRAPHY.heading.size, fontWeight: '600' },
  emptyText: { fontSize: TYPOGRAPHY.body.size, textAlign: 'center', lineHeight: 22 },
})
