import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { TododoIcon } from '../components/TododoIcon'
import { useTheme } from '../contexts/ThemeContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { useCalendars } from '../contexts/CalendarsContext'
import { useAuth } from '../contexts/AuthContext'
import { isSupabaseConfigured } from '../services/supabase'
import { invitationUrl } from '../services/sharedCalendars'

export default function HouseholdScreen() {
  const { colors } = useTheme()
  const { user } = useAuth()
  const shared = useHousehold()
  const { setActiveCalendarId } = useCalendars()
  const nav = useNavigation<any>()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const guard = useRef(false)
  const [invitation, setInvitation] = useState<{ householdId: string; token: string; expires_at: string } | null>(null)
  useEffect(() => { setInvitation(null) }, [user?.id])
  const active = shared.activeHousehold
  const canInvite = shared.role === 'owner' || shared.role === 'admin'
  const run = async (action: () => Promise<void>) => {
    if (guard.current) return
    guard.current = true; setBusy(true)
    try { await action() } catch (error) { Alert.alert('Could not complete that', error instanceof Error ? error.message : 'Check your connection and try again.') }
    finally { guard.current = false; setBusy(false) }
  }
  const button = (label: string, action: () => void, secondary = false) => <Pressable accessibilityRole="button" disabled={busy} onPress={action} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.accentLight : colors.accent, opacity: busy || pressed ? 0.65 : 1 }]}><Text style={{ color: secondary ? colors.accent : colors.onAccent, fontSize: 14, fontWeight: '600' }}>{label}</Text></Pressable>
  return <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => nav.goBack()} style={styles.back}><TododoIcon name="chevron-left" color={colors.text} /></Pressable><Text style={[styles.headerTitle, { color: colors.text }]}>People & invitations</Text><Pressable accessibilityRole="button" accessibilityLabel="Refresh shared calendars" onPress={() => shared.refresh()} style={styles.back}><TododoIcon name="refresh-cw" color={colors.accent} /></Pressable></View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={[styles.hero, { backgroundColor: colors.accentLight }]}><Image source={require('../../assets/illustrations/together.png')} contentFit="cover" style={styles.heroImage} /><View style={styles.heroCopy}><Text style={[styles.title, { color: colors.text }]}>Life fits better{ '\n' }together.</Text><Text style={[styles.description, { color: colors.textSecondary }]}>A shared space for your people and your plans.</Text></View></View>
      {!isSupabaseConfigured ? <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.cardTitle, { color: colors.text }]}>Your people, soon in one place</Text><Text style={[styles.description, { color: colors.textSecondary }]}>Sharing is not available in this build yet. Your private calendars work as usual.</Text></View> : !user ? <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.cardTitle, { color: colors.text }]}>Start with your account</Text><Text style={[styles.description, { color: colors.textSecondary }]}>Sign in to create a shared calendar or accept an invitation. Your private plans stay private.</Text>{button('Sign in or create an account', () => nav.navigate('Auth'))}</View> : <>
        {shared.isLoading && <ActivityIndicator color={colors.accent} />}
        {shared.error && <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={{ color: colors.error }}>{shared.error}</Text>{button('Try again', () => shared.refresh(), true)}</View>}
        {shared.households.length > 0 && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{shared.households.map(h => <Pressable key={h.id} accessibilityRole="tab" accessibilityState={{ selected: h.id === active?.id }} onPress={() => { shared.switchHousehold(h.id); setInvitation(null) }} style={[styles.chip, { backgroundColor: h.id === active?.id ? colors.accentLight : colors.card }]}><Text style={{ color: h.id === active?.id ? colors.accent : colors.text }}>{h.name}</Text></Pressable>)}</ScrollView>}
        {active && <>
          <View style={[styles.card, { backgroundColor: colors.card }]}><View style={styles.row}><Text style={[styles.cardTitle, { color: colors.text, flex: 1 }]}>{active.name}</Text><Text style={{ color: colors.textMuted, fontSize: 12 }}>{shared.members.length} {shared.members.length === 1 ? 'person' : 'people'}</Text></View>
            {shared.members.map(member => <View key={member.userId} style={styles.member}><View style={[styles.avatar, { backgroundColor: member.color + '22' }]}><TododoIcon name="user" size={22} color={member.color} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '600' }}>{member.displayName ?? (member.userId === user.id ? 'You' : 'Calendar member')}{member.displayName && member.userId === user.id ? ' (you)' : ''}</Text><Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{member.role[0].toUpperCase() + member.role.slice(1)}</Text></View>{member.userId !== user.id && member.role !== 'owner' && (shared.role === 'owner' || (shared.role === 'admin' && member.role === 'member')) && <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={`Remove ${member.displayName ?? 'member'}`} style={styles.back} onPress={() => Alert.alert('Remove this person?', 'They will lose access to this shared calendar.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => run(() => shared.removeMember(active.id, member.userId)) }])}><TododoIcon name="minus" color={colors.error} size={20} /></Pressable>}</View>)}
            {button('Open shared calendar', () => { const cal = shared.calendars.find(c => c.householdId === active.id); if (cal) { setActiveCalendarId(cal.id); nav.navigate('Main', { screen: 'Calendar' }) } }, true)}
            {canInvite && button('Invite someone', () => run(async () => { const link = await shared.createInvite(active.id); setInvitation({ ...link, householdId: active.id }) }))}
            {!canInvite && <Text style={[styles.description, { color: colors.textSecondary }]}>The owner or an admin can invite more people.</Text>}
          </View>
          {invitation?.householdId === active.id && <View style={[styles.card, { backgroundColor: colors.accentLight }]}><Text style={[styles.cardTitle, { color: colors.text }]}>An invitation for your person</Text><Text style={[styles.description, { color: colors.textSecondary }]}>They can see and edit plans in {active.name}. One person can use this link, until {new Date(invitation.expires_at).toLocaleDateString()}.</Text><Text selectable style={[styles.link, { color: colors.accent }]}>{invitationUrl(invitation.token)}</Text>{button('Share invitation', () => run(async () => { await Share.share({ message: `Join ${active.name} on tododo. Open this link with tododo installed, or paste it in Settings → Join a calendar.\n${invitationUrl(invitation.token)}` }, { subject: `Join ${active.name} on tododo` }) }))}<Text style={[styles.description, { color: colors.textSecondary }]}>Choose Messages, Mail or another app in the share menu. You can also select and copy the link above.</Text></View>}
          {canInvite && shared.invites.some(i => i.householdId === active.id) && <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.cardTitle, { color: colors.text }]}>Invitations</Text>{shared.invites.filter(i => i.householdId === active.id).map(inv => { const pending = !inv.revokedAt && !inv.acceptedBy && new Date(inv.expiresAt) > new Date(); return <View key={inv.id} style={styles.member}><TododoIcon name="link" color={colors.accent} size={22} /><View style={{ flex: 1 }}><Text style={{ color: colors.text }}>{inv.revokedAt ? 'Revoked' : inv.acceptedBy ? 'Accepted' : pending ? 'Waiting to be accepted' : 'Expired'}</Text><Text style={{ color: colors.textMuted, fontSize: 12 }}>Expires {new Date(inv.expiresAt).toLocaleDateString()}</Text></View>{pending && <Pressable disabled={busy} accessibilityRole="button" onPress={() => Alert.alert('Revoke invitation?', 'This link will stop working.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Revoke', style: 'destructive', onPress: () => run(async () => { await shared.revokeInvite(inv.id); setInvitation(null) }) }])} style={styles.back}><Text style={{ color: colors.error, fontSize: 12 }}>Revoke</Text></Pressable>}</View> })}</View>}
          {shared.role !== 'owner' && button('Leave this calendar', () => Alert.alert('Leave calendar?', 'You will need a new invitation to return.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => run(() => shared.leaveHousehold(active.id)) }]), true)}
        </>}
        <View style={[styles.card, { backgroundColor: colors.card }]}><Text style={[styles.cardTitle, { color: colors.text }]}>Create a shared calendar</Text><Text style={[styles.description, { color: colors.textSecondary }]}>Start a new space for family, friends or your team. Choose who joins with an invitation.</Text><TextInput accessibilityLabel="Shared calendar name" value={name} onChangeText={setName} maxLength={48} placeholder="Our little world" placeholderTextColor={colors.textMuted} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />{button('Create shared calendar', () => { if (!name.trim()) { Alert.alert('Give it a name', 'Enter a name for your shared calendar.'); return }; run(async () => { await shared.createHousehold(name); setName(''); setInvitation(null) }) })}</View>
      </>}
      {button('I have an invitation', () => nav.navigate('Join'), true)}
    </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}
export const styles = StyleSheet.create({
  container: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 6 }, back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, fontSize: 19, fontWeight: '600', letterSpacing: -0.5 }, content: { padding: 20, gap: 16, paddingBottom: 40 },
  hero: { borderRadius: 24, overflow: 'hidden' }, heroImage: { width: '100%', aspectRatio: 1.65 }, heroCopy: { padding: 20 }, title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.8 }, description: { fontSize: 13, lineHeight: 20, marginTop: 6 }, card: { borderRadius: 22, padding: 18, gap: 8 }, cardTitle: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 }, button: { minHeight: 48, borderRadius: 15, padding: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, input: { minHeight: 50, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10, fontSize: 15 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, member: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10 }, avatar: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 16 }, link: { fontSize: 12, lineHeight: 20, paddingVertical: 12 },
})
