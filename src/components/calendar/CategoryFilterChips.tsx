import React from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { SPACING, RADIUS, TYPOGRAPHY } from '../../constants/theme'
import { TodoCategory } from '../../types/todo'

interface Props {
  categories: TodoCategory[]
  /** Set of active category ids. Empty set = show all. */
  active: Set<string>
  onToggle: (id: string) => void
}

/**
 * Horizontal row of toggleable category pills (cf. the "Work" / "Family" chips in
 * the TimeTree reference). A checked pill tints itself with the category color.
 * No selection = everything visible.
 */
export default function CategoryFilterChips({ categories, active, onToggle }: Props) {
  const { colors } = useTheme()

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.row}
    >
      {categories.map(cat => {
        const on = active.has(cat.id)
        return (
          <Pressable
            key={cat.id}
            onPress={() => {
              Haptics.selectionAsync()
              onToggle(cat.id)
            }}
            style={[
              styles.chip,
              { backgroundColor: on ? cat.color + '26' : colors.card, borderColor: on ? cat.color : colors.border },
            ]}
          >
            <View style={[styles.dot, { backgroundColor: cat.color }]} />
            <Text
              style={[styles.label, { color: on ? colors.text : colors.textSecondary }]}
              numberOfLines={1}
            >
              {cat.name}
            </Text>
            {on && <Feather name="check" size={13} color={cat.color} style={{ marginLeft: 4 }} />}
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  // A horizontal ScrollView in a flex column expands to fill the available height
  // unless constrained, which left the bar far too tall (huge gaps above/below the
  // chips). flexGrow:0 + a fixed height pin the bar so it hugs the pills, identical
  // in every view.
  bar: { flexGrow: 0, height: 44 },
  // alignItems:'center' keeps the pills at their natural height (centered) rather
  // than stretching to the bar height — so they read the same size everywhere.
  row: { alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderCurve: 'continuous',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  label: {
    fontSize: TYPOGRAPHY.caption.size,
    fontWeight: '600',
    maxWidth: 120,
    // An explicit lineHeight (with headroom over the 13px glyph) is required here:
    // includeFontPadding:false collapses the line box to the bare glyph bounds, which
    // clipped the bottom of the words. lineHeight restores that vertical space; the
    // small upward translateY then lifts the glyph (which otherwise sits low on its
    // baseline) so it reads centred in the chip — safe now that the lineHeight gives
    // top headroom, so nothing clips.
    lineHeight: 18,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: -2 }],
  },
})
