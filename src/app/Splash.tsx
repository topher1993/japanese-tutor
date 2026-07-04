// Phase 42 / P1-1 — Splash screen extracted from App.tsx.
//
// Shown during the brief window between app boot and the async onboarding-
// preference load completing. After Phase 22's P0-01 fix this window is
// much shorter, but we still want a placeholder so the user sees something.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ds } from '../theme/designSystem';

export function Splash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashBrand}>日本語</Text>
      <Text style={styles.splashName}>Tutor</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.colors.background },
  splashBrand: { fontSize: 44, fontWeight: '900', color: ds.colors.brand, marginBottom: ds.spacing.xs },
  splashName: { fontSize: 24, fontWeight: '900', color: ds.colors.text },
});