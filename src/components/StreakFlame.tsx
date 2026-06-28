import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ds } from '../theme/designSystem';

// Streak "flame" — the hero element of the Progress screen.
// Vertical layout: flame on top-left, number + label inline, sub message below.

export interface StreakFlameProps {
  days: number;
}

export function StreakFlame({ days }: StreakFlameProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.ring}>
        <Text style={styles.flame}>🔥</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.number}>{days}</Text>
          <Text style={styles.label}>day streak</Text>
        </View>
        <Text style={styles.sub}>Keep going — a little each day adds up.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ds.colors.warmSoft,
    borderRadius: ds.radius.xl,
    paddingVertical: ds.spacing.md,
    paddingHorizontal: ds.spacing.md,
    gap: ds.spacing.md,
    ...ds.shadow.card,
  },
  ring: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: ds.colors.warm,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  flame: { fontSize: 28 },
  body: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: ds.spacing.sm },
  number: { fontSize: 26, fontWeight: '900', color: '#B45309', lineHeight: 30, flexShrink: 0 },
  label: { fontSize: ds.type.caption, fontWeight: '900', color: '#92400E', textTransform: 'uppercase', flexShrink: 1 },
  sub: { fontSize: ds.type.caption, color: '#92400E', marginTop: 2, flexShrink: 1, lineHeight: 18 },
});