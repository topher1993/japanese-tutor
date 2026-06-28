import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { getPolishedDesignTokens } from '../services/uxPolishService';

const tokens = getPolishedDesignTokens();

export function PolishedCard({ title, subtitle, children, accent, style }: { title?: string; subtitle?: string; children?: React.ReactNode; accent?: 'primary' | 'safety' | 'success'; style?: ViewStyle }) {
  const borderColor = accent ? tokens.colors[accent] : tokens.colors.border;
  return (
    <View style={[styles.card, { borderColor }, style]}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderRadius: tokens.radius.lg,
    padding: 18,
    marginBottom: 14,
    minWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  title: { color: tokens.colors.text, fontSize: 20, lineHeight: 25, fontWeight: '900', flexShrink: 1 },
  subtitle: { color: tokens.colors.muted, fontSize: 14, marginTop: 4, lineHeight: 20, flexShrink: 1 },
});
