import React from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ds } from '../theme/designSystem';
import { Icon } from './Icon';
import { AppLogo } from './AppLogo';

// Consistent screen header. Title + optional subtitle + optional right slot.
// Auto-applies top safe-area inset so callers cannot forget.

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  tone?: 'default' | 'brand';
  titleStyle?: TextStyle;
  onBack?: () => void;
  /**
   * When true, render the AppLogo as a small corner mark to the LEFT of
   * the back/title block. Opt-in per screen so we don't crowd screens
   * that already have a hero logo elsewhere. Default false to preserve
   * the existing layout of every screen that uses ScreenHeader today.
   */
  showAppLogo?: boolean;
  /** AppLogo size when showAppLogo is true. Default 36. */
  appLogoSize?: number;
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  tone = 'default',
  titleStyle,
  onBack,
  showAppLogo = false,
  appLogoSize = 36,
}: ScreenHeaderProps) {
  const isBrand = tone === 'brand';
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.shell, { paddingTop: insets.top + ds.spacing.sm }, isBrand && styles.brand]}>
      {onBack ? (
        <Pressable onPress={onBack} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]} hitSlop={10}>
          <Icon name="arrow-left" size={22} style={{ color: isBrand ? ds.colors.brandInk : ds.colors.text }} />
        </Pressable>
      ) : null}
      {showAppLogo ? (
        <View style={styles.logoSlot}>
          <AppLogo size={appLogoSize} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={[styles.title, isBrand && styles.titleBrand, titleStyle]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, isBrand && styles.subtitleBrand]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: ds.spacing.md,
    gap: ds.spacing.sm,
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginRight: 4,
    borderRadius: ds.radius.pill,
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSlot: {
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: ds.type.title, fontWeight: '900', color: ds.colors.text, flexShrink: 1 },
  subtitle: { fontSize: ds.type.body, color: ds.colors.textMuted, marginTop: 2, lineHeight: 22, flexShrink: 1 },
  right: { flexShrink: 0 },
  brand: {},
  titleBrand: { color: ds.colors.brandInk },
  subtitleBrand: { color: ds.colors.brandInk, opacity: 0.85 },
});
