import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, Switch, ScrollView,
  KeyboardAvoidingView, Platform, Keyboard, Alert, ActivityIndicator, Linking,
} from 'react-native'
import { TododoIcon } from '../../components/TododoIcon'
import { Picker } from '@react-native-picker/picker'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../contexts/ThemeContext'
import { TodoItem, TodoCategory, TodoCalendar, makeId, PERSONAL_CALENDAR_ID } from '../../types/todo'
import { formatMonthYear, addMonths, fromDateKey, combineDateTime, toDateKey } from '../../utils/calendarDates'
import { eventTimeError, formatEventDate, normalizedEventUrl, reminderLabel, reminderMinutes, REMINDER_OPTIONS } from '../../utils/todoEvent'
import MonthGrid from './MonthGrid'
import CalendarArtwork from './CalendarArtwork'
import EditorChoiceSheet from './EditorChoiceSheet'

interface Props {
  visible: boolean
  editing: TodoItem | null
  defaultDate: string
  defaultCalendarId: string
  defaultIsMemo?: boolean
  calendars: TodoCalendar[]
  categories: TodoCategory[]
  onClose: () => void
  onSave: (item: TodoItem) => void | Promise<void>
  onDelete: (id: string) => void | Promise<void>
  onCreateCategory: (name: string) => TodoCategory
}

type Choice = 'Calendar' | 'Topic' | 'Notification' | 'Start date' | 'End date' | 'Start time' | 'End time' | null
type Extra = 'location' | 'url' | 'notes' | 'checklist'
const EXTRAS: { key: Extra; label: string; icon: React.ComponentProps<typeof TododoIcon>['name'] }[] = [
  { key: 'location', label: 'Location', icon: 'map-pin' },
  { key: 'url', label: 'URL', icon: 'link' },
  { key: 'notes', label: 'Note', icon: 'file-text' },
  { key: 'checklist', label: 'To-do list', icon: 'check-square' },
]
const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)
const pad = (n: number) => String(n).padStart(2, '0')
const EMPTY_ITEMS = {}

function initialDraft(editing: TodoItem | null, date: string, calendarId: string, categoryId: string, isMemo: boolean, reminder: number | null = 10) {
  const nextHour = new Date()
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0)
  const start = `${pad(nextHour.getHours())}:00`
  const end = new Date(combineDateTime(date, start).getTime() + 3600000)
  return {
    title: editing?.title ?? '', notes: editing?.notes ?? '', location: editing?.location ?? '', url: editing?.url ?? '',
    checklist: editing?.checklist?.map(task => ({ ...task })) ?? [],
    calendarId: editing?.calendarId ?? calendarId,
    categoryId: editing?.categoryId ?? categoryId,
    date: editing?.date ?? date, endDate: editing?.endDate ?? editing?.date ?? toDateKey(end),
    startTime: editing?.startTime ?? start, endTime: editing?.endTime ?? `${pad(end.getHours())}:00`,
    allDay: editing?.allDay ?? false, isMemo: editing?.isMemo ?? isMemo,
    reminder: editing ? reminderMinutes(editing) : reminder,
  }
}

