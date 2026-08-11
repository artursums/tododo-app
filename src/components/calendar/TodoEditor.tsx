import React, { useEffect, useState, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { Picker } from '@react-native-picker/picker'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING, RADIUS, TYPOGRAPHY } from '../../constants/theme'
import { TodoItem, TodoCategory, TodoCalendar, makeId, PERSONAL_CALENDAR_ID } from '../../types/todo'
import { formatLongDate, formatMonthYear, addMonths, fromDateKey, combineDateTime } from '../../utils/calendarDates'
import MonthGrid from './MonthGrid'

interface Props {
  visible: boolean
  editing: TodoItem | null
  defaultDate: string
  /** Calendar a NEW item lands in (the active one; Personal when viewing All). */
  defaultCalendarId: string
  calendars: TodoCalendar[]
  categories: TodoCategory[]
  onClose: () => void
  onSave: (item: TodoItem) => void
  onDelete: (id: string) => void
  /** Create a new tag from a name; returns the created category so we can select it. */
  onCreateCategory: (name: string) => TodoCategory
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0,5,...,55
const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** Two-wheel HH:mm time picker (uses the installed @react-native-picker/picker). */
function TimeWheel({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  const { colors } = useTheme()
  const [h, m] = value.split(':').map(Number)
  return (
    <View style={styles.wheelRow}>
      <Picker
        selectedValue={h}
        style={styles.wheel}
        itemStyle={{ color: colors.text, fontSize: 18 }}
        onValueChange={hr => onChange(`${pad(hr)}:${pad(m || 0)}`)}
      >
        {HOURS.map(hr => (
          <Picker.Item key={hr} label={pad(hr)} value={hr} />
        ))}
      </Picker>
      <Text style={[styles.wheelColon, { color: colors.text }]}>:</Text>
      <Picker
        selectedValue={MINUTES.includes(m) ? m : 0}
        style={styles.wheel}
        itemStyle={{ color: colors.text, fontSize: 18 }}
        onValueChange={min => onChange(`${pad(h || 0)}:${pad(min)}`)}
      >
        {MINUTES.map(min => (
          <Picker.Item key={min} label={pad(min)} value={min} />
        ))}
      </Picker>
    </View>
  )
}

export default function TodoEditor({
  visible,
  editing,
  defaultDate,
  defaultCalendarId,
  calendars,
  categories,
  onClose,
  onSave,
  onDelete,
  onCreateCategory,
}: Props) {
  const { colors } = useTheme()
  const accent = colors.accent
  const insets = useSafeAreaInsets()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [calendarId, setCalendarId] = useState(defaultCalendarId)
  const [showCalendar, setShowCalendar] = useState(false)
  const [date, setDate] = useState(defaultDate)
  const [allDay, setAllDay] = useState(true)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [reminderOn, setReminderOn] = useState(false)

  const [showCategory, setShowCategory] = useState(false)
  const [creatingCat, setCreatingCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [showDate, setShowDate] = useState(false)
  const [openWheel, setOpenWheel] = useState<'start' | 'end' | null>(null)
  const [pickerMonth, setPickerMonth] = useState(() => {
    const d = fromDateKey(defaultDate)
    return { year: d.getFullYear(), monthIndex: d.getMonth() }
  })

  // (Re)initialise fields whenever the sheet opens.
  useEffect(() => {
    if (!visible) return
    if (editing) {
      setTitle(editing.title)
      setNotes(editing.notes ?? '')
      setCategoryId(editing.categoryId || categories[0]?.id || '')
      setCalendarId(editing.calendarId ?? PERSONAL_CALENDAR_ID)
      setDate(editing.date)
      setAllDay(editing.allDay)
      setStartTime(editing.startTime ?? '09:00')
      setEndTime(editing.endTime ?? '10:00')
      setReminderOn(!!editing.reminderAt)
      const d = fromDateKey(editing.date)
      setPickerMonth({ year: d.getFullYear(), monthIndex: d.getMonth() })
    } else {
      setTitle('')
      setNotes('')
      setCategoryId(categories[0]?.id ?? '')
      setCalendarId(defaultCalendarId)
      setDate(defaultDate)
      setAllDay(true)
      setStartTime('09:00')
      setEndTime('10:00')
      setReminderOn(false)
      const d = fromDateKey(defaultDate)
      setPickerMonth({ year: d.getFullYear(), monthIndex: d.getMonth() })
    }
    setShowCategory(false)
    setShowCalendar(false)
    setCreatingCat(false)
    setNewCatName('')
    setShowDate(false)
    setOpenWheel(null)
    // Re-init ONLY when the sheet (re)opens or the target item changes — NOT when
    // `categories` updates, or a background sync refreshing the list would wipe the
    // user's in-progress edit. `categories` is read for the default and is stable
    // by the time the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editing, defaultDate, defaultCalendarId])

  const activeCat = useMemo(
    () => categories.find(c => c.id === categoryId) ?? categories[0],
    [categories, categoryId],
  )
  const activeCal = useMemo(
    () => calendars.find(c => c.id === calendarId) ?? calendars.find(c => c.id === PERSONAL_CALENDAR_ID) ?? calendars[0],
    [calendars, calendarId],
  )
  const canSave = title.trim().length > 0

  const handleAddCategory = () => {
    const name = newCatName.trim()
    if (!name) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const created = onCreateCategory(name)
    setCategoryId(created.id)
    setNewCatName('')
    setCreatingCat(false)
    setShowCategory(false)
  }

  const handleSave = () => {
    if (!canSave) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const reminderAt = reminderOn
      ? combineDateTime(date, allDay ? '09:00' : startTime).toISOString()
      : undefined
    const item: TodoItem = {
      id: editing?.id ?? makeId(),
      title: title.trim(),
      notes: notes.trim() || undefined,
      categoryId: categoryId || categories[0]?.id || '',
      calendarId: activeCal?.id ?? PERSONAL_CALENDAR_ID,
      date,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      completed: editing?.completed ?? false,
      completedAt: editing?.completedAt,
      reminderAt,
      reminderNotificationId: editing?.reminderNotificationId,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onSave(item)
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + SPACING.md }]}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: canSave ? accent : colors.border }]}
            >
              <Text style={[styles.saveText, { color: canSave ? colors.white : colors.textMuted }]}>Save</Text>
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Title */}
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.textMuted}
              style={[styles.titleInput, { color: colors.text }]}
              autoFocus={!editing}
            />

            {/* Calendar (which one this item lives in) */}
            <Pressable
              style={[styles.row, { borderTopColor: colors.border }]}
              onPress={() => setShowCalendar(s => !s)}
            >
              <Feather name="layers" size={18} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{activeCal?.name ?? 'Calendar'}</Text>
              <Text style={styles.calEmoji}>{activeCal?.emoji ?? ''}</Text>
              <Feather name={showCalendar ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showCalendar && (
              <View style={styles.catGrid}>
                {calendars.map(c => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setCalendarId(c.id)
                      setShowCalendar(false)
                    }}
                    style={[
                      styles.catPill,
                      {
                        borderColor: c.id === activeCal?.id ? c.color : colors.border,
                        backgroundColor: c.color + (c.id === activeCal?.id ? '26' : '00'),
                      },
                    ]}
                  >
                    <Text style={styles.calPillEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catPillText, { color: colors.text }]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Category */}
            <Pressable
              style={[styles.row, { borderTopColor: colors.border }]}
              onPress={() => setShowCategory(s => !s)}
            >
              <Feather name="tag" size={18} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{activeCat?.name ?? 'Category'}</Text>
              <View style={[styles.swatch, { backgroundColor: activeCat?.color ?? colors.border }]} />
              <Feather name={showCategory ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showCategory && (
              <View style={styles.catGrid}>
                {categories.map(c => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      Haptics.selectionAsync()
                      setCategoryId(c.id)
                      setShowCategory(false)
                    }}
                    style={[
                      styles.catPill,
                      { borderColor: c.id === categoryId ? c.color : colors.border, backgroundColor: c.color + (c.id === categoryId ? '26' : '00') },
                    ]}
                  >
                    <View style={[styles.dot, { backgroundColor: c.color }]} />
                    <Text style={[styles.catPillText, { color: colors.text }]}>{c.name}</Text>
                  </Pressable>
                ))}

                {/* "+" pill — reveals an inline name field for a brand-new tag. */}
                {!creatingCat && (
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync()
                      setCreatingCat(true)
                    }}
                    style={[styles.catPill, styles.addPill, { borderColor: accent }]}
                    accessibilityLabel="Create a new tag"
                  >
                    <Feather name="plus" size={14} color={accent} />
                    <Text style={[styles.catPillText, { color: accent }]}>New tag</Text>
                  </Pressable>
                )}
              </View>
            )}
            {showCategory && creatingCat && (
              <View style={styles.newCatRow}>
                <TextInput
                  value={newCatName}
                  onChangeText={setNewCatName}
                  placeholder="Tag name"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.newCatInput, { color: colors.text, borderColor: colors.border }]}
                  autoFocus
                  maxLength={24}
                  returnKeyType="done"
                  onSubmitEditing={handleAddCategory}
                />
                <Pressable
                  onPress={handleAddCategory}
                  disabled={!newCatName.trim()}
                  style={[styles.newCatAdd, { backgroundColor: newCatName.trim() ? accent : colors.border }]}
                  accessibilityLabel="Add tag"
                >
                  <Feather name="check" size={18} color={newCatName.trim() ? colors.white : colors.textMuted} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCreatingCat(false)
                    setNewCatName('')
                  }}
                  hitSlop={8}
                  accessibilityLabel="Cancel new tag"
                >
                  <Feather name="x" size={20} color={colors.textMuted} />
                </Pressable>
              </View>
            )}

            {/* All-day */}
            <View style={[styles.row, { borderTopColor: colors.border }]}>
              <Feather name="sun" size={18} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>All-day</Text>
              <Switch
                value={allDay}
                onValueChange={setAllDay}
                trackColor={{ true: accent, false: colors.border }}
              />
            </View>

            {/* Date */}
            <Pressable
              style={[styles.row, { borderTopColor: colors.border }]}
              onPress={() => setShowDate(s => !s)}
            >
              <Feather name="calendar" size={18} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{formatLongDate(date)}</Text>
              <Feather name={showDate ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
            </Pressable>
            {showDate && (
              <View style={styles.datePicker}>
                <View style={styles.monthNav}>
                  <Pressable onPress={() => setPickerMonth(m => addMonths(m.year, m.monthIndex, -1))} hitSlop={8}>
                    <Feather name="chevron-left" size={22} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.monthLabel, { color: colors.text }]}>
                    {formatMonthYear(pickerMonth.year, pickerMonth.monthIndex)}
                  </Text>
                  <Pressable onPress={() => setPickerMonth(m => addMonths(m.year, m.monthIndex, 1))} hitSlop={8}>
                    <Feather name="chevron-right" size={22} color={colors.text} />
                  </Pressable>
                </View>
                <MonthGrid
                  year={pickerMonth.year}
                  monthIndex={pickerMonth.monthIndex}
                  itemsByDate={{}}
                  categoryColor={() => accent}
                  accent={accent}
                  compact
                  selectedKey={date}
                  onSelectDay={k => {
                    setDate(k)
                    setShowDate(false)
                  }}
                />
              </View>
            )}

            {/* Times (only when not all-day) */}
            {!allDay && (
              <>
                <Pressable
                  style={[styles.row, { borderTopColor: colors.border }]}
                  onPress={() => setOpenWheel(w => (w === 'start' ? null : 'start'))}
                >
                  <Feather name="clock" size={18} color={colors.textSecondary} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Starts</Text>
                  <Text style={[styles.timeValue, { color: openWheel === 'start' ? accent : colors.textSecondary }]}>{startTime}</Text>
                </Pressable>
                {openWheel === 'start' && <TimeWheel value={startTime} onChange={setStartTime} />}

                <Pressable
                  style={[styles.row, { borderTopColor: colors.border }]}
                  onPress={() => setOpenWheel(w => (w === 'end' ? null : 'end'))}
                >
                  <Feather name="clock" size={18} color={colors.textSecondary} />
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Ends</Text>
                  <Text style={[styles.timeValue, { color: openWheel === 'end' ? accent : colors.textSecondary }]}>{endTime}</Text>
                </Pressable>
                {openWheel === 'end' && <TimeWheel value={endTime} onChange={setEndTime} />}
              </>
            )}

            {/* Reminder */}
            <View style={[styles.row, { borderTopColor: colors.border }]}>
              <Feather name="bell" size={18} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>Remind me</Text>
              <Switch
                value={reminderOn}
                onValueChange={setReminderOn}
                trackColor={{ true: accent, false: colors.border }}
              />
            </View>

            {/* Notes */}
            <View style={[styles.row, styles.notesRow, { borderTopColor: colors.border }]}>
              <Feather name="align-left" size={18} color={colors.textSecondary} style={{ marginTop: 2 }} />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Notes"
                placeholderTextColor={colors.textMuted}
                multiline
                style={[styles.notesInput, { color: colors.text }]}
              />
            </View>

            {/* Delete (edit mode only) */}
            {editing && (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
                  onDelete(editing.id)
                }}
              >
                <Feather name="trash-2" size={16} color={colors.error} />
                <Text style={[styles.deleteText, { color: colors.error }]}>Delete</Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderCurve: 'continuous',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full, borderCurve: 'continuous' },
  saveText: { fontSize: 15, fontWeight: '700' },
  titleInput: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, paddingVertical: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: TYPOGRAPHY.body.size, fontWeight: '500' },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: SPACING.sm },
  timeValue: { fontSize: TYPOGRAPHY.body.size, fontWeight: '600' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, paddingBottom: SPACING.md },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  catPillText: { fontSize: TYPOGRAPHY.caption.size, fontWeight: '600' },
  calEmoji: { fontSize: 16, marginRight: SPACING.sm },
  calPillEmoji: { fontSize: 13, marginRight: 5 },
  addPill: { gap: 4, borderStyle: 'dashed' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  newCatRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingBottom: SPACING.md },
  newCatInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.body.size,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
  },
  newCatAdd: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePicker: { paddingBottom: SPACING.md },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  monthLabel: { fontSize: TYPOGRAPHY.heading.size, fontWeight: '700' },
  wheelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: SPACING.sm },
  wheel: { width: 90, ...(Platform.OS === 'android' ? { color: undefined } : {}) },
  wheelColon: { fontSize: 20, fontWeight: '700', marginHorizontal: 4 },
  notesRow: { alignItems: 'flex-start' },
  notesInput: { flex: 1, fontSize: TYPOGRAPHY.body.size, minHeight: 44, paddingTop: 0 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: SPACING.lg },
  deleteText: { fontSize: 15, fontWeight: '600' },
})
