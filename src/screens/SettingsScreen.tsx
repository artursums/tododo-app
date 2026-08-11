import React from 'react'
import { View, Text, StyleSheet, Switch, Pressable, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import Constants from 'expo-constants'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { SPACING, RADIUS, TYPOGRAPHY } from '../constants/theme'

export default function SettingsScreen() {
  const { colors, isDark, setDarkMode } = useTheme()
  const { user, signOut } = useAuth()
  const navigation = useNavigation<any>()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <Text style={[styles.section, { color: colors.textMuted }]}>ACCOUNT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {user ? (
            <>
              <View style={styles.row}>
                <Feather name="user" size={20} color={colors.textSecondary} />
                <Text style={[styles.rowText, { color: colors.text }]} numberOfLines={1}>
                  {user.email ?? 'Signed in'}
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Pressable style={styles.row} onPress={signOut}>
                <Feather name="log-out" size={20} color={colors.error} />
                <Text style={[styles.rowText, { color: colors.error }]}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={styles.row} onPress={() => navigation.navigate('Auth')}>
              <Feather name="log-in" size={20} color={colors.accent} />
              <Text style={[styles.rowText, { color: colors.accent }]}>Sign in or create an account</Text>
            </Pressable>
          )}
        </View>

        {/* Appearance */}
        <Text style={[styles.section, { color: colors.textMuted }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <Feather name="moon" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowText, { color: colors.text }]}>Dark mode</Text>
            <Switch
              value={isDark}
              onValueChange={setDarkMode}
              trackColor={{ true: colors.accent }}
              style={styles.switch}
            />
          </View>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>
          tododo v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: TYPOGRAPHY.title.size, fontWeight: TYPOGRAPHY.title.weight, letterSpacing: -0.5 },
  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl },
  section: {
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  card: {
    borderRadius: RADIUS.md,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  rowText: { flex: 1, fontSize: TYPOGRAPHY.body.size },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACING.md + 20 + SPACING.md },
  switch: { transform: [{ scale: 0.9 }] },
  version: { fontSize: TYPOGRAPHY.caption.size, textAlign: 'center', marginTop: SPACING.xl },
})
