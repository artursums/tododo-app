import React from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { TododoIcon } from '../../components/TododoIcon'
import { useTheme } from '../../contexts/ThemeContext'

interface Props {
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function EditorChoiceSheet({ title, onClose, children }: Props) {
  const { colors } = useTheme()
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFill}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose}
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} />
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={`Done choosing ${title}`} style={styles.close}>
            <TododoIcon name="check" size={21} color={colors.accent} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  sheet: { marginTop: 'auto', maxHeight: '80%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: 24 },
  handle: { width: 32, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 12 },
})
