import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  ActivityIndicator,
} from 'react-native'
import { Image } from 'expo-image'
import * as ImagePicker from 'expo-image-picker'
import CalendarArtwork, { ARTWORK_NAMES } from '../components/calendar/CalendarArtwork'
import { calendarPhotoUri, saveCalendarPhoto, removeCalendarPhoto } from '../services/calendarPhotos'
import { TododoIcon } from '../components/TododoIcon'
import * as Haptics from 'expo-haptics'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { useTheme } from '../contexts/ThemeContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useAuth } from '../contexts/AuthContext'
import { useCalendars } from '../contexts/CalendarsContext'
import { isSupabaseConfigured } from '../services/supabase'
import type { RootStackParamList, MainTabParamList } from '../navigation/AppNavigator'
import { SPACING, RADIUS, TYPOGRAPHY, MEMBER_COLORS } from '../constants/theme'
import {
  TodoCalendar,
  CALENDAR_EMOJIS,
  CATEGORY_COLOR_PALETTE,
  PERSONAL_CALENDAR_ID,
  ALL_CALENDARS_ID,
} from '../types/todo'

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Calendars'>,
  NativeStackNavigationProp<RootStackParamList>
>

/** Short color row for the calendar editor (full palette would overflow). */
const CALENDAR_COLORS = CATEGORY_COLOR_PALETTE.slice(0, 8)
const CALENDAR_TEMPLATES = [
  { name: 'Family', emoji: '🏠', color: '#10B981', description: 'Everyday plans for the whole family.' },
  { name: 'Personal', emoji: '🗓️', color: '#6366F1', description: 'A little space for your own schedule.' },
  { name: 'Relationship', emoji: '❤️', color: '#FB7185', description: 'Make time for each other.' },
  { name: 'Work', emoji: '💼', color: '#0EA5E9', description: 'Meetings, deadlines, and the working day.' },
  { name: 'Friends', emoji: '🎉', color: '#A855F7', description: 'Get-togethers and things to look forward to.' },
  { name: 'Shift schedule', emoji: '🕒', color: '#14B8A6', description: 'Keep track of changing working hours.' },
  { name: 'Lessons', emoji: '📚', color: '#0EA5E9', description: 'Classes, practice, and time to learn.' },
  { name: 'School', emoji: '🎒', color: '#F59E0B', description: 'School days and important dates.' },
  { name: 'Hobbies', emoji: '🎨', color: '#A855F7', description: 'More time for the things you enjoy.' },
]

/**
 * Calendar list (cf. TimeTree): every calendar as a row with a colored cover
 * tile, name and member avatars. Tapping a row makes it the active calendar and
 * jumps to the Calendar tab; long-press edits. "Add Calendar" creates a new one.
 * Shared calendars (invite a partner into one) activate once the Supabase
 * backend is wired — the UI states this honestly until then.
 */
