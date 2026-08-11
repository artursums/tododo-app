import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import Animated, { FadeIn, FadeOut, FadeInLeft, FadeInRight, SlideInDown, SlideOutDown } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useCalendars } from '../contexts/CalendarsContext'
import type { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator'
import { SPACING, RADIUS, TYPOGRAPHY, SHADOWS } from '../constants/theme'
import {
  TodoItem,
  TodoCategory,
  FALLBACK_CATEGORY_COLOR,
  makeCategory,
  PERSONAL_CALENDAR_ID,
  ALL_CALENDARS_ID,
} from '../types/todo'
import {
  loadItems,
  loadCategories,
  saveItems,
  saveCategories,
  visibleItems,
  upsertItem,
  softDeleteItem,
  setItemCompleted,
} from '../services/todoStorage'
import { requestSync } from '../services/todoSync'
import { recordActivity } from '../services/todoActivity'
import { isSupabaseConfigured } from '../services/supabase'
import { syncCalendarToWidget } from '../services/calendarWidgetSync'
import { scheduleTodoReminder, cancelTodoReminder } from '../services/todoReminders'
import { todayKey, formatMonthYear, formatWeekRange, addDays } from '../utils/calendarDates'
import MonthGrid from '../components/calendar/MonthGrid'
import WeekView from '../components/calendar/WeekView'
import YearView from '../components/calendar/YearView'
import DayAgenda from '../components/calendar/DayAgenda'
import CategoryFilterChips from '../components/calendar/CategoryFilterChips'
import TodoEditor from '../components/calendar/TodoEditor'

type CalendarView = 'month' | 'week' | 'year'
const VIEW_ORDER: CalendarView[] = ['month', 'week', 'year']
const VIEW_LABEL: Record<CalendarView, string> = { month: 'Monthly', week: 'Weekly', year: 'Yearly' }

// Horizontal swipe paging: how far (px) or how fast (px/s) a drag must travel
// before it counts as a page turn.
const SWIPE_TRIGGER = 48
const SWIPE_VELOCITY = 500

/**
 * To-Do Calendar (ported from the breathing app, where it lived as BA-015
 * before being spun out into tododo) — month/week/year views + slide-up day
 * agenda + editor. Local-first (AsyncStorage) with Supabase sync so items
 * survive a reinstall (once Supabase is wired and the user signs in).
 */
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Calendar'>,
  NativeStackNavigationProp<RootStackParamList>
>

export default function CalendarScreen() {
  const { colors } = useTheme()
  const accent = colors.accent
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { calendars, activeCalendarId, replaceCalendars } = useCalendars()

  const [items, setItems] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<TodoCategory[]>([])
  const [view, setView] = useState<CalendarView>('month')
  // A single anchor date drives all three views; month/week/year are derived.
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const year = anchor.getFullYear()
  const monthIndex = anchor.getMonth()
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [editorVisible, setEditorVisible] = useState(false)
  const [editing, setEditing] = useState<TodoItem | null>(null)
  // The day a NEW item targets — tracked separately from `selectedDay` so opening
  // the editor from the FAB doesn't also pop the day-agenda sheet open behind it.
  const [editorDate, setEditorDate] = useState<string>(todayKey())
  const [nudgeDismissed, setNudgeDismissed] = useState(false)

  const itemsRef = useRef<TodoItem[]>([])
  itemsRef.current = items
  // Latest categories for handlers that create a tag mid-edit (avoids a stale
  // closure and reuses the same last-write-wins path as items).
  const categoriesRef = useRef<TodoCategory[]>([])
  categoriesRef.current = categories
  // Stable handle for feeding sync results into the calendars context without
  // widening effect dependency arrays.
  const replaceCalendarsRef = useRef(replaceCalendars)
  replaceCalendarsRef.current = replaceCalendars

  // Initial load + (if signed in) cloud sync.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [cats, its] = await Promise.all([loadCategories(), loadItems()])
      if (!alive) return
      setCategories(cats)
      setItems(its)
      if (user?.id) {
        // Serialized entry point: runs the cross-account ownership guard and
        // coalesces concurrent syncs (see todoSync.requestSync).
        const res = await requestSync(user.id)
        if (alive && res.ok) {
          setItems(res.items)
          setCategories(res.categories)
          replaceCalendarsRef.current(res.calendars)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [user?.id])

  // Persist locally + fire-and-forget cloud sync.
  const persist = useCallback(
    (next: TodoItem[]) => {
      setItems(next)
      saveItems(next)
      if (user?.id) {
        requestSync(user.id).then(res => {
          if (res.ok) setItems(res.items)
        })
      }
    },
    [user?.id],
  )

  // Keep the (future, M4) iOS home-screen calendar widget in sync with whatever
  // is on screen. Runs on load, every edit, and after a cloud sync. No-op until
  // the widget target exists; no-op on Android.
  useEffect(() => {
    syncCalendarToWidget(visibleItems(items), categories)
  }, [items, categories])

  const visible = useMemo(() => visibleItems(items), [items])

  // Which calendar an item effectively belongs to: orphans (calendar deleted or
  // pre-multi-calendar items with no id) fall back to Personal.
  const liveCalendarIds = useMemo(() => new Set(calendars.map(c => c.id)), [calendars])
  const effectiveCalendarId = useCallback(
    (i: TodoItem) =>
      i.calendarId && liveCalendarIds.has(i.calendarId) ? i.calendarId : PERSONAL_CALENDAR_ID,
    [liveCalendarIds],
  )

  const inActiveCalendar = useMemo(
    () =>
      activeCalendarId === ALL_CALENDARS_ID
        ? visible
        : visible.filter(i => effectiveCalendarId(i) === activeCalendarId),
    [visible, activeCalendarId, effectiveCalendarId],
  )
  const filtered = useMemo(
    () => (filters.size === 0 ? inActiveCalendar : inActiveCalendar.filter(i => filters.has(i.categoryId))),
    [inActiveCalendar, filters],
  )

  const activeCalendar = useMemo(
    () => calendars.find(c => c.id === activeCalendarId) ?? null,
    [calendars, activeCalendarId],
  )
  const itemsByDate = useMemo(() => {
    const map: Record<string, TodoItem[]> = {}
    for (const it of filtered) (map[it.date] ??= []).push(it)
    return map
  }, [filtered])

  const dayItems = selectedDay ? itemsByDate[selectedDay] ?? [] : []
  const colorOf = useCallback(
    (id: string) => categories.find(c => c.id === id)?.color ?? FALLBACK_CATEGORY_COLOR,
    [categories],
  )

  // --- handlers ---------------------------------------------------------------
  const openNew = useCallback((day: string) => {
    setEditing(null)
    setEditorDate(day)
    setEditorVisible(true)
  }, [])

  const openEdit = useCallback((item: TodoItem) => {
    setEditing(item)
    setEditorVisible(true)
  }, [])

  const handleSave = useCallback(
    async (item: TodoItem) => {
      // Reconcile the local notification: cancel the old, schedule the new.
      if (editing?.reminderNotificationId) await cancelTodoReminder(editing.reminderNotificationId)
      let notifId: string | undefined
      if (item.reminderAt && !item.completed) {
        notifId =
          (await scheduleTodoReminder({
            title: item.title,
            body: 'A gentle nudge from tododo',
            fireAt: new Date(item.reminderAt),
          })) ?? undefined
      }
      const finalItem: TodoItem = { ...item, reminderNotificationId: notifId }
      persist(upsertItem(itemsRef.current, finalItem))
      recordActivity({
        action: editing ? 'edited' : 'created',
        itemId: finalItem.id,
        itemTitle: finalItem.title,
        itemDate: finalItem.date,
        itemAllDay: finalItem.allDay,
        itemStartTime: finalItem.startTime,
        itemEndTime: finalItem.endTime,
        itemColor: colorOf(finalItem.categoryId),
        calendarId: effectiveCalendarId(finalItem),
      })
      setEditorVisible(false)
      setEditing(null)
    },
    [editing, persist, colorOf, effectiveCalendarId],
  )

  // Create a user tag on the fly: appended to state, persisted locally, and
  // (when signed in) pushed to the cloud so it's available for future events on
  // every device. Returns the new category so the editor can select it.
  const handleCreateCategory = useCallback(
    (name: string): TodoCategory => {
      const cat = makeCategory(name, categoriesRef.current)
      const next = [...categoriesRef.current, cat]
      categoriesRef.current = next
      setCategories(next)
      saveCategories(next)
      if (user?.id) {
        requestSync(user.id).then(res => {
          if (res.ok) setCategories(res.categories)
        })
      }
      return cat
    },
    [user?.id],
  )

  const handleToggle = useCallback(
    (id: string) => {
      const current = itemsRef.current.find(i => i.id === id)
      const completing = !current?.completed
      if (completing && current?.reminderNotificationId) cancelTodoReminder(current.reminderNotificationId)
      persist(setItemCompleted(itemsRef.current, id, completing))
      if (current) {
        recordActivity({
          action: completing ? 'completed' : 'reopened',
          itemId: current.id,
          itemTitle: current.title,
          itemDate: current.date,
          itemAllDay: current.allDay,
          itemStartTime: current.startTime,
          itemEndTime: current.endTime,
          itemColor: colorOf(current.categoryId),
          calendarId: effectiveCalendarId(current),
        })
      }
    },
    [persist, colorOf, effectiveCalendarId],
  )

  const handleDelete = useCallback(
    (id: string) => {
      const current = itemsRef.current.find(i => i.id === id)
      if (current?.reminderNotificationId) cancelTodoReminder(current.reminderNotificationId)
      persist(softDeleteItem(itemsRef.current, id))
      if (current) {
        recordActivity({
          action: 'deleted',
          itemId: current.id,
          itemTitle: current.title,
          itemDate: current.date,
          itemAllDay: current.allDay,
          itemStartTime: current.startTime,
          itemEndTime: current.endTime,
          itemColor: colorOf(current.categoryId),
          calendarId: effectiveCalendarId(current),
        })
      }
      setEditorVisible(false)
      setEditing(null)
    },
    [persist, colorOf, effectiveCalendarId],
  )

  const toggleFilter = useCallback((id: string) => {
    setFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Tapping the period title jumps back to today (keeps the current view).
  const goToday = useCallback(() => setAnchor(new Date()), [])

  // Cycle the view pill: Monthly → Weekly → Yearly → Monthly.
  const cycleView = useCallback(() => {
    Haptics.selectionAsync()
    setView(v => VIEW_ORDER[(VIEW_ORDER.indexOf(v) + 1) % VIEW_ORDER.length])
  }, [])

  // Prev/next steps by the unit the active view shows. Remembers the direction
  // so the entering animation slides the new period in from the correct side.
  const [slideDir, setSlideDir] = useState<1 | -1>(1)
  const shift = useCallback(
    (delta: number) => {
      setSlideDir(delta > 0 ? 1 : -1)
      setAnchor(a => {
        if (view === 'week') return addDays(a, delta * 7)
        if (view === 'year') return new Date(a.getFullYear() + delta, a.getMonth(), 1)
        return new Date(a.getFullYear(), a.getMonth() + delta, 1)
      })
    },
    [view],
  )

  // Swipe anywhere on the calendar area to page the active view: left → next
  // month/week/year, right → previous (mirrors the chevrons). activeOffsetX /
  // failOffsetY hand clearly-vertical drags to the ScrollView, so scrolling
  // still wins unless the drag is horizontal.
  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .runOnJS(true)
        .onEnd(e => {
          if (e.translationX < -SWIPE_TRIGGER || e.velocityX < -SWIPE_VELOCITY) {
            Haptics.selectionAsync()
            shift(1)
          } else if (e.translationX > SWIPE_TRIGGER || e.velocityX > SWIPE_VELOCITY) {
            Haptics.selectionAsync()
            shift(-1)
          }
        }),
    [shift],
  )

  const openMonthFromYear = useCallback((mi: number) => {
    setAnchor(new Date(year, mi, 1))
    setView('month')
  }, [year])

  const periodLabel =
    view === 'month' ? formatMonthYear(year, monthIndex) : view === 'week' ? formatWeekRange(anchor) : `${year}`

  // The reinstall guarantee needs an account — only worth nudging once Supabase
  // is actually wired (signing in is impossible before that).
  const showNudge = isSupabaseConfigured && !user && !nudgeDismissed && items.length > 0

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Period header: tap the title to jump to today; the pill cycles views. */}
      <View style={styles.header}>
        <Pressable onPress={goToday} hitSlop={8} accessibilityLabel="Jump to today">
          <Text style={[styles.monthTitle, { color: colors.text }]}>{periodLabel}</Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            onPress={cycleView}
            hitSlop={8}
            style={[styles.viewBtn, { backgroundColor: accent + '1F', borderColor: accent }]}
            accessibilityLabel={`Switch view, currently ${VIEW_LABEL[view]}`}
          >
            <Text style={[styles.viewText, { color: accent }]}>{VIEW_LABEL[view]}</Text>
          </Pressable>
          <Pressable onPress={() => shift(-1)} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => shift(1)} hitSlop={8}>
            <Feather name="chevron-right" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>

      {/* Which calendar is on screen (TimeTree-style). Tap → the Calendars tab. */}
      <Pressable
        onPress={() => navigation.navigate('Calendars')}
        style={({ pressed }) => [styles.calChip, pressed && { opacity: 0.7 }]}
        accessibilityLabel="Choose calendar"
      >
        {activeCalendar ? (
          <>
            <View style={[styles.calChipDot, { backgroundColor: activeCalendar.color }]} />
            <Text style={[styles.calChipText, { color: colors.textSecondary }]}>{activeCalendar.name}</Text>
          </>
        ) : (
          <>
            <Feather name="grid" size={11} color={colors.textSecondary} />
            <Text style={[styles.calChipText, { color: colors.textSecondary }]}>All calendars</Text>
          </>
        )}
        <Feather name="chevron-down" size={13} color={colors.textMuted} />
      </Pressable>

      <CategoryFilterChips categories={categories} active={filters} onToggle={toggleFilter} />

      <GestureDetector gesture={swipeGesture}>
        <ScrollView style={styles.viewScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Keyed by period so paging remounts the content with a short
              directional slide+fade — the new month enters from the side you
              swiped towards. */}
          <Animated.View
            key={`${view}-${periodLabel}`}
            entering={(slideDir === 1 ? FadeInRight : FadeInLeft).duration(180)}
          >
            {view === 'month' && (
              <MonthGrid
                year={year}
                monthIndex={monthIndex}
                itemsByDate={itemsByDate}
                categoryColor={colorOf}
                selectedKey={selectedDay}
                onSelectDay={day => setSelectedDay(day)}
                accent={accent}
              />
            )}
            {view === 'week' && (
              <WeekView
                anchor={anchor}
                itemsByDate={itemsByDate}
                categories={categories}
                accent={accent}
                onToggle={handleToggle}
                onEdit={openEdit}
                onAdd={openNew}
              />
            )}
            {view === 'year' && (
              <YearView year={year} itemsByDate={itemsByDate} accent={accent} onSelectMonth={openMonthFromYear} />
            )}
          </Animated.View>
        </ScrollView>
      </GestureDetector>

      {/* Sign-in nudge: the reinstall guarantee needs an account. */}
      {showNudge && (
        <View style={[styles.nudge, { backgroundColor: colors.card, borderColor: colors.border, bottom: SPACING.xl + 72 }]}>
          <Feather name="cloud" size={18} color={accent} />
          <Text style={[styles.nudgeText, { color: colors.textSecondary }]}>
            Sign in so your list is safe and comes back if you reinstall.
          </Text>
          <Pressable onPress={() => navigation.navigate('Auth')} hitSlop={6}>
            <Text style={[styles.nudgeAction, { color: accent }]}>Sign in</Text>
          </Pressable>
          <Pressable onPress={() => setNudgeDismissed(true)} hitSlop={6}>
            <Feather name="x" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      )}

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, { backgroundColor: accent, bottom: SPACING.xl, opacity: pressed ? 0.8 : 1 }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          openNew(selectedDay ?? todayKey())
        }}
        accessibilityLabel="Add a to-do"
      >
        <Feather name="plus" size={26} color={colors.white} />
      </Pressable>

      {/* Day agenda sheet — an in-screen animated sheet (NOT a native Modal) so the
          editor Modal below can present cleanly over it. Two stacked native modals
          don't reliably co-present on iOS. */}
      {selectedDay && (
        <>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedDay(null)} />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.duration(240)}
            exiting={SlideOutDown.duration(180)}
            style={[styles.agendaSheet, { backgroundColor: colors.bg, paddingBottom: insets.bottom > 0 ? SPACING.sm : SPACING.md }]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <DayAgenda
              dateKey={selectedDay}
              items={dayItems}
              categories={categories}
              accent={accent}
              onToggle={handleToggle}
              onEdit={openEdit}
              onAdd={() => openNew(selectedDay)}
            />
          </Animated.View>
        </>
      )}

      <TodoEditor
        visible={editorVisible}
        editing={editing}
        defaultDate={editorDate}
        defaultCalendarId={activeCalendarId === ALL_CALENDARS_ID ? PERSONAL_CALENDAR_ID : activeCalendarId}
        calendars={calendars}
        categories={categories}
        onClose={() => {
          setEditorVisible(false)
          setEditing(null)
        }}
        onSave={handleSave}
        onDelete={handleDelete}
        onCreateCategory={handleCreateCategory}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // flex:1 so the scrollable view area owns the remaining space; this pins the
  // category chips bar above it to its natural content height in every view
  // (otherwise the bar absorbed leftover space and stretched the chips).
  viewScroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  monthTitle: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  calChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  calChipDot: { width: 8, height: 8, borderRadius: 4 },
  calChipText: { fontSize: TYPOGRAPHY.caption.size, fontWeight: '600' },
  viewBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  viewText: { fontSize: 13, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.lg,
  },
  nudge: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderCurve: 'continuous',
    ...SHADOWS.md,
  },
  nudgeText: { flex: 1, fontSize: TYPOGRAPHY.caption.size, lineHeight: 17 },
  nudgeAction: { fontSize: TYPOGRAPHY.caption.size, fontWeight: '700' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  agendaSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderCurve: 'continuous',
    paddingTop: SPACING.sm,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: SPACING.xs },
})
