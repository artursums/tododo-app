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
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { CompositeNavigationProp } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'

import { useTheme } from '../contexts/ThemeContext'
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
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const { calendars, activeCalendarId, setActiveCalendarId, createCalendar, updateCalendar, removeCalendar } =
    useCalendars()

  const [editorVisible, setEditorVisible] = useState(false)
  const [editing, setEditing] = useState<TodoCalendar | null>(null)

  // You, as the (for now only) member — one avatar chip per member later.
  const selfInitial = (user?.email?.[0] ?? 'M').toUpperCase()

  const openCalendar = (id: string) => {
    Haptics.selectionAsync()
    setActiveCalendarId(id)
    navigation.navigate('Calendar')
  }

  const openEditor = (cal: TodoCalendar | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setEditing(cal)
    setEditorVisible(true)
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Calendars</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: SPACING.xxl }}>
        {/* Merged view */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => openCalendar(ALL_CALENDARS_ID)}
        >
          <View style={[styles.tile, { backgroundColor: colors.accent }]}>
            <Feather name="grid" size={24} color={colors.white} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowName, { color: colors.text }]}>All calendars</Text>
            <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Everything in one view</Text>
          </View>
          {activeCalendarId === ALL_CALENDARS_ID ? (
            <Feather name="check" size={20} color={colors.accent} />
          ) : (
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          )}
        </Pressable>

        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
          Calendars ({calendars.length})
        </Text>

        {calendars.map(cal => {
          const isActive = activeCalendarId === cal.id
          const isPersonal = cal.id === PERSONAL_CALENDAR_ID
          return (
            <Pressable
              key={cal.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => openCalendar(cal.id)}
              onLongPress={() => openEditor(cal)}
              delayLongPress={350}
            >
              <View style={[styles.tile, { backgroundColor: cal.color }]}>
                <Text style={styles.tileEmoji}>{cal.emoji}</Text>
                {isPersonal && (
                  <View style={[styles.lockBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Feather name="lock" size={10} color={colors.textSecondary} />
                  </View>
                )}
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowName, { color: colors.text }]}>{cal.name}</Text>
                <View style={styles.avatarRow}>
                  <View style={[styles.avatar, { backgroundColor: MEMBER_COLORS[0] }]}>
                    <Text style={styles.avatarText}>{selfInitial}</Text>
                  </View>
                  {isPersonal && (
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]}>Private to you</Text>
                  )}
                </View>
              </View>
              {isActive ? (
                <Feather name="check" size={20} color={colors.accent} />
              ) : (
                <Feather name="chevron-right" size={20} color={colors.textMuted} />
              )}
            </Pressable>
          )
        })}

        {/* Add calendar */}
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => openEditor(null)}
        >
          <View style={[styles.tile, styles.addTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="plus" size={26} color={colors.textSecondary} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.rowName, { color: colors.textSecondary }]}>Add Calendar</Text>
          </View>
        </Pressable>

        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Tap a calendar to open it · long-press to edit
        </Text>
      </ScrollView>

      <CalendarEditorModal
        visible={editorVisible}
        editing={editing}
        onClose={() => {
          setEditorVisible(false)
          setEditing(null)
        }}
        onCreate={(name, color, emoji) => {
          const cal = createCalendar(name, color, emoji)
          setActiveCalendarId(cal.id)
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
  onCreate: (name: string, color: string, emoji: string) => void
  onUpdate: (cal: TodoCalendar) => void
  onDelete: (id: string) => void
}

function CalendarEditorModal({ visible, editing, onClose, onCreate, onUpdate, onDelete }: EditorProps) {
  const { colors } = useTheme()
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(CALENDAR_COLORS[0])
  const [emoji, setEmoji] = useState<string>(CALENDAR_EMOJIS[0])

  useEffect(() => {
    if (!visible) return
    setName(editing?.name ?? '')
    setColor(editing?.color ?? CALENDAR_COLORS[0])
    setEmoji(editing?.emoji ?? CALENDAR_EMOJIS[0])
  }, [visible, editing])

  const isPersonal = editing?.id === PERSONAL_CALENDAR_ID
  const canSave = name.trim().length > 0

  const handleSave = () => {
    if (!canSave) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (editing) onUpdate({ ...editing, name: name.trim(), color, emoji })
    else onCreate(name.trim(), color, emoji)
    onClose()
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
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            onDelete(editing.id)
            onClose()
          },
        },
      ],
    )
  }

  // Sharing status line — honest about what works today.
  const shareText = isPersonal
    ? 'This calendar is private to you.'
    : !isSupabaseConfigured
      ? 'Sharing needs the cloud backend — connect Supabase (.env) first.'
      : !user
        ? 'Sign in to invite someone into this calendar.'
        : 'Invite links arrive with the next milestone (shared-calendar backend).'

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.topBar}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={24} color={colors.textSecondary} />
            </Pressable>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editing ? 'Edit calendar' : 'New calendar'}
            </Text>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={[styles.saveBtn, { backgroundColor: canSave ? colors.accent : colors.border }]}
            >
              <Text style={[styles.saveText, { color: canSave ? colors.white : colors.textMuted }]}>Save</Text>
            </Pressable>
          </View>

          {/* Live preview tile + name */}
          <View style={styles.previewRow}>
            <View style={[styles.tile, { backgroundColor: color }]}>
              <Text style={styles.tileEmoji}>{emoji}</Text>
            </View>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Calendar name"
              placeholderTextColor={colors.textMuted}
              style={[styles.nameInput, { color: colors.text, borderColor: colors.border }]}
              maxLength={32}
              autoFocus={!editing}
            />
          </View>

          {/* Emoji picks */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Icon</Text>
          <View style={styles.pickRow}>
            {CALENDAR_EMOJIS.map(e => (
              <Pressable
                key={e}
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
                <Text style={styles.emojiPickText}>{e}</Text>
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
                {c === color && <Feather name="check" size={16} color="#FFFFFF" />}
              </Pressable>
            ))}
          </View>

          {/* Sharing */}
          <View style={[styles.shareRow, { borderTopColor: colors.border }]}>
            <Feather name={isPersonal ? 'lock' : 'users'} size={18} color={colors.textSecondary} />
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
            <Pressable style={styles.deleteBtn} onPress={handleDelete}>
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={[styles.deleteText, { color: colors.error }]}>Delete calendar</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  rowPressed: { opacity: 0.7 },
  tile: {
    width: 60,
    height: 60,
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
    fontSize: TYPOGRAPHY.caption.size,
    textAlign: 'center',
    paddingTop: SPACING.lg,
  },
  // --- editor sheet ---
  backdrop: { ...StyleSheet.absoluteFillObject },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
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