export default function CalendarListScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<Nav>()
  const { calendars, activeCalendarId, setActiveCalendarId, createCalendar, updateCalendar, removeCalendar } =
    useCalendars()

  const [editorVisible, setEditorVisible] = useState(false)
  const [editing, setEditing] = useState<TodoCalendar | null>(null)

  const shared = useHousehold()

  // You, as the (for now only) member — one avatar chip per member later.
  const selfInitial = (user?.email?.[0] ?? 'M').toUpperCase()

  const openCalendar = (id: string) => {
    Haptics.selectionAsync()
    setActiveCalendarId(id)
    navigation.navigate('Calendar')
  }

  const openEditor = (cal: TodoCalendar | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (cal?.householdId) { shared.switchHousehold(cal.householdId); navigation.navigate('Household'); return }
    setEditing(cal)
    setEditorVisible(true)
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Calendars</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
        {/* Merged view */}
        <Pressable
          style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel="Open all calendars"
          onPress={() => openCalendar(ALL_CALENDARS_ID)}
        >
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <TododoIcon name="grid" size={24} color={colors.white} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowName, { color: colors.text }]}>All calendars</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Everything in one view</Text>
          </View>
          {activeCalendarId === ALL_CALENDARS_ID ? (
            <TododoIcon name="check" size={20} color={colors.accent} />
          ) : (
            <TododoIcon name="chevron-right" size={20} color={colors.textMuted} />
          )}
        </Pressable>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          Calendars ({calendars.length})
        </Text>

        {calendars.map(cal => {
          const isActive = activeCalendarId === cal.id
          const isPersonal = cal.id === PERSONAL_CALENDAR_ID
          return (
            <View key={cal.id} style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable
              style={({ pressed }) => [styles.calendarBody, pressed && styles.rowPressed]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${cal.name}`}
              accessibilityState={{ selected: isActive }}
              onPress={() => openCalendar(cal.id)}
              onLongPress={() => openEditor(cal)}
              delayLongPress={350}
            >
              <View style={[styles.tile, { backgroundColor: cal.color + '20' }]}>
                <CalendarArtwork coverImage={cal.coverImage} emoji={cal.emoji} />
                {isPersonal && (
                  <View style={[styles.lockBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TododoIcon name="lock" size={10} color={colors.textSecondary} />
                  </View>
                )}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, { color: colors.text }]}>{cal.name}</Text>
                <View style={styles.avatarRow}>
                  <View style={[styles.avatar, { backgroundColor: MEMBER_COLORS[0] }]}>
                    <Text style={styles.avatarText}>{selfInitial}</Text>
                  </View>
                  <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{cal.householdId ? `${shared.allMembers.filter(m => m.householdId === cal.householdId).length} people · Shared` : isPersonal ? 'Private to you' : 'Your calendar'}</Text>
                </View>
              </View>
              {isActive && <TododoIcon name="check" size={18} color={colors.accent} />}
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${cal.name}`} onPress={() => openEditor(cal)} style={styles.editButton}>
                <TododoIcon name="edit-2" size={17} color={colors.textSecondary} />
              </Pressable>
            </View>
          )
        })}

        {/* Add calendar */}
        <Pressable
          style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border }, pressed && styles.rowPressed]}
          accessibilityRole="button"
          accessibilityLabel="Create a calendar"
          onPress={() => openEditor(null)}
        >
          <View style={[styles.tile, styles.addTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TododoIcon name="plus" size={26} color={colors.textSecondary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowName, { color: colors.accent }]}>Create a calendar</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Family, work, hobbies — make it yours.</Text>
          </View>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Household')} style={[styles.row, { backgroundColor: colors.accentLight, borderColor: colors.border }]}><View style={styles.tile}><TododoIcon name="users" size={30} color={colors.accent} /></View><View style={styles.rowBody}><Text style={[styles.rowName, { color: colors.text }]}>Plan with your people</Text><Text style={[styles.rowSub, { color: colors.textSecondary }]}>Create a shared calendar or invite someone.</Text></View><TododoIcon name="chevron-right" size={18} color={colors.accent} /></Pressable>
      </ScrollView>

      <CalendarEditorModal
        visible={editorVisible}
        editing={editing}
        onClose={() => {
          setEditorVisible(false)
          setEditing(null)
        }}
        onCreate={async (name, color, emoji, coverImage) => {
          const cal = await createCalendar(name, color, emoji, coverImage)
          setActiveCalendarId(cal.id)
          navigation.navigate('Calendar')
        }}
        onUpdate={updateCalendar}
        onDelete={removeCalendar}
      />
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------------
// Create / edit sheet
// ---------------------------------------------------------------------------
interface EditorProps {
  visible: boolean
  editing: TodoCalendar | null
  onClose: () => void
  onCreate: (name: string, color: string, emoji: string, coverImage?: string) => Promise<void>
  onUpdate: (cal: TodoCalendar) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export function CalendarEditorModal({ visible, editing, onClose, onCreate, onUpdate, onDelete }: EditorProps) {
  const { colors } = useTheme()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()

  const [choosingType, setChoosingType] = useState(false)
  const [name, setName] = useState('')
  const [photoUri, setPhotoUri] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const [color, setColor] = useState<string>(CALENDAR_COLORS[0])
  const [emoji, setEmoji] = useState<string>(CALENDAR_EMOJIS[0])

  useEffect(() => {
    if (!visible) return
    setChoosingType(!editing)
    setName(editing?.name ?? '')
    setPhotoUri(calendarPhotoUri(editing?.coverImage))
    setSaving(false)
    setPicking(false)
    setColor(editing?.color ?? CALENDAR_COLORS[0])
    setEmoji(editing?.emoji ?? CALENDAR_EMOJIS[0])
  }, [visible, editing])

  const isPersonal = editing?.id === PERSONAL_CALENDAR_ID
  const canSave = name.trim().length > 0 && !saving && !picking

  const close = () => {
    if (saving || picking) return
    const changed = name !== (editing?.name ?? '') || photoUri !== calendarPhotoUri(editing?.coverImage) || color !== (editing?.color ?? CALENDAR_COLORS[0]) || emoji !== (editing?.emoji ?? CALENDAR_EMOJIS[0])
    if (!changed || choosingType) { onClose(); return }
    Alert.alert('Discard changes?', 'Your calendar changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: onClose },
    ])
  }

  const pickPhoto = async () => {
    if (picking || saving) return
    Keyboard.dismiss()
    setPicking(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 0.8 })
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri)
    } catch (error) {
      console.warn('Calendar photo picker failed', error)
      Alert.alert('Could not open photos', 'Please try again. You can also add a photo after creating your calendar.')
    } finally {
      setPicking(false)
    }
  }

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    let copiedPhoto: string | undefined
    try {
      const previousPhoto = editing?.coverImage
      const unchanged = photoUri === calendarPhotoUri(previousPhoto)
      const coverImage = unchanged ? previousPhoto : photoUri ? (copiedPhoto = saveCalendarPhoto(photoUri)) : undefined
      if (editing) await onUpdate({ ...editing, name: name.trim(), color, emoji, coverImage })
      else await onCreate(name.trim(), color, emoji, coverImage)
      if (previousPhoto && previousPhoto !== coverImage) removeCalendarPhoto(previousPhoto)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onClose()
    } catch {
      if (copiedPhoto) removeCalendarPhoto(copiedPhoto)
      Alert.alert('Could not save calendar', 'Your changes are still here. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = () => {
    if (!editing || isPersonal) return
    Alert.alert(
      'Delete calendar?',
      `"${editing.name}" is removed from the list. Its to-dos move under Personal.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            await onDelete(editing.id)
            removeCalendarPhoto(editing.coverImage)
            onClose()
            } catch {
              Alert.alert('Could not delete calendar', 'Please try again.')
            }
          },
        },
      ],
    )
  }

  // Sharing status line — honest about what works today.
  const shareText = isPersonal
    ? 'This calendar is private to you.'
    : !isSupabaseConfigured
      ? 'This calendar is private to you.'
      : !user
        ? 'Sign in to invite someone into this calendar.'
        : 'Create a shared calendar in People to plan together.'

  if (choosingType && visible) return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={[styles.typeOverlay, { backgroundColor: colors.overlay, paddingTop: insets.top + 8 }]}>
        <View style={[styles.typeSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close calendar types" onPress={close} style={styles.editButton}><TododoIcon name="x" size={24} color={colors.textSecondary} /></Pressable>
          <Text accessibilityRole="header" style={[styles.typeTitle, { color: colors.text }]}>What kind of calendar{ '\n' }are you creating?</Text>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {CALENDAR_TEMPLATES.map(template => <Pressable key={template.name} accessibilityRole="button" accessibilityLabel={`Create ${template.name} calendar`} style={({ pressed }) => [styles.templateRow, { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]} onPress={() => {
              setName(template.name); setColor(template.color); setEmoji(template.emoji); setChoosingType(false)
            }}>
              <View style={[styles.templateArt, { backgroundColor: template.color + '25' }]}><CalendarArtwork emoji={template.emoji} size={32} /></View>
              <View style={styles.rowBody}><Text style={[styles.rowName, { color: colors.text }]}>{template.name}</Text><Text style={[styles.rowSub, { color: colors.textSecondary }]}>{template.description}</Text></View>
              <TododoIcon name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>)}
            <Pressable accessibilityRole="button" onPress={() => setChoosingType(false)} style={styles.deleteBtn}><Text style={{ color: colors.accent, fontWeight: '600' }}>Start from scratch</Text></Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.topBar}>
            <Pressable onPress={close} disabled={saving || picking} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close calendar editor">
              <TododoIcon name="x" size={24} color={colors.textSecondary} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editing ? 'Edit calendar' : 'New calendar'}
            </Text>
            <Pressable
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel="Save calendar"
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: canSave ? colors.accent : colors.border }]}
            >
              {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={[styles.saveText, { color: canSave ? colors.onAccent : colors.textMuted }]}>Save</Text>}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Live preview tile + name */}
          <View style={styles.previewRow}>
            <View style={[styles.tile, { backgroundColor: color }]}>
              {photoUri ? <Image source={{ uri: photoUri }} style={[StyleSheet.absoluteFill, { borderRadius: RADIUS.md }]} contentFit="cover" /> : <CalendarArtwork emoji={emoji} />}
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Calendar name"
              accessibilityLabel="Calendar name"
              placeholderTextColor={colors.textMuted}
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
              maxLength={32}
              autoFocus={!editing}
            />
          </View>

          <Pressable accessibilityRole="button" accessibilityLabel={photoUri ? 'Change calendar photo' : 'Add calendar photo'} disabled={saving || picking} onPress={pickPhoto} style={[styles.photoPicker, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            {photoUri ? (
              <>
                <Image source={{ uri: photoUri }} contentFit="cover" style={StyleSheet.absoluteFill} />
                <View style={styles.photoCaption}><TododoIcon name="image" size={16} color="#FFFFFF" /><Text style={styles.photoCaptionText}>Change photo</Text></View>
              </>
            ) : (
              <><TododoIcon name="image" size={24} color={colors.accent} /><Text style={[styles.photoLabel, { color: colors.accent }]}>{picking ? 'Opening photos…' : 'Add a cover photo'}</Text></>
            )}
          </Pressable>
          {photoUri && <Pressable accessibilityRole="button" onPress={() => setPhotoUri(undefined)} disabled={saving || picking} style={styles.removePhoto}><Text style={{ color: colors.textSecondary, fontSize: 12 }}>Remove photo</Text></Pressable>}

          {/* Emoji picks */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Icon</Text>
          <View style={styles.pickRow}>
            {CALENDAR_EMOJIS.map(e => (
              <Pressable
                key={e}
                accessibilityRole="button"
                accessibilityLabel={`${ARTWORK_NAMES[e] ?? 'calendar'} icon`}
                accessibilityState={{ selected: e === emoji }}
                onPress={() => {
                  Haptics.selectionAsync()
                  setEmoji(e)
                }}
                style={[
                  styles.emojiPick,
                  { borderColor: e === emoji ? colors.accent : colors.border },
                  e === emoji && { backgroundColor: colors.accent + '1F' },
                ]}
              >
                <CalendarArtwork emoji={e} size={20} />
              </Pressable>
            ))}
          </View>

          {/* Color picks */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Color</Text>
          <View style={styles.pickRow}>
            {CALENDAR_COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => {
                  Haptics.selectionAsync()
                  setColor(c)
                }}
                style={[styles.colorPick, { backgroundColor: c }, c === color && styles.colorPickOn]}
              >
                {c === color && <TododoIcon name="check" size={16} color="#FFFFFF" />}
              </Pressable>
            ))}
          </View>

          {/* Sharing */}
          <View style={[styles.shareRow, { borderTopColor: colors.border }]}>
            <TododoIcon name={isPersonal ? 'lock' : 'users'} size={18} color={colors.textSecondary} />
            <Text style={[styles.shareText, { color: colors.textSecondary }]}>{shareText}</Text>
            {!isPersonal && isSupabaseConfigured && !user && (
              <Pressable
                onPress={() => {
                  onClose()
                  navigation.navigate('Auth')
                }}
                hitSlop={6}
              >
                <Text style={[styles.shareAction, { color: colors.accent }]}>Sign in</Text>
              </Pressable>
            )}
          </View>

          {editing && !isPersonal && (
            <Pressable disabled={saving || picking} style={styles.deleteBtn} onPress={handleDelete}>
              <TododoIcon name="trash-2" size={16} color={colors.error} />
              <Text style={[styles.deleteText, { color: colors.error }]}>Delete calendar</Text>
            </Pressable>
          )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  typeOverlay: { flex: 1 },
  typeSheet: { flex: 1, paddingHorizontal: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  typeTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', paddingVertical: 24, lineHeight: 30 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12 },
  templateArt: { width: 88, height: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 12 },
  calendarBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60 },
  editButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: TYPOGRAPHY.title.size, fontWeight: TYPOGRAPHY.title.weight, letterSpacing: -0.5 },
  sectionLabel: {
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: '600',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.md,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 0,
    borderRadius: 12,
  },
  rowPressed: { opacity: 0.7 },
  tile: {
    width: 76,
    height: 56,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: { borderWidth: 1.5, borderStyle: 'dashed' },
  tileEmoji: { fontSize: 28 },
  lockBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 4 },
  rowName: { fontSize: TYPOGRAPHY.body.size + 1, fontWeight: '700', letterSpacing: -0.2 },
  rowSub: { fontSize: TYPOGRAPHY.caption.size },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  hint: {
    paddingHorizontal: 28,
    lineHeight: 20,
    fontSize: TYPOGRAPHY.caption.size,
    textAlign: 'center',
    paddingTop: SPACING.lg,
  },
  // --- editor sheet ---
  backdrop: { ...StyleSheet.absoluteFillObject },
  kav: { flex: 1, justifyContent: 'flex-end' },
  photoPicker: { height: 116, borderWidth: 1, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12 },
  photoLabel: { fontSize: 13, fontWeight: '600' },
  photoCaption: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.45)' },
  photoCaptionText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  removePhoto: { alignSelf: 'flex-end', paddingVertical: 8, marginBottom: 8 },
  sheet: {
    maxHeight: '90%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderCurve: 'continuous',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  sheetTitle: { fontSize: TYPOGRAPHY.heading.size, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: RADIUS.full, borderCurve: 'continuous' },
  saveText: { fontSize: 15, fontWeight: '700' },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
  },
  fieldLabel: { fontSize: TYPOGRAPHY.caption.size, fontWeight: '600', marginBottom: SPACING.xs },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  emojiPick: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiPickText: { fontSize: 20 },
  colorPick: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorPickOn: { transform: [{ scale: 1.12 }] },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  shareText: { flex: 1, fontSize: TYPOGRAPHY.caption.size, lineHeight: 17 },
  shareAction: { fontSize: TYPOGRAPHY.caption.size, fontWeight: '700' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
  },
  deleteText: { fontSize: 15, fontWeight: '600' },
})
