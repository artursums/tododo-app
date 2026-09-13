import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, BackHandler, Alert } from 'react-native'
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { TododoIcon } from '../components/TododoIcon'
import * as Haptics from 'expo-haptics'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useTheme } from '../contexts/ThemeContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'
import { useCalendars } from '../contexts/CalendarsContext'
import type { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator'
import { SPACING, SHADOWS } from '../constants/theme'
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
import { syncCalendarToWidget } from '../services/calendarWidgetSync'
import { scheduleTodoReminder, cancelTodoReminder } from '../services/todoReminders'
import { todayKey, formatMonthYear, formatWeekRange, addDays, toDateKey } from '../utils/calendarDates'
import { indexEventsByDate } from '../utils/todoEvent'
import TodoItemRow from '../components/calendar/TodoItemRow'
import CalendarArtwork from '../components/calendar/CalendarArtwork'
import MonthGrid from '../components/calendar/MonthGrid'
import WeekView from '../components/calendar/WeekView'
import YearView from '../components/calendar/YearView'
import DayAgenda from '../components/calendar/DayAgenda'
import CategoryFilterChips from '../components/calendar/CategoryFilterChips'
import TodoEditor from '../components/calendar/TodoEditor'

type CalendarView = 'month' | 'week' | 'year' | 'memos'
const VIEW_ORDER: CalendarView[] = ['month', 'week', 'year', 'memos']
const VIEW_LABEL: Record<CalendarView, string> = { month: 'Month', week: 'Week', year: 'Year', memos: 'Memos' }

// Horizontal swipe paging: how far (px) or how fast (px/s) a drag must travel
// before it counts as a page turn.
const SWIPE_TRIGGER = 48
const SWIPE_VELOCITY = 500

/**
 * To-Do Calendar (ported from the breathing app, where it lived as BA-015
 * before being spun out into tododo) — month/week/year views + on-demand day
 * agenda + editor. Local-first (AsyncStorage) with Supabase sync so items
 * survive a reinstall (once Supabase is wired and the user signs in).
 */
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Calendar'>,
  NativeStackNavigationProp<RootStackParamList>
>

export default function CalendarScreen() {
  const { colors, settings } = useTheme()
  const route = useRoute<any>()
  const accent = colors.accent
  const { user } = useAuth()
  const shared = useHousehold()
  const navigation = useNavigation<Nav>()
  const { calendars, activeCalendarId, setActiveCalendarId, replaceCalendars } = useCalendars()

  const [items, setItems] = useState<TodoItem[]>([])
  const [categories, setCategories] = useState<TodoCategory[]>([])
  const [view, setView] = useState<CalendarView>(settings.defaultView)
  useEffect(() => { setView(settings.defaultView) }, [settings.defaultView])
  useEffect(() => { if (route.params?.view) setView(route.params.view) }, [route.params?.view, route.params?.request])
  // A single anchor date drives all three views; month/week/year are derived.
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const year = anchor.getFullYear()
  const monthIndex = anchor.getMonth()
  const [selectedDay, setSelectedDay] = useState<string>(todayKey)
  const [agendaVisible, setAgendaVisible] = useState(false)
  const [calendarPickerVisible, setCalendarPickerVisible] = useState(false)
  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [editorVisible, setEditorVisible] = useState(false)
  const [editing, setEditing] = useState<TodoItem | null>(null)
  // The day a NEW item targets — tracked separately from `selectedDay` so opening
  // the editor from the FAB doesn't also pop the day-agenda sheet open behind it.
  const [editorDate, setEditorDate] = useState<string>(todayKey())
  useEffect(() => {
    if (!agendaVisible) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setAgendaVisible(false)
      return true
    })
    return () => subscription.remove()
  }, [agendaVisible])

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
    async (next: TodoItem[]) => {
      await saveItems(next)
      itemsRef.current = next
      setItems(next)
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
    syncCalendarToWidget(visibleItems(items).filter(item => !item.isMemo), categories)
  }, [items, categories])

  const allCategories = useMemo(() => [...categories, ...shared.categories], [categories, shared.categories])
  const visible = useMemo(() => visibleItems([...items, ...shared.items]).filter(item => !settings.hideCompleted || !item.completed), [items, shared.items, settings.hideCompleted])

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
  const itemsByDate = useMemo(() => indexEventsByDate(
    filtered,
    toDateKey(new Date(year, -1, 20)),
    toDateKey(new Date(year + 1, 0, 10)),
  ), [filtered, year])
  const memos = useMemo(() => filtered.filter(item => item.isMemo), [filtered])

  const dayItems = itemsByDate[selectedDay] ?? []
  const colorOf = useCallback(
    (id: string) => allCategories.find(c => c.id === id)?.color ?? FALLBACK_CATEGORY_COLOR,
    [allCategories],
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
      const destination = calendars.find(c => c.id === item.calendarId)
      if (destination?.householdId || item.householdId) {
        if (editing && !editing.householdId) throw new Error('Create a new plan to share it with this calendar.')
        await shared.saveEvent(item, allCategories.find(c => c.id === item.categoryId))
        setEditorVisible(false); setEditing(null)
        if (item.isMemo) { setView('memos'); setAgendaVisible(false) }
        return
      }
      // Reconcile the local notification: cancel the old, schedule the new.
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
      try {
        await persist(upsertItem(itemsRef.current, finalItem))
      } catch (error) {
        if (notifId) await cancelTodoReminder(notifId)
        throw error
      }
      if (editing?.reminderNotificationId) await cancelTodoReminder(editing.reminderNotificationId)
      recordActivity({
        action: editing ? 'edited' : 'created',
        itemId: finalItem.id,
        itemTitle: finalItem.title,
        itemDate: finalItem.date,
        itemAllDay: finalItem.allDay,
        itemIsMemo: finalItem.isMemo,
        itemEndDate: finalItem.endDate,
        itemStartTime: finalItem.startTime,
        itemEndTime: finalItem.endTime,
        itemColor: colorOf(finalItem.categoryId),
        calendarId: effectiveCalendarId(finalItem),
      })
      setEditorVisible(false)
      setEditing(null)
      if (finalItem.isMemo) { setView('memos'); setAgendaVisible(false) }
      else if (view === 'memos') { setView('month'); setAnchor(new Date(finalItem.date + 'T12:00:00')) }
    },
    [editing, persist, colorOf, effectiveCalendarId, view, calendars, shared, allCategories],
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
    async (id: string) => {
      const sharedItem = shared.items.find(i => i.id === id)
      if (sharedItem) {
        try { await shared.saveEvent({ ...sharedItem, completed: !sharedItem.completed }) }
        catch { Alert.alert('Could not update plan', 'Check your connection and try again.') }
        return
      }
      const current = itemsRef.current.find(i => i.id === id)
      const completing = !current?.completed
      try { await persist(setItemCompleted(itemsRef.current, id, completing)) }
      catch { Alert.alert('Could not update plan', 'Please try again.'); return }
      if (completing && current?.reminderNotificationId) cancelTodoReminder(current.reminderNotificationId)
      if (current) {
        recordActivity({
          action: completing ? 'completed' : 'reopened',
          itemId: current.id,
          itemTitle: current.title,
          itemDate: current.date,
          itemAllDay: current.allDay,
          itemIsMemo: current.isMemo,
          itemEndDate: current.endDate,
          itemStartTime: current.startTime,
          itemEndTime: current.endTime,
          itemColor: colorOf(current.categoryId),
          calendarId: effectiveCalendarId(current),
        })
      }
    },
    [persist, colorOf, effectiveCalendarId, shared],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      const sharedItem = shared.items.find(i => i.id === id)
      if (sharedItem) {
        await shared.saveEvent({ ...sharedItem, deletedAt: new Date().toISOString() })
        setEditorVisible(false); setEditing(null); return
      }
      const current = itemsRef.current.find(i => i.id === id)
      await persist(softDeleteItem(itemsRef.current, id))
      if (current?.reminderNotificationId) await cancelTodoReminder(current.reminderNotificationId)
      if (current) {
        recordActivity({
          action: 'deleted',
          itemId: current.id,
          itemTitle: current.title,
          itemDate: current.date,
          itemAllDay: current.allDay,
          itemIsMemo: current.isMemo,
          itemEndDate: current.endDate,
          itemStartTime: current.startTime,
          itemEndTime: current.endTime,
          itemColor: colorOf(current.categoryId),
          calendarId: effectiveCalendarId(current),
        })
      }
      setEditorVisible(false)
      setEditing(null)
    },
    [persist, colorOf, effectiveCalendarId, shared],
  )

  const toggleFilter = useCallback((id: string) => {
    setFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const goToday = useCallback(() => {
    setAnchor(new Date())
    setSelectedDay(todayKey())
  }, [])

  // Prev/next steps by the unit the active view shows. Remembers the direction
  // so the entering animation slides the new period in from the correct side.
  const [slideDir, setSlideDir] = useState<1 | -1>(1)
  const shift = useCallback(
    (delta: number) => {
      setSlideDir(delta > 0 ? 1 : -1)
      const next = view === 'week'
        ? addDays(anchor, delta * 7)
        : view === 'year'
          ? new Date(anchor.getFullYear() + delta, anchor.getMonth(), 1)
          : new Date(anchor.getFullYear(), anchor.getMonth() + delta, 1)
      setAnchor(next)
      setSelectedDay(toDateKey(next))
    },
    [view, anchor],
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
    setSelectedDay(toDateKey(new Date(year, mi, 1)))
  }, [year])

  const periodLabel =
    view === 'memos' ? 'Memos' : view === 'month' ? formatMonthYear(year, monthIndex) : view === 'week' ? formatWeekRange(anchor) : `${year}`

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headingBody}>
          <Text accessibilityRole="header" style={[styles.monthTitle, { color: colors.text }]}>{periodLabel}</Text>
          <Pressable
            onPress={() => setCalendarPickerVisible(true)}
            style={({ pressed }) => [styles.calChip, pressed && { backgroundColor: colors.accentLight }]}
            accessibilityRole="button"
            accessibilityLabel={`Choose calendar, ${activeCalendar?.name ?? 'All calendars'}`}
          >
            {activeCalendar?.coverImage
              ? <View style={styles.headerPhoto}><CalendarArtwork coverImage={activeCalendar.coverImage} emoji={activeCalendar.emoji} size={14} radius={6} /></View>
              : <View style={[styles.calChipDot, { backgroundColor: activeCalendar?.color ?? accent }]} />}
            <Text numberOfLines={1} style={[styles.calChipText, { color: colors.textSecondary }]}>{activeCalendar?.name ?? 'All calendars'}</Text>
            <TododoIcon name="chevron-down" size={15} color={colors.textSecondary} />
          </Pressable>
        </View>
        {view !== 'memos' && <View style={styles.periodControls}>
          <Pressable style={styles.iconButton} onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel={`Previous ${view}`}>
            <TododoIcon name="chevron-left" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={goToday} accessibilityRole="button" style={({ pressed }) => [styles.todayBtn, { backgroundColor: pressed ? colors.accentLight : colors.card, borderColor: colors.border }]}>
            <Text style={[styles.viewText, { color: accent }]}>Today</Text>
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel={`Next ${view}`}>
            <TododoIcon name="chevron-right" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>}
      </View>
      <View style={styles.toolbar}>
        <View style={[styles.segments, { backgroundColor: colors.borderLight }]}>
          {VIEW_ORDER.map(option => (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === option }}
              accessibilityLabel={`${VIEW_LABEL[option]} view`}
              onPress={() => { Haptics.selectionAsync(); setView(option) }}
              style={[styles.segment, view === option && { backgroundColor: colors.card, ...SHADOWS.sm }]}
            >
              <Text style={[styles.viewText, { color: view === option ? accent : colors.textSecondary }]}>{VIEW_LABEL[option]}</Text>
            </Pressable>
          ))}
        </View>

      </View>
      {shared.error && <Pressable accessibilityRole="button" onPress={() => shared.refresh()} style={{ paddingHorizontal: 24, paddingVertical: 8 }}><Text style={{ color: colors.error, fontSize: 12 }}>Shared calendars couldn’t refresh. Tap to retry.</Text></Pressable>}
      <CategoryFilterChips categories={allCategories} active={filters} onToggle={toggleFilter} onClear={() => setFilters(new Set())} />

      <GestureDetector gesture={swipeGesture}>
        {view === 'memos' ? (
          <ScrollView style={styles.viewScroll} contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}>
            {memos.length === 0 ? <View style={styles.memoEmpty}><TododoIcon name="bookmark" size={30} color={accent} /><Text style={[styles.pickerTitle, { color: colors.text }]}>{filters.size ? 'No memos in these topics' : 'Room for ideas'}</Text><Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{filters.size ? 'Clear the selection to see your other memos.' : 'Save a memo for plans that don’t need a date yet.'}</Text>{filters.size > 0 && <Pressable accessibilityRole="button" onPress={() => setFilters(new Set())} style={styles.todayBtn}><Text style={{ color: accent }}>Clear selection</Text></Pressable>}</View> : memos.map(item => <TodoItemRow key={item.id} item={item} color={colorOf(item.categoryId)} categoryName={allCategories.find(category => category.id === item.categoryId)?.name} onPress={() => openEdit(item)} onToggle={() => handleToggle(item.id)} />)}
          </ScrollView>
        ) : view === 'month' ? (
          <Animated.View
            key={periodLabel}
            entering={(slideDir === 1 ? FadeInRight : FadeInLeft).duration(180)}
            style={[styles.monthCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <MonthGrid
              fill
              year={year}
              monthIndex={monthIndex}
              itemsByDate={itemsByDate}
              categoryColor={colorOf}
              selectedKey={selectedDay}
              onSelectDay={day => { setSelectedDay(day); setAgendaVisible(true) }}
              accent={accent}
            />
          </Animated.View>
        ) : (
          <ScrollView style={styles.viewScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.md }}>
            <Animated.View key={`${view}-${periodLabel}`} entering={(slideDir === 1 ? FadeInRight : FadeInLeft).duration(180)}>
              {view === 'week' ? (
                <WeekView
                  anchor={anchor}
                  itemsByDate={itemsByDate}
                  categories={allCategories}
                  accent={accent}
                  onToggle={handleToggle}
                  onEdit={openEdit}
                  onAdd={openNew}
                />
              ) : (
                <YearView year={year} itemsByDate={itemsByDate} accent={accent} onSelectMonth={openMonthFromYear} />
              )}
            </Animated.View>
          </ScrollView>
        )}
      </GestureDetector>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a plan"
        style={({ pressed }) => [styles.addButton, { backgroundColor: accent, opacity: pressed ? 0.8 : 1 }]}
        onPress={() => openNew(selectedDay)}
      >
        <TododoIcon name="plus" size={26} color={colors.onAccent} />
      </Pressable>

      {agendaVisible && (
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={() => setAgendaVisible(false)} accessibilityRole="button" accessibilityLabel="Close day plans" />
          <View style={[styles.agendaSheet, { backgroundColor: colors.bg }]}>
            <Pressable style={styles.agendaClose} onPress={() => setAgendaVisible(false)} accessibilityRole="button" accessibilityLabel="Close day plans">
              <TododoIcon name="x" size={22} color={colors.textSecondary} />
            </Pressable>
            <DayAgenda
              dateKey={selectedDay}
              items={dayItems}
              categories={allCategories}
              accent={accent}
              filtered={filters.size > 0}
              onClearFilters={() => setFilters(new Set())}
              onToggle={handleToggle}
              onEdit={openEdit}
              onAdd={() => openNew(selectedDay)}
            />
          </View>
        </View>
      )}

      <Modal visible={calendarPickerVisible} transparent animationType="fade" onRequestClose={() => setCalendarPickerVisible(false)}>
        <View style={[styles.pickerOverlay, { backgroundColor: colors.overlay }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCalendarPickerVisible(false)} accessibilityRole="button" accessibilityLabel="Close calendar picker" />
          <View accessibilityViewIsModal style={[styles.pickerSheet, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeader}>
              <Text accessibilityRole="header" style={[styles.pickerTitle, { color: colors.text }]}>Your calendars</Text>
              <Pressable style={styles.iconButton} onPress={() => setCalendarPickerVisible(false)} accessibilityRole="button" accessibilityLabel="Close calendar picker">
                <TododoIcon name="x" size={21} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView>
              {[{ id: ALL_CALENDARS_ID, name: 'All calendars', color: accent, emoji: '✦', coverImage: undefined }, ...calendars].map(cal => (
                <Pressable key={cal.id} accessibilityRole="button" accessibilityState={{ selected: activeCalendarId === cal.id }}
                  onPress={() => { setActiveCalendarId(cal.id); setCalendarPickerVisible(false) }}
                  style={[styles.pickerRow, activeCalendarId === cal.id && { backgroundColor: colors.accentLight }]}>
                  <View style={[styles.pickerTile, { backgroundColor: cal.color + '20' }]}><CalendarArtwork coverImage={cal.coverImage} emoji={cal.emoji} size={22} radius={12} /></View>
                  <Text style={[styles.pickerName, { color: colors.text }]}>{cal.name}</Text>
                  {activeCalendarId === cal.id && <TododoIcon name="check" size={19} color={accent} />}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.pickerRow} accessibilityRole="button" onPress={() => { setCalendarPickerVisible(false); navigation.navigate('Calendars') }}>
              <TododoIcon name="sliders" size={20} color={accent} />
              <Text style={[styles.pickerName, { color: accent }]}>Create or manage calendars</Text>
              <TododoIcon name="arrow-right" size={19} color={accent} />
            </Pressable>
          </View>
        </View>
      </Modal>

      <TodoEditor
        visible={editorVisible}
        editing={editing}
        defaultDate={editorDate}
        defaultIsMemo={view === 'memos'}
        defaultCalendarId={activeCalendarId === ALL_CALENDARS_ID ? PERSONAL_CALENDAR_ID : activeCalendarId}
        calendars={editing ? calendars.filter(c => editing.householdId ? c.householdId === editing.householdId : !c.householdId) : calendars}
        categories={allCategories}
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
  memoEmpty: { alignItems: 'center', padding: 32, gap: 12 },
  viewScroll: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.lg, paddingTop: 12, paddingBottom: 8 },
  headingBody: { flex: 1, minWidth: 0 },
  monthTitle: { fontSize: 30, fontWeight: '700', letterSpacing: -1 },
  periodControls: { flexDirection: 'row', alignItems: 'center', marginRight: -12 },
  toolbar: { paddingHorizontal: SPACING.lg, marginBottom: 8 },
  segments: { flexDirection: 'row', padding: 3, borderRadius: 16 },
  segment: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  todayBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, borderWidth: 1 },
  calChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, maxWidth: '100%', paddingHorizontal: 2, borderRadius: 10 },
  headerPhoto: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  calChipDot: { width: 7, height: 7, borderRadius: 4 },
  calChipText: { fontSize: 13, fontWeight: '500', flexShrink: 1 },
  viewText: { fontSize: 13, fontWeight: '600' },
  monthCard: { flex: 1, minHeight: 0, marginHorizontal: 16, marginTop: 8, marginBottom: 8, borderRadius: 20, borderWidth: 1, overflow: 'hidden', paddingBottom: 68 },
  addButton: { position: 'absolute', right: SPACING.lg, bottom: SPACING.md, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', ...SHADOWS.md },
  agendaSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 16 },
  agendaClose: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 8 },
  pickerOverlay: { flex: 1, justifyContent: 'center', padding: SPACING.lg },
  pickerSheet: { padding: 16, borderRadius: 28, maxHeight: '75%' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12 },
  pickerTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.5 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, minHeight: 56 },
  pickerTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pickerEmoji: { fontSize: 22 },
  pickerName: { flex: 1, fontSize: 15, fontWeight: '600' },
})
