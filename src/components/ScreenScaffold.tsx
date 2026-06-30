import React from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { ds } from '../theme/designSystem';

// Consistent screen wrapper.
// - Background is TRANSPARENT so the App shell shows through (no seam).
// - Adds `gap: ds.spacing.md` between children so cards/buttons breathe.
// - Adds outer horizontal/vertical padding so content sits in the safe area.

export interface ScreenScaffoldProps {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  padded?: boolean;
}

export function ScreenScaffold({ children, scroll = true, contentStyle, padded = true }: ScreenScaffoldProps) {
  const containerStyle = [
    styles.content,
    padded && styles.padded,
    { gap: ds.spacing.md },
    contentStyle,
  ];
  if (!scroll) {
    return (
      <View style={[styles.shell, padded && styles.padded, { gap: ds.spacing.md }, contentStyle]}>{children}</View>
    );
  }
  return (
    <ScrollView
      style={styles.shell}
      contentContainerStyle={containerStyle}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: 'transparent' },
  content: { flexGrow: 1 },
  padded: { paddingHorizontal: ds.spacing.md, paddingTop: ds.spacing.md, paddingBottom: ds.spacing.xxl * 3 },
});