import React, { useCallback, useState } from 'react'
import { View, Text, StyleSheet, Switch, Pressable, ScrollView, Alert, Linking, AppState, Modal } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { TododoIcon } from '../components/TododoIcon'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { reminderLabel, REMINDER_OPTIONS } from '../utils/todoEvent'

export default function SettingsScreen() {
  const { colors, isDark, setDarkMode, settings, updateSettings } = useTheme()
  const { user, signOut } = useAuth()
  const navigation = useNavigation<any>()
  const insets = useSafeAreaInsets()
  const [choice, setChoice] = useState<'view' | 'reminder' | null>(null)
  const [permission, setPermission] = useState('Check permissions')
  useFocusEffect(useCallback(() => {
    let alive = true
    const refresh = () => Notifications.getPermissionsAsync().then(p => { if (alive) setPermission(p.granted ? 'Allowed' : 'Not allowed') }).catch(() => { if (alive) setPermission('Open device settings') })
    refresh()
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh() })
    return () => { alive = false; sub.remove() }
  }, []))
  const card = { backgroundColor: colors.card, borderColor: colors.border }
  const row = (icon: string, title: string, detail: string | undefined, onPress: () => void) => <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.accentLight }]}>
    <TododoIcon name={icon} color={colors.accent} size={23} /><Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>{detail && <Text numberOfLines={1} style={[styles.detail, { color: colors.textSecondary }]}>{detail}</Text>}<TododoIcon name="chevron-right" color={colors.textMuted} size={17} />
  </Pressable>
  const section = (title: string) => <Text style={[styles.section, { color: colors.textMuted }]}>{title}</Text>
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Your space<Text style={{ color: colors.accent }}>.</Text></Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>A little more you. A little less busy.</Text>
      <Pressable accessibilityRole="button" onPress={() => user ? Alert.alert('Your account', user.email ?? 'Signed in', [{ text: 'Close', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { signOut().catch(() => Alert.alert('Could not sign out', 'Please try again.')) } }]) : navigation.navigate('Auth')} style={[styles.account, card]}>
        <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}><TododoIcon name="user" size={30} color={colors.accent} /></View>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.accountTitle, { color: colors.text }]}>{user?.user_metadata?.display_name ?? user?.email ?? 'Make yourself at home'}</Text><Text style={[styles.subtitle, { color: colors.textSecondary }]}>{user ? 'Manage your account' : 'Sign in to plan together'}</Text></View><TododoIcon name="chevron-right" size={20} color={colors.textMuted} />
      </Pressable>
      <View style={styles.shortcuts}>
        {[{ icon: 'bookmark', label: 'Memos', action: () => navigation.navigate('Calendar', { view: 'memos', request: Date.now() }) }, { icon: 'layers', label: 'Calendars', action: () => navigation.navigate('Calendars') }, { icon: 'users', label: 'People', action: () => navigation.navigate('Household') }].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={item.action} style={({ pressed }) => [styles.shortcut, card, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}><View style={[styles.shortcutIcon, { backgroundColor: colors.accentLight }]}><TododoIcon name={item.icon} size={30} color={colors.accent} selected /></View><Text style={[styles.shortcutLabel, { color: colors.text }]}>{item.label}</Text></Pressable>)}
      </View>
      {section('PLAN TOGETHER')}
      <View style={[styles.card, card]}>{row('users', 'People & invitations', undefined, () => navigation.navigate('Household'))}{row('link', 'Join a calendar', undefined, () => navigation.navigate('Join'))}</View>
      {section('YOUR CALENDAR')}
      <View style={[styles.card, card]}>
        {row('calendar', 'Default view', settings.defaultView[0].toUpperCase() + settings.defaultView.slice(1), () => setChoice('view'))}
        <View style={styles.row}><TododoIcon name="check" color={colors.accent} size={23} /><Text style={[styles.rowTitle, { color: colors.text }]}>Hide completed plans</Text><Switch accessibilityLabel="Hide completed plans" value={settings.hideCompleted} onValueChange={hideCompleted => updateSettings({ hideCompleted })} trackColor={{ true: colors.accent }} /></View>
      </View>
      {section('NOTIFICATIONS')}
      <View style={[styles.card, card]}>
        {row('bell', 'Default reminder', reminderLabel(settings.defaultReminder), () => setChoice('reminder'))}
        {row('settings', 'Device notifications', permission, () => { Linking.openSettings().catch(() => Alert.alert('Open Settings', 'You can manage notification permissions in your device settings.')) })}
      </View>
      {section('LOOK & FEEL')}
      <View style={[styles.card, card]}><View style={styles.row}><TododoIcon name="moon" color={colors.accent} size={23} /><Text style={[styles.rowTitle, { color: colors.text }]}>Dark mode</Text><Switch accessibilityLabel="Dark mode" value={isDark} onValueChange={setDarkMode} trackColor={{ true: colors.accent }} /></View></View>
      {section('GOOD TO KNOW')}
      <View style={[styles.card, card]}>{row('lock', 'Private & shared calendars', undefined, () => Alert.alert('You choose what to share', 'Your personal calendars stay private. Create a shared calendar in People, then send an invitation. Members can see and edit plans in that shared calendar. An invitation works once and expires after 14 days.'))}{row('bookmark', 'About tododo', undefined, () => Alert.alert('A little room for life.', 'tododo brings plans, little tasks and your people into one calm space. Custom artwork and icons made for tododo.'))}</View>
      <Text style={[styles.version, { color: colors.textMuted }]}>tododo · {Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </ScrollView>
    <Modal visible={choice !== null} transparent animationType="slide" onRequestClose={() => setChoice(null)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close preference options" onPress={() => setChoice(null)} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={{ maxHeight: '90%', backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: insets.bottom + 20 }}>
          <View style={styles.row}><Text style={[styles.accountTitle, { flex: 1, color: colors.text }]}>{choice === 'view' ? 'Default calendar view' : 'Default reminder'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close preference options" onPress={() => setChoice(null)} style={{ padding: 12 }}><TododoIcon name="x" color={colors.textSecondary} size={22} /></Pressable></View>
          <Text style={[styles.subtitle, { color: colors.textSecondary, paddingHorizontal: 15, marginBottom: 12 }]}>{choice === 'view' ? 'The view you open tododo to.' : 'For new plans. Existing reminders stay as you set them.'}</Text>
          <ScrollView style={{ flexGrow: 0 }}>
          {choice === 'view' ? (['month', 'week', 'year'] as const).map(view => <Pressable key={view} accessibilityRole="radio" accessibilityState={{ checked: settings.defaultView === view }} onPress={() => { updateSettings({ defaultView: view }); setChoice(null) }} style={styles.row}><Text style={[styles.rowTitle, { color: colors.text }]}>{view[0].toUpperCase() + view.slice(1)}</Text><TododoIcon name={settings.defaultView === view ? 'check-circle' : 'circle'} color={colors.accent} size={22} /></Pressable>) : REMINDER_OPTIONS.map(option => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ checked: settings.defaultReminder === option.value }} onPress={() => { updateSettings({ defaultReminder: option.value }); setChoice(null) }} style={styles.row}><Text style={[styles.rowTitle, { color: colors.text }]}>{option.label}</Text><TododoIcon name={settings.defaultReminder === option.value ? 'check-circle' : 'circle'} color={colors.accent} size={22} /></Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>
}
const styles = StyleSheet.create({
  container: { flex: 1 }, content: { padding: 20, paddingBottom: 36 }, title: { fontSize: 32, fontWeight: '700', letterSpacing: -1 }, subtitle: { fontSize: 13, lineHeight: 20, marginTop: 3 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: 22, marginTop: 22 }, avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, accountTitle: { fontWeight: '600', fontSize: 15 },
  shortcuts: { flexDirection: 'row', gap: 10, marginTop: 14 }, shortcut: { flex: 1, borderWidth: 1, borderRadius: 20, paddingVertical: 15, alignItems: 'center', gap: 8 }, shortcutIcon: { width: 48, height: 45, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, shortcutLabel: { fontSize: 12, fontWeight: '600' },
  section: { fontSize: 10, letterSpacing: 1.7, fontWeight: '700', marginTop: 26, marginBottom: 9, marginLeft: 4 }, card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' }, row: { flexDirection: 'row', gap: 11, alignItems: 'center', minHeight: 60, paddingHorizontal: 15, paddingVertical: 12 }, rowTitle: { flex: 1, fontSize: 14, fontWeight: '500' }, detail: { fontSize: 11, maxWidth: '33%' }, version: { fontSize: 12, textAlign: 'center', marginTop: 28 },
})
