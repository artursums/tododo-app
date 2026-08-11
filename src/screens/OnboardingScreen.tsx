import React from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme'

/**
 * Onboarding — M0 shell. The phased swipe flow (welcome → value slides →
 * notifications → theme) is fleshed out later; this is the minimum that lets a
 * first-run user get into the app. `onDone` marks onboarding complete.
 */
export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme()

  const features: { icon: keyof typeof Feather.glyphMap; text: string }[] = [
    { icon: 'users', text: 'One calendar the whole household shares' },
    { icon: 'refresh-cw', text: 'Always in sync on every phone, even offline' },
    { icon: 'bell', text: 'Reminders so nothing slips — events, birthdays, payments' },
  ]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.body}>
        <LinearGradient
          colors={[colors.accent, colors.coral]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mark}
        >
          <Feather name="calendar" size={40} color={colors.white} />
        </LinearGradient>

        <Text style={[styles.title, { color: colors.text }]}>tododo</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
          The shared calendar for families, couples, and you.
        </Text>

        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: colors.accent + '1A' }]}>
                <Feather name={f.icon} size={18} color={colors.accent} />
              </View>
              <Text style={[styles.featureText, { color: colors.text }]}>{f.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
        onPress={onDone}
        accessibilityRole="button"
      >
        <Text style={[styles.ctaText, { color: colors.white }]}>Get started</Text>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: SPACING.xl },
  body: { flex: 1, justifyContent: 'center' },
  mark: {
    width: 88,
    height: 88,
    borderRadius: RADIUS.xl,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: { fontSize: TYPOGRAPHY.title.size, fontWeight: TYPOGRAPHY.title.weight, letterSpacing: -1 },
  tagline: { fontSize: TYPOGRAPHY.body.size, marginTop: SPACING.sm, lineHeight: 24 },
  features: { marginTop: SPACING.xxl, gap: SPACING.lg },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: { flex: 1, fontSize: TYPOGRAPHY.body.size },
  cta: {
    height: 54,
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  ctaText: { fontSize: 17, fontWeight: '600' },
})
