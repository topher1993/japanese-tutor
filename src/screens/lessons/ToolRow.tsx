// Phase 43 — ToolRow extracted from LessonsScreen.tsx
//
// Renders a single row inside the "More tools" Disclosure with an icon,
// label, and hint text. Pressable surface with subtle pressed-state opacity.
// Owns its own styles because no other component uses these specific keys
// (toolRow*).
//
// Phase 43: No state, no hooks, no behavior change. Pure prop-driven
// presentation component.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ds } from '../../theme/designSystem';
import { Icon, type IconName } from '../../components/Icon';

export function ToolRow({ icon, label, hint, onPress }: { icon: IconName; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.toolRow, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={styles.toolIcon}>
        <Icon name={icon} size={20} />
      </View>
      <View style={styles.toolText}>
        <Text style={styles.toolLabel}>{label}</Text>
        <Text style={styles.toolHint}>{label === 'Kanji section' ? hint : hint}</Text>
      </View>
      <Icon name="arrow-right" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toolRow: {
    flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm,
    backgroundColor: ds.colors.surface, padding: ds.spacing.sm,
    borderRadius: ds.radius.md, minHeight: ds.touch.min,
  },
  toolIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: ds.colors.brandSoft, alignItems: 'center', justifyContent: 'center',
  },
  toolText: { flex: 1, minWidth: 0 },
  toolLabel: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  toolHint: { fontSize: ds.type.caption, color: ds.colors.textMuted, flexShrink: 1 },
});