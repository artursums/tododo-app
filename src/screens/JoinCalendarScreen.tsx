import React, { useEffect, useRef, useState } from 'react'
import { Alert, Pressable, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useRoute } from '@react-navigation/native'
import { TododoIcon } from '../components/TododoIcon'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { inviteToken, sharedRpc } from '../services/sharedCalendars'
import { isSupabaseConfigured } from '../services/supabase'
import { styles } from './HouseholdScreen'

type Preview = { household_name: string; expires_at: string; already_member: boolean }
export default function JoinCalendarScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const shared = useHousehold()
  const nav = useNavigation<any>()
  const route = useRoute<any>()
  const [input, setInput] = useState(route.params?.token ?? '')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useRef(false)
  const generation = useRef(0)
  useEffect(() => { if (route.params?.token) setInput(route.params.token) }, [route.params?.token])
  useEffect(() => { ++generation.current; setPreview(null); setError(null) }, [input, user?.id])
  const inspect = async () => {
    if (guard.current) return
    guard.current = true; setBusy(true); setError(null)
    const request = generation.current
    try {
      const result = await sharedRpc<Preview[]>('preview_invite', { p_token: inviteToken(input) })
      if (request === generation.current) { if (!result[0]) throw new Error('This invitation is no longer available.'); setPreview(result[0]) }
    } catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : 'Could not check this invitation. Try again.') }
    finally { guard.current = false; setBusy(false) }
  }
  const join = async () => {
    if (guard.current || !preview) return
    guard.current = true; setBusy(true)
    try { await shared.acceptInvite(inviteToken(input)); nav.replace('Household') }
    catch (e) { Alert.alert('Could not join', e instanceof Error ? e.message : 'Please try again.'); setPreview(null) }
    finally { guard.current = false; setBusy(false) }
  }
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}><View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => nav.canGoBack() ? nav.goBack() : nav.replace('Main')} style={styles.back}><TododoIcon name="chevron-left" color={colors.text} /></Pressable><Text style={[styles.headerTitle, { color: colors.text }]}>Join a calendar</Text></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.card, { backgroundColor: colors.card }]}><TododoIcon name="link" size={42} color={colors.accent} selected /><Text style={[styles.title, { color: colors.text }]}>You’re invited.</Text><Text style={[styles.description, { color: colors.textSecondary }]}>Paste the link someone sent you. You’ll see the calendar before you join.</Text>
        <TextInput accessibilityLabel="Invitation link or code" value={input} editable={!busy} onChangeText={setInput} placeholder="tododo://join?token=…" autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
        {!isSupabaseConfigured ? <Text style={[styles.description, { color: colors.textSecondary }]}>Joining shared calendars is not available in this build yet. Keep your invitation for when sharing is enabled.</Text> : !user ? <Pressable accessibilityRole="button" style={[styles.button, { backgroundColor: colors.accent }]} onPress={() => nav.navigate('Auth')}><Text style={{ color: colors.onAccent }}>Sign in to continue</Text></Pressable> : <Pressable accessibilityRole="button" disabled={busy || !input.trim()} style={[styles.button, { backgroundColor: colors.accent, opacity: busy || !input.trim() ? 0.5 : 1 }]} onPress={inspect}><Text style={{ color: colors.onAccent }}>{busy ? 'One moment…' : 'View invitation'}</Text></Pressable>}
        {error && <Text accessibilityRole="alert" style={[styles.description, { color: colors.error }]}>{error}</Text>}
      </View>
      {preview && user && <View style={[styles.card, { backgroundColor: colors.accentLight }]}><Text style={[styles.cardTitle, { color: colors.text }]}>{preview.household_name}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>{preview.already_member ? 'You are already a member.' : 'You’ll be able to see and edit plans here. Your private calendars stay private.'}</Text><Text style={[styles.description, { color: colors.textSecondary }]}>Expires {new Date(preview.expires_at).toLocaleDateString()}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={join} style={[styles.button, { backgroundColor: colors.accent }]}><Text style={{ color: colors.onAccent }}>{busy ? 'Joining…' : preview.already_member ? 'Open calendar people' : 'Join this calendar'}</Text></Pressable></View>}
    </ScrollView></KeyboardAvoidingView>
  </SafeAreaView>
}
