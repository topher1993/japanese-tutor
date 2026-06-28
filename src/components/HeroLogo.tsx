/**
 * HeroLogo — large centered logo + optional subtitle, used at the top of
 * welcoming screens (Home, Profile, Onboarding completion, etc.).
 *
 * Renders the AppLogo at a generous size with an optional helper line
 * underneath (e.g. the learner's name, a phase label, "Welcome back").
 */
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { AppLogo } from './AppLogo';
import { ds } from '../theme/designSystem';

export interface HeroLogoProps {
  /** Width of the logo in points. Height scales to keep 1:1 aspect. Default 140. */
  size?: number;
  /** Optional line below the logo — name, welcome, etc. */
  subtitle?: string;
  /** Container style override (e.g. background, padding). */
  style?: ViewStyle;
  /** Color tone for the subtitle text. */
  tone?: 'default' | 'brand' | 'muted';
}

export function HeroLogo({ size = 140, subtitle, style, tone = 'default' }: HeroLogoProps) {
  const subtitleColor =
    tone === 'brand' ? ds.colors.brandInk :
    tone === 'muted' ? ds.colors.textMuted :
    ds.colors.text;

  return (
    <View style={[styles.shell, style]}>
      <AppLogo size={size} containerStyle={styles.logoContainer} />
      {subtitle ? (
        <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    gap: ds.spacing.sm,
    paddingVertical: ds.spacing.md,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: ds.type.body,
    fontWeight: '700',
    textAlign: 'center',
  },
});