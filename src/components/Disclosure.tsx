import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ds } from '../theme/designSystem';
import { Icon, type IconName } from './Icon';

// Progressive-disclosure block. Title is always visible. Body collapses.

export interface DisclosureProps {
  title: string;
  icon?: IconName;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  tone?: 'soft' | 'default';
}

export function Disclosure({ title, icon, open, onToggle, children, tone = 'default' }: DisclosureProps) {
  return (
    <View style={[styles.shell, tone === 'soft' && styles.soft]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View style={styles.headerLeft}>
          {icon ? <Icon name={icon} size={18} /> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.chevron}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: ds.colors.surface,
    borderRadius: ds.radius.lg,
    paddingHorizontal: ds.spacing.md,
    paddingVertical: ds.spacing.md,
    ...ds.shadow.card,
  },
  soft: { backgroundColor: ds.colors.surfaceAlt },
  header: {
    minHeight: ds.touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: ds.spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: ds.spacing.sm, flexShrink: 1 },
  title: { fontSize: ds.type.body, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  chevron: { fontSize: 16, color: ds.colors.textMuted, fontWeight: '900' },
  body: { marginTop: ds.spacing.sm, gap: ds.spacing.sm },
});
