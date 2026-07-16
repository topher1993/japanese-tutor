import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { ds } from '../theme/designSystem';

// One card component, three tones. Cards are the atom of content.
// They should feel "lifted", not bordered.

export interface CardProps {
  children: React.ReactNode;
  tone?: 'default' | 'soft' | 'brand' | 'warm' | 'danger' | 'info' | 'success';
  onPress?: () => void;
  style?: ViewStyle;
  padded?: boolean;
  shadow?: 'card' | 'hero' | 'none';
}

export function Card({ children, tone = 'default', onPress, style, padded = true, shadow = 'card' }: CardProps) {
  const toneStyle = TONES[tone];
  const shadowStyle = shadow === 'hero' ? ds.shadow.hero : shadow === 'none' ? null : ds.shadow.card;
  const content = (
    <View style={[styles.base, toneStyle, padded && styles.padded, shadowStyle, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function CardSubtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

const TONES = {
  default: { backgroundColor: ds.colors.surface, borderColor: 'transparent' },
  soft:    { backgroundColor: ds.colors.surfaceAlt, borderColor: 'transparent' },
  brand:   { backgroundColor: ds.colors.brand, borderColor: 'transparent' },
  warm:    { backgroundColor: ds.colors.warmSoft, borderColor: 'transparent' },
  danger:  { backgroundColor: ds.colors.dangerSoft, borderColor: 'transparent' },
  info:    { backgroundColor: ds.colors.surfaceAlt, borderColor: ds.colors.primary },
  success: { backgroundColor: ds.colors.successSoft ?? ds.colors.surfaceAlt, borderColor: ds.colors.success },
} as const;

const styles = StyleSheet.create({
  base: {
    borderRadius: ds.radius.lg,
    borderWidth: 0,
  },
  padded: { padding: ds.spacing.md },
  title: { fontSize: ds.type.heading, lineHeight: 24, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  subtitle: { fontSize: ds.type.body, lineHeight: 22, color: ds.colors.textMuted, marginTop: 4, flexShrink: 1 },
});
