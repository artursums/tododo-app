import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth, appleAuthAvailable } from '../contexts/AuthContext'
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme'

/**
 * Auth — lean M0 version (email + Apple/Google). The polished photo-hero styling
 * comes later; this is enough to create/sign into an account once a Supabase
 * project is wired. Reached as a modal from Settings.
 */
export default function AuthScreen() {
  const { colors } = useTheme()
  const navigation = useNavigation()
  const { configured, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple } = useAuth()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState<string | null>(null)

  const done = () => {
    if (navigation.canGoBack()) navigation.goBack()
  }

  const submit = async () => {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { error, needsConfirmation } = await signUpWithEmail(email, password)
        if (error) return setError(error)
        if (needsConfirmation) return setInfo('Check your email to confirm your account.')
        return done()
      }
      const { error } = await signInWithEmail(email, password)
      if (error) return setError(error)
      done()
    } finally {
      setBusy(false)
    }
  }

  const withBusy = (fn: () => Promise<{ error: string | null }>) => async () => {
    setError(null)
    setBusy(true)
    try {
      const { error } = await fn()
      if (error) setError(error)
      else done()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <Pressable style={styles.close} onPress={done} accessibilityLabel="Close">
        <Text style={[styles.closeText, { color: colors.textSecondary }]}>Close</Text>
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]}>
          {mode === 'signin' ? 'Welcome back' : 'Create your account'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {mode === 'signin' ? 'Sign in to your shared calendar.' : 'Start your shared calendar.'}
        </Text>

        {!configured && (
          <View style={[styles.notice, { backgroundColor: colors.accent + '14' }]}>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              Accounts aren&apos;t connected yet. Add your tododo Supabase project to <Text style={{ fontWeight: '600' }}>.env</Text> to enable sign-in.
            </Text>
          </View>
        )}

        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
        {info && <Text style={[styles.info, { color: colors.accent }]}>{info}</Text>}

        <Pressable
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.accent, opacity: pressed || busy ? 0.85 : 1 }]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.primaryText, { color: colors.white }]}>
              {mode === 'signin' ? 'Sign in' : 'Sign up'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={withBusy(signInWithGoogle)}
          disabled={busy}
          style={({ pressed }) => [styles.provider, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.providerText, { color: colors.text }]}>Continue with Google</Text>
        </Pressable>

        {appleAuthAvailable && Platform.OS === 'ios' && (
          <Pressable
            onPress={withBusy(signInWithApple)}
            disabled={busy}
            style={({ pressed }) => [styles.provider, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.providerText, { color: colors.text }]}>Continue with Apple</Text>
          </Pressable>
        )}

        <Pressable onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')} style={styles.toggle}>
          <Text style={[styles.toggleText, { color: colors.textSecondary }]}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={{ color: colors.accent, fontWeight: '600' }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.xl },
  close: { paddingVertical: SPACING.md, alignSelf: 'flex-start' },
  closeText: { fontSize: TYPOGRAPHY.body.size },
  body: { flex: 1, justifyContent: 'center' },
  title: { fontSize: TYPOGRAPHY.title.size, fontWeight: TYPOGRAPHY.title.weight, letterSpacing: -0.5 },
  subtitle: { fontSize: TYPOGRAPHY.body.size, marginTop: SPACING.xs, marginBottom: SPACING.xl },
  notice: { padding: SPACING.md, borderRadius: RADIUS.md, borderCurve: 'continuous', marginBottom: SPACING.md },
  noticeText: { fontSize: TYPOGRAPHY.caption.size, lineHeight: 18 },
  input: {
    height: 52,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.body.size,
    marginBottom: SPACING.sm,
  },
  error: { fontSize: TYPOGRAPHY.caption.size, marginTop: SPACING.xs, marginBottom: SPACING.xs },
  info: { fontSize: TYPOGRAPHY.caption.size, marginTop: SPACING.xs, marginBottom: SPACING.xs },
  primary: {
    height: 52,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  primaryText: { fontSize: 17, fontWeight: '600' },
  provider: {
    height: 52,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  providerText: { fontSize: TYPOGRAPHY.body.size, fontWeight: '500' },
  toggle: { marginTop: SPACING.lg, alignItems: 'center' },
  toggleText: { fontSize: TYPOGRAPHY.body.size },
})
