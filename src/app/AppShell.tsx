// Phase 42 / P1-1 — App shell layout extracted from App.tsx.
//
// Provides the outer chrome every screen renders inside:
// - SafeAreaProvider from react-native-safe-area-context
// - StatusBar config
// - SafeAreaView with the platform-correct edges
// - Tablet/foldable width cap (480px) when applicable
//
// The component is intentionally dumb: it owns layout, not state. State and
// modal-screen visibility live in useAppNavigation.ts.

import React from 'react';
import { StatusBar, useWindowDimensions, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native';

import { ds } from '../theme/designSystem';
import { appSafeAreaEdges, createAppShellPadding } from '../services/appSafeAreaLayoutService';

export function AppShell({
  children,
  maxWidth,
}: {
  children: React.ReactNode;
  maxWidth?: number;
}) {
  // Phase 22 audit fix P1-05: only cap width on tablet/foldable breakpoints.
  // On phones (the actual target device), use full width.
  const { width: windowWidth } = useWindowDimensions();
  const isTabletOrFoldable = windowWidth >= 600;
  const shellMaxWidth = maxWidth ?? (isTabletOrFoldable ? 480 : undefined);

  const containerStyle = shellMaxWidth
    ? [styles.app, styles.safeAreaPadding, { maxWidth: shellMaxWidth, alignSelf: 'center' as const }]
    : [styles.app, styles.safeAreaPadding];

  return (
    <SafeAreaProvider>
      <View style={containerStyle}>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView edges={appSafeAreaEdges} style={styles.fill}>
          {children}
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: ds.colors.background },
  fill: { flex: 1, backgroundColor: ds.colors.background },
  safeAreaPadding: createAppShellPadding(),
});