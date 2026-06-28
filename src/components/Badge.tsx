import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ds } from '../theme/designSystem';

// Tiny status/level badge. Caps font at micro size.

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warm' | 'danger' | 'info';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const t = TONES[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const TONES = {
  neutral: { bg: ds.colors.surfaceAlt, fg: ds.colors.textMuted },
  brand:   { bg: ds.colors.brandSoft,  fg: ds.colors.brandDark },
  success: { bg: ds.colors.successSoft, fg: '#166534' },
  warm:    { bg: ds.colors.warmSoft,   fg: '#92400E' },
  danger:  { bg: ds.colors.dangerSoft, fg: '#991B1B' },
  info:    { bg: ds.colors.infoSoft,   fg: '#5B21B6' },
} as const;

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: ds.radius.sm,
    alignSelf: 'flex-start',
  },
  text: { fontSize: ds.type.micro, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
});
