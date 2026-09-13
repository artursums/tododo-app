import React, { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { TododoIcon } from '../../components/TododoIcon'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../contexts/ThemeContext'
import { TodoCategory } from '../../types/todo'

interface Props {
  categories: TodoCategory[]
  /** Empty selection shows every topic. */
  active: Set<string>
  onToggle: (id: string) => void
  onClear: () => void
}

export default function CategoryFilterChips({ categories, active, onToggle, onClear }: Props) {
  const { colors } = useTheme()
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? categories : categories.slice(0, 3)
  const hiddenSelected = categories.slice(3).filter(category => active.has(category.id)).length

  const chips = (
    <View style={[styles.chips, expanded && styles.wrapped]}>
      {shown.map(cat => {
        const selected = active.has(cat.id)
        return (
          <Pressable
            key={cat.id}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${cat.name}`}
            accessibilityState={{ selected }}
            onPress={() => { Haptics.selectionAsync(); onToggle(cat.id) }}
            style={[styles.chip, !expanded && styles.collapsedChip, { backgroundColor: selected ? cat.color + '20' : colors.card, borderColor: selected ? cat.color : colors.border }]}
          >
            <View style={[styles.dot, { backgroundColor: cat.color }]} />
            <Text numberOfLines={1} style={[styles.label, { color: selected ? colors.text : colors.textSecondary }]}>{cat.name}</Text>
            {selected && <TododoIcon name="check" size={11} color={colors.textSecondary} />}
          </Pressable>
        )
      })}
    </View>
  )

  if (categories.length === 0) return null

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        {expanded ? <ScrollView style={styles.expandedList} nestedScrollEnabled showsVerticalScrollIndicator>{chips}</ScrollView> : <View style={styles.list}>{chips}</View>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse topic filters' : `Expand topic filters${hiddenSelected > 0 ? `, ${hiddenSelected} hidden selected` : ''}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(value => !value)}
          style={[styles.expand, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          {!expanded && hiddenSelected > 0 && <Text style={[styles.hiddenCount, { color: colors.accent }]}>{hiddenSelected}</Text>}
          <TododoIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      {expanded && active.size > 0 && (
        <Pressable accessibilityRole="button" onPress={onClear} style={styles.clear}>
          <Text style={[styles.clearText, { color: colors.accent }]}>Clear selection</Text>
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: 20, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  list: { flex: 1 },
  expandedList: { flex: 1, maxHeight: 150 },
  chips: { flexDirection: 'row', gap: 6 },
  wrapped: { flexWrap: 'wrap', paddingBottom: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 10, borderWidth: 1, maxWidth: '100%' },
  collapsedChip: { flexShrink: 1, minWidth: 0 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '600', flexShrink: 1 },
  expand: { minWidth: 36, minHeight: 34, paddingHorizontal: 6, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  hiddenCount: { fontSize: 10, fontWeight: '700' },
  clear: { alignSelf: 'flex-start', paddingVertical: 8 },
  clearText: { fontSize: 12, fontWeight: '600' },
})
