import React from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TododoIcon } from '../components/TododoIcon'
import { useTheme } from '../contexts/ThemeContext'
import { SHADOWS } from '../constants/theme'

const PREVIEW_PLANS = [
  { icon: 'coffee' as const, title: 'Slow Sunday breakfast', detail: '09:00 · Family', color: '#B66B40' },
  { icon: 'sun' as const, title: 'A little time outside', detail: '11:30 · Personal', color: '#467D68' },
  { icon: 'check' as const, title: 'Pick up the groceries', detail: 'Anytime · Errands', color: '#6256C7' },
]

export default function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme()
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIcon, { backgroundColor: colors.accentLight }]}><TododoIcon name="calendar" size={20} color={colors.accent} /></View>
          <Text style={[styles.brand, { color: colors.text }]}>tododo<Text style={{ color: colors.accent }}>.</Text></Text>
        </View>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>LESS JUGGLING. MORE LIVING.</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Life has a lot{ '\n' }going on.</Text>
        <Text style={[styles.title, { color: colors.accent }]}>Give it a little space.</Text>
        <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your plans, little tasks, and big moments. Happily in one place.</Text>

        <View style={[styles.preview, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel="Example day with three plans">
          <View style={styles.previewHeader}>
            <View>
              <Text style={[styles.previewEyebrow, { color: colors.textSecondary }]}>A LITTLE LOOK AT YOUR DAY</Text>
              <Text style={[styles.previewTitle, { color: colors.text }]}>Sunday, made simple.</Text>
            </View>
            <View style={[styles.dateTile, { backgroundColor: colors.accentLight }]}><TododoIcon name="sun" size={24} color={colors.accent} /></View>
          </View>
          {PREVIEW_PLANS.map(plan => (
            <View key={plan.title} style={[styles.plan, { borderTopColor: colors.borderLight }]}>
              <View style={[styles.planIcon, { backgroundColor: plan.color + '18' }]}><TododoIcon name={plan.icon} size={18} color={plan.color} /></View>
              <View style={styles.planBody}>
                <Text style={[styles.planTitle, { color: colors.text }]}>{plan.title}</Text>
                <Text style={[styles.planDetail, { color: colors.textSecondary }]}>{plan.detail}</Text>
              </View>
              <View style={[styles.check, { borderColor: colors.border }]} />
            </View>
          ))}
          <View style={[styles.previewFooter, { backgroundColor: colors.accentLight }]}>
            <TododoIcon name="layers" size={14} color={colors.accent} />
            <Text style={[styles.previewFooterText, { color: colors.accent }]}>Different calendars. One clear picture.</Text>
          </View>
        </View>
        <View style={styles.benefits}>
          <View style={styles.benefit}><TododoIcon name="filter" size={16} color={colors.accent} /><Text style={[styles.benefitText, { color: colors.textSecondary }]}>Organize by topic</Text></View>
          <View style={styles.benefit}><TododoIcon name="bell" size={16} color={colors.accent} /><Text style={[styles.benefitText, { color: colors.textSecondary }]}>Gentle reminders</Text></View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]} onPress={onDone} accessibilityRole="button">
          <Text style={[styles.ctaText, { color: colors.onAccent }]}>Make room for your day</Text><TododoIcon name="arrow-right" size={20} color={colors.onAccent} />
        </Pressable>
        <Text style={[styles.footnote, { color: colors.textSecondary }]}>Start with your own calendar. No account needed.</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { paddingHorizontal: 28, paddingTop: 12, paddingBottom: 20, flexGrow: 1, justifyContent: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  brandIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 28, fontWeight: '800', letterSpacing: -1 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.7, marginBottom: 12 },
  title: { fontSize: 36, lineHeight: 41, fontWeight: '700', letterSpacing: -1.5 },
  tagline: { fontSize: 16, lineHeight: 24, marginTop: 14, maxWidth: 330 },
  preview: { marginTop: 26, borderWidth: 1, borderRadius: 24, padding: 18, ...SHADOWS.md },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 16 },
  previewEyebrow: { fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  previewTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.5, marginTop: 6 },
  dateTile: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderTopWidth: 1 },
  planIcon: { width: 34, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planBody: { flex: 1 },
  planTitle: { fontSize: 13, fontWeight: '600' },
  planDetail: { fontSize: 11, marginTop: 4 },
  check: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 9 },
  previewFooter: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 10, borderRadius: 10 },
  previewFooterText: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
  benefits: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginTop: 22 },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  benefitText: { fontSize: 12 },
  footer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 12 },
  cta: { minHeight: 56, borderRadius: 18, flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', padding: 14 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  footnote: { fontSize: 11, textAlign: 'center', marginTop: 12 },
})