export default function TodoEditor({ visible, editing, defaultDate, defaultCalendarId, defaultIsMemo = false, calendars, categories, onClose, onSave, onDelete, onCreateCategory }: Props) {
  const { colors, settings } = useTheme()
  const insets = useSafeAreaInsets()
  const [draft, setDraft] = useState(() => initialDraft(editing, defaultDate, defaultCalendarId, categories[0]?.id ?? '', defaultIsMemo, settings?.defaultReminder === undefined ? 10 : settings.defaultReminder))
  const initial = useRef(draft)
  const [choice, setChoice] = useState<Choice>(null)
  const [extras, setExtras] = useState<Extra[]>([])
  const [newTopic, setNewTopic] = useState('')
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerMonth, setPickerMonth] = useState({ year: 2026, monthIndex: 0 })
  const titleRef = useRef<TextInput>(null)
  const editingId = editing?.id

  useEffect(() => {
    if (!visible) return
    const next = initialDraft(editing, defaultDate, defaultCalendarId, categories[0]?.id ?? '', defaultIsMemo, settings?.defaultReminder === undefined ? 10 : settings.defaultReminder)
    initial.current = next
    setDraft(next)
    setChoice(null)
    setExtras(EXTRAS.filter(extra => extra.key === 'checklist' ? next.checklist.length > 0 : !!next[extra.key]).map(extra => extra.key))
    setNewTopic('')
    setError(null)
    setSaving(false)
    busy.current = false
    // A background sync must not overwrite an open draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, editingId])

  const update = <K extends keyof typeof draft>(key: K, value: typeof draft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setError(null)
  }
  const activeCal = calendars.find(c => c.id === draft.calendarId) ?? calendars.find(c => c.id === PERSONAL_CALENDAR_ID) ?? calendars[0]
  const availableCategories = categories.filter(category => !category.id.startsWith('shared:') || (activeCal?.householdId && category.id.startsWith(`shared:${activeCal.householdId}:`)))
  const activeCat = availableCategories.find(c => c.id === draft.categoryId) ?? availableCategories[0]
  const timeError = draft.isMemo ? null : eventTimeError(draft.date, draft.endDate, draft.allDay, draft.startTime, draft.endTime)
  const canSave = !!draft.title.trim() && !timeError && !saving
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial.current)

  const close = () => {
    if (busy.current) return
    if (choice) { setChoice(null); return }
    if (!dirty) { onClose(); return }
    Keyboard.dismiss()
    Alert.alert('Discard changes?', 'Your changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ])
  }

  const openChoice = (next: Choice) => {
    Keyboard.dismiss()
    if (next === 'Start date' || next === 'End date') {
      const date = fromDateKey(next === 'Start date' ? draft.date : draft.endDate)
      setPickerMonth({ year: date.getFullYear(), monthIndex: date.getMonth() })
    }
    setChoice(next)
  }

  const save = async () => {
    if (!canSave || busy.current) return
    if (!calendars.some(calendar => calendar.id === draft.calendarId)) { setError('This calendar is no longer available. Choose a calendar before saving.'); return }
    let url: string | undefined
    try { url = normalizedEventUrl(draft.url) } catch { setError('Enter a valid website address, such as https://example.com.'); return }
    busy.current = true
    setSaving(true)
    Keyboard.dismiss()
    const now = new Date().toISOString()
    const reminderAt = !draft.isMemo && draft.reminder !== null
      ? new Date(combineDateTime(draft.date, draft.allDay ? '09:00' : draft.startTime).getTime() - draft.reminder * 60000).toISOString()
      : undefined
    try {
      await onSave({
        ...editing,
        id: editing?.id ?? makeId(), title: draft.title.trim(), notes: draft.notes.trim() || undefined,
        location: draft.location.trim() || undefined, url,
        checklist: draft.checklist.filter(task => task.title.trim()).map(task => ({ ...task, title: task.title.trim() })),
        categoryId: activeCat?.id ?? '', calendarId: activeCal?.id ?? PERSONAL_CALENDAR_ID,
        date: draft.date, endDate: draft.endDate, allDay: draft.allDay, isMemo: draft.isMemo,
        startTime: draft.allDay ? undefined : draft.startTime, endTime: draft.allDay ? undefined : draft.endTime,
        completed: editing?.completed ?? false, reminderAt: activeCal?.householdId ? undefined : reminderAt,
        createdAt: editing?.createdAt ?? now, updatedAt: now,
      })
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    } catch {
      setError('Could not save. Your changes are still here. Please try again.')
    } finally { busy.current = false; setSaving(false) }
  }

  const remove = () => {
    if (!editing || busy.current) return
    Alert.alert(draft.isMemo ? 'Delete memo?' : 'Delete plan?', `“${editing.title}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        busy.current = true; setSaving(true)
        try { await onDelete(editing.id) } catch { setError('Could not delete. Please try again.') }
        finally { busy.current = false; setSaving(false) }
      } },
    ])
  }

  const selectDate = (date: string) => {
    if (choice === 'Start date') {
      setDraft(current => ({ ...current, date, endDate: current.endDate < date ? date : current.endDate }))
    } else update('endDate', date)
    setChoice(null)
  }

  const addTopic = () => {
    if (!newTopic.trim()) return
    const category = onCreateCategory(newTopic.trim())
    update('categoryId', category.id)
    setNewTopic(''); setChoice(null)
  }

  const row = [styles.row, { borderBottomColor: colors.borderLight }]
  const label = [styles.label, { color: colors.text }]
  const selectedTime = choice === 'End time' ? draft.endTime : draft.startTime
  const [hour, minute] = selectedTime.split(':').map(Number)
  const setTime = (value: string) => update(choice === 'End time' ? 'endTime' : 'startTime', value)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} onShow={() => { if (!editing) titleRef.current?.focus() }}>
      <View style={[styles.modal, { backgroundColor: colors.overlay, paddingTop: insets.top + 8 }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' && !choice ? 'padding' : undefined} style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View accessibilityElementsHidden={!!choice} importantForAccessibility={choice ? 'no-hide-descendants' : 'auto'} style={styles.main}>
            <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Close plan editor" onPress={close} style={styles.iconButton} disabled={saving}>
                <TododoIcon name="x" size={23} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.heading, { color: colors.textSecondary }]}>{editing ? 'Edit' : 'New'} {draft.isMemo ? 'memo' : 'plan'}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Save plan" accessibilityState={{ disabled: !canSave }} disabled={!canSave} onPress={save} style={styles.save}>
                {saving ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.saveText, { color: canSave ? colors.accent : colors.textMuted }]}>Save</Text>}
              </Pressable>
            </View>
            <ScrollView style={styles.main} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
              <TextInput ref={titleRef} value={draft.title} onChangeText={value => update('title', value)} placeholder="Title" accessibilityLabel="Plan title"
                placeholderTextColor={colors.textMuted} style={[styles.titleInput, { color: colors.text }]} multiline maxLength={240} editable={!saving} />
              <Pressable accessibilityRole="button" accessibilityLabel="Choose plan calendar" onPress={() => openChoice('Calendar')} style={row}>
                <TododoIcon name="calendar" size={18} color={colors.accent} /><Text numberOfLines={2} style={label}>{activeCal?.name ?? 'Calendar'}</Text>
                <View style={[styles.cover, { backgroundColor: (activeCal?.color ?? colors.accent) + '22' }]}><CalendarArtwork coverImage={activeCal?.coverImage} emoji={activeCal?.emoji ?? '🗓️'} size={20} radius={7} /></View>
                <TododoIcon name="chevron-right" size={17} color={colors.textMuted} />
              </Pressable>
              {!draft.isMemo && <>
                <View style={row}>
                  <TododoIcon name="clock" size={18} color={colors.accent} /><Text style={label}>All-day</Text>
                  <Switch accessibilityLabel="All-day" value={draft.allDay} onValueChange={value => { update('allDay', value); if (draft.reminder !== null) update('reminder', value ? 1440 : 10) }} trackColor={{ true: colors.accent, false: colors.border }} />
                </View>
                {(['Starts', 'Ends'] as const).map((name, index) => <View key={name} style={[styles.dateRow, row]}>
                  <Text style={label}>{name}</Text>
                  <View style={styles.dateValues}>
                    <Pressable accessibilityRole="button" accessibilityLabel={index ? 'End date' : 'Start date'} onPress={() => openChoice(index ? 'End date' : 'Start date')} style={[styles.valuePill, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.value, { color: colors.text }]}>{formatEventDate(index ? draft.endDate : draft.date)}</Text>
                    </Pressable>
                    {!draft.allDay && <Pressable accessibilityRole="button" accessibilityLabel={index ? 'End time' : 'Start time'} onPress={() => openChoice(index ? 'End time' : 'Start time')} style={[styles.valuePill, { backgroundColor: colors.bg }]}>
                      <Text style={[styles.value, { color: colors.text }]}>{index ? draft.endTime : draft.startTime}</Text>
                    </Pressable>}
                  </View>
                </View>)}
              </>}
              <View style={row}>
                <TododoIcon name="bookmark" size={18} color={colors.accent} /><Text style={label}>Save as memo</Text>
                <Switch accessibilityLabel="Save as memo" value={draft.isMemo} onValueChange={value => update('isMemo', value)} trackColor={{ true: colors.accent, false: colors.border }} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose plan topic" onPress={() => openChoice('Topic')} style={row}>
                <TododoIcon name="tag" size={18} color={colors.accent} /><Text style={label}>{activeCat?.name ?? 'Topic'}</Text>
                <View style={[styles.swatch, { backgroundColor: activeCat?.color ?? colors.accent }]} /><TododoIcon name="chevron-right" size={17} color={colors.textMuted} />
              </Pressable>
              {!draft.isMemo && !activeCal?.householdId && <Pressable accessibilityRole="button" accessibilityLabel="Choose notification" onPress={() => openChoice('Notification')} style={row}>
                <TododoIcon name="bell" size={18} color={colors.accent} /><Text style={label}>{reminderLabel(draft.reminder)}</Text><TododoIcon name="chevron-right" size={17} color={colors.textMuted} />
              </Pressable>}
              {activeCal?.householdId && <Text style={[styles.hint, { color: colors.textMuted }]}>Everyone in this calendar can edit this plan. Shared-plan reminders aren’t available yet.</Text>}
              {!draft.isMemo && !activeCal?.householdId && draft.allDay && draft.reminder !== null && <Text style={[styles.hint, { color: colors.textMuted }]}>All-day reminders use 09:00.</Text>}
              {EXTRAS.filter(extra => extras.includes(extra.key)).map(extra => <View key={extra.key} style={[styles.extraField, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.extraHeader}>
                  <TododoIcon name={extra.icon} size={18} color={colors.accent} /><Text style={label}>{extra.label}</Text>
                  {extra.key === 'url' && draft.url.trim() ? <Pressable accessibilityRole="button" accessibilityLabel="Open website" style={styles.iconButton} onPress={async () => {
                    try { const url = normalizedEventUrl(draft.url); if (url) await Linking.openURL(url) } catch { setError('Could not open this website. Check the address and try again.') }
                  }}><TododoIcon name="external-link" size={18} color={colors.accent} /></Pressable> : null}
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${extra.label}`} style={styles.iconButton} onPress={() => {
                    setExtras(current => current.filter(key => key !== extra.key))
                    if (extra.key === 'checklist') update('checklist', [])
                    else update(extra.key, '')
                  }}><TododoIcon name="x" size={17} color={colors.textMuted} /></Pressable>
                </View>
                {extra.key === 'checklist' ? <>
                  {draft.checklist.map((task, index) => <View key={task.id} style={styles.taskRow}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.completed }} accessibilityLabel={`Complete checklist item ${index + 1}`} style={styles.iconButton} onPress={() => update('checklist', draft.checklist.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t))}>
                      <TododoIcon name={task.completed ? 'check-square' : 'square'} size={20} color={colors.accent} />
                    </Pressable>
                    <TextInput accessibilityLabel={`Checklist item ${index + 1}`} placeholder="To-do" placeholderTextColor={colors.textMuted} value={task.title} style={[styles.detailInput, { color: colors.text }]} onChangeText={title => update('checklist', draft.checklist.map(t => t.id === task.id ? { ...t, title } : t))} />
                    <Pressable accessibilityRole="button" accessibilityLabel={`Remove checklist item ${index + 1}`} style={styles.iconButton} onPress={() => update('checklist', draft.checklist.filter(t => t.id !== task.id))}><TododoIcon name="minus" size={17} color={colors.textMuted} /></Pressable>
                  </View>)}
                  <Pressable accessibilityRole="button" onPress={() => update('checklist', [...draft.checklist, { id: makeId(), title: '', completed: false }])} style={styles.addTask}><Text style={{ color: colors.accent }}>+ Add to-do</Text></Pressable>
                </> : <TextInput value={draft[extra.key]} onChangeText={value => update(extra.key as 'notes' | 'location' | 'url', value)} accessibilityLabel={extra.label} placeholder={extra.key === 'url' ? 'https://example.com' : extra.key === 'location' ? 'Place or address' : 'Add a note'} placeholderTextColor={colors.textMuted}
                  multiline={extra.key !== 'url'} autoCapitalize={extra.key === 'url' ? 'none' : 'sentences'} keyboardType={extra.key === 'url' ? 'url' : 'default'} style={[styles.detailInput, styles.detailBody, { color: colors.text }]} />}
              </View>)}
              <View style={styles.extras}>
                {EXTRAS.filter(extra => !extras.includes(extra.key)).map(extra => <Pressable key={extra.key} accessibilityRole="button" accessibilityLabel={`Add ${extra.label}`} onPress={() => setExtras(current => [...current, extra.key])} style={[styles.extraPill, { backgroundColor: colors.bg }]}>
                  <TododoIcon name={extra.icon} size={14} color={colors.accent} /><Text style={[styles.extraText, { color: colors.textSecondary }]}>{extra.label}</Text><TododoIcon name="plus" size={12} color={colors.textMuted} />
                </Pressable>)}
              </View>
              {(error || timeError) ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.error }]}>{error ?? timeError}</Text> : null}
              {editing && <Pressable accessibilityRole="button" accessibilityLabel="Delete plan" onPress={remove} disabled={saving} style={styles.deleteButton}><TododoIcon name="trash-2" size={17} color={colors.error} /><Text style={{ color: colors.error }}>Delete {draft.isMemo ? 'memo' : 'plan'}</Text></Pressable>}
            </ScrollView>
          </View>
          {choice && <EditorChoiceSheet title={choice} onClose={() => setChoice(null)}>
            {choice === 'Calendar' && calendars.map(cal => <Pressable key={cal.id} accessibilityRole="radio" accessibilityState={{ checked: activeCal?.id === cal.id }} accessibilityLabel={cal.name} onPress={() => { update('calendarId', cal.id); setChoice(null) }} style={[styles.choiceRow, { backgroundColor: activeCal?.id === cal.id ? colors.accentLight : 'transparent' }]}>
              <View style={[styles.choiceCover, { backgroundColor: cal.color + '22' }]}><CalendarArtwork coverImage={cal.coverImage} emoji={cal.emoji} size={30} radius={10} /></View><Text style={label}>{cal.name}</Text><TododoIcon name={activeCal?.id === cal.id ? 'check-circle' : 'circle'} size={20} color={activeCal?.id === cal.id ? colors.accent : colors.textMuted} />
            </Pressable>)}
            {choice === 'Topic' && <>
              {availableCategories.map(category => <Pressable key={category.id} accessibilityRole="radio" accessibilityLabel={category.name} accessibilityState={{ checked: activeCat?.id === category.id }} onPress={() => { update('categoryId', category.id); setChoice(null) }} style={styles.choiceRow}>
                <View style={[styles.topicBar, { backgroundColor: category.color }]} /><Text style={label}>{category.name}</Text><TododoIcon name={activeCat?.id === category.id ? 'check-circle' : 'circle'} size={20} color={activeCat?.id === category.id ? colors.accent : colors.textMuted} />
              </Pressable>)}
              <View style={styles.taskRow}><TextInput accessibilityLabel="New topic name" placeholder="New topic" placeholderTextColor={colors.textMuted} maxLength={24} value={newTopic} onChangeText={setNewTopic} style={[styles.detailInput, { color: colors.text }]} onSubmitEditing={addTopic} /><Pressable accessibilityRole="button" accessibilityLabel="Add topic" disabled={!newTopic.trim()} onPress={addTopic} style={styles.iconButton}><TododoIcon name="plus" size={22} color={colors.accent} /></Pressable></View>
            </>}
            {choice === 'Notification' && REMINDER_OPTIONS.map(option => <Pressable key={option.label} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: draft.reminder === option.value }} onPress={() => { update('reminder', option.value); setChoice(null) }} style={styles.choiceRow}>
              <Text style={label}>{option.label}</Text><TododoIcon name={draft.reminder === option.value ? 'check-circle' : 'circle'} size={20} color={draft.reminder === option.value ? colors.accent : colors.textMuted} />
            </Pressable>)}
            {(choice === 'Start date' || choice === 'End date') && <>
              <View style={styles.monthNav}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous picker month" onPress={() => setPickerMonth(month => addMonths(month.year, month.monthIndex, -1))} style={styles.iconButton}><TododoIcon name="chevron-left" size={22} color={colors.text} /></Pressable>
                <Text style={[styles.heading, { color: colors.text }]}>{formatMonthYear(pickerMonth.year, pickerMonth.monthIndex)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Next picker month" onPress={() => setPickerMonth(month => addMonths(month.year, month.monthIndex, 1))} style={styles.iconButton}><TododoIcon name="chevron-right" size={22} color={colors.text} /></Pressable>
              </View>
              <MonthGrid year={pickerMonth.year} monthIndex={pickerMonth.monthIndex} compact itemsByDate={EMPTY_ITEMS} categoryColor={() => colors.accent} accent={colors.accent} selectedKey={choice === 'End date' ? draft.endDate : draft.date} onSelectDay={selectDate} />
            </>}
            {(choice === 'Start time' || choice === 'End time') && <View style={styles.wheels}>
              <Picker accessibilityLabel="Hours" selectedValue={hour} style={[styles.wheel, { color: colors.text }]} itemStyle={{ color: colors.text, fontSize: 22 }} onValueChange={h => setTime(`${pad(h)}:${pad(minute)}`)}>{HOURS.map(h => <Picker.Item key={h} label={pad(h)} value={h} />)}</Picker>
              <Text style={[styles.heading, { color: colors.text }]}>:</Text>
              <Picker accessibilityLabel="Minutes" selectedValue={minute} style={[styles.wheel, { color: colors.text }]} itemStyle={{ color: colors.text, fontSize: 22 }} onValueChange={m => setTime(`${pad(hour)}:${pad(m)}`)}>{MINUTES.map(m => <Picker.Item key={m} label={pad(m)} value={m} />)}</Picker>
            </View>}
          </EditorChoiceSheet>}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  modal: { flex: 1 }, sheet: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' }, main: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 15, fontWeight: '600' }, save: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, saveText: { fontSize: 16, fontWeight: '700' },
  content: { paddingHorizontal: 20 }, titleInput: { fontSize: 25, fontWeight: '600', minHeight: 86, paddingVertical: 24, textAlignVertical: 'top' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  label: { flex: 1, fontSize: 15, flexShrink: 1 }, cover: { width: 34, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  dateRow: { paddingLeft: 30 }, dateValues: { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 6, maxWidth: '78%' },
  valuePill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 8 }, value: { fontSize: 13, fontWeight: '500' }, swatch: { width: 9, height: 22, borderRadius: 3 },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 20, paddingLeft: 26 }, extraPill: { minHeight: 36, paddingHorizontal: 12, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6 }, extraText: { fontSize: 12, fontWeight: '500' },
  extraField: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10 }, extraHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  detailInput: { flex: 1, fontSize: 15, minHeight: 44, paddingVertical: 8 }, detailBody: { marginLeft: 30 }, taskRow: { flexDirection: 'row', alignItems: 'center' }, addTask: { minHeight: 44, justifyContent: 'center', paddingLeft: 30 },
  hint: { fontSize: 12, marginLeft: 30, marginTop: 8 }, error: { fontSize: 14, lineHeight: 20, paddingVertical: 12 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52, marginTop: 12 },
  choiceRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 14, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  choiceCover: { width: 64, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, topicBar: { width: 5, height: 25, borderRadius: 3 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wheels: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, wheel: { width: 120 },
})
