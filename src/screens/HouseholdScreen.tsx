import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { useHousehold } from '../contexts/HouseholdContext'
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme'

/**
 * Household tab — M0 placeholder. In M1 this becomes create/join household,
 * invite link, member list with colors, and role management.
 */
export default function HouseholdScreen() {
  const { colors } = useTheme()
  const { activeHousehold } = useHousehold()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Household</Text>
      </View>
      <View style={styles.empty}>
        <View style={[styles.icon, { backgroundColor: colors.coral + '1F' }]}>
          <Feather name="users" size={28} color={colors.coral} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {activeHousehold ? activeHousehold.name : 'No household yet'}
        </Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          Create a household and invite your family or partner with a link. Members, colors and roles
          arrive in milestone M1.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: TYPOGRAPHY.title.size, fontWeight: TYPOGRAPHY.title.weight, letterSpacing: -0.5 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  icon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: TYPOGRAPHY.heading.size, fontWeight: '600' },
  emptyText: { fontSize: TYPOGRAPHY.body.size, textAlign: 'center', lineHeight: 22 },
})
