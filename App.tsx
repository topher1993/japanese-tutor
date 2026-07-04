import React, { useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { BetaFeedbackScreen } from './src/screens/BetaFeedbackScreen';
import { SourcesScreen } from './src/screens/SourcesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DailyRushScreen } from './src/screens/DailyRushScreen';
import { SenseiReviewScreen } from './src/screens/SenseiReviewScreen';
import { TabBar } from './src/components/TabBar';
import { CompletionToast, LessonErrorToast } from './src/components/CompletionToast';
import { ds } from './src/theme/designSystem';
import type { LearnerLanguage } from './src/types/onboarding';
import { getBottomNavigationTabs } from './src/services/appNavigationService';
import { clearOnboardingPreference } from './src/services/onboardingPreferenceService';

import { AppProviders } from './src/app/AppProviders';
import { AppShell } from './src/app/AppShell';
import { Splash } from './src/app/Splash';
import { renderTab } from './src/app/renderTab';
import {
  loadOnboardingPreference,
  saveOnboardingPreference,
} from './src/app/onboardingStorage';
import { useAppNavigation } from './src/app/useAppNavigation';

/**
 * Phase 43 — App.tsx as a thin orchestrator.
 *
 * Responsibilities owned here (3):
 *   1. Width cap (tablet/foldable) — 480px when ≥600px window width
 *   2. Onboarding preference lifecycle — async load + render-after-ready contract
 *   3. Top-level render tree — composing AppShell + AppProviders + screen
 *
 * Extracted to src/app/*:
 *   - AppProviders        — UserProfileProvider + LearningRepositoryProvider
 *   - AppShell            — SafeAreaProvider + StatusBar + width cap
 *   - Splash              — boot placeholder
 *   - useAppNavigation    — 9 useState calls + URL-param gates
 *   - renderTab           — typed React component for tab routing
 *   - onboardingStorage   — async bootstrap (web localStorage / SQLite KV)
 */
export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const isTabletOrFoldable = windowWidth >= 600;
  const shellMaxWidth = isTabletOrFoldable ? 480 : undefined;

  // Single source of navigation state, owned by useAppNavigation.
  const nav = useAppNavigation();

  // Onboarding preference lifecycle — owned by App.tsx because it bridges
  // the async load + render-after-ready contract.
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [onboarded, setOnboarded] = useState(nav.skipOnboarding);
  const [supportLanguage, setSupportLanguage] = useState<LearnerLanguage>('en');

  useEffect(() => {
    let cancelled = false;
    loadOnboardingPreference(nav.skipOnboarding).then((pref) => {
      if (cancelled) return;
      setOnboarded(nav.skipOnboarding || pref.onboarded);
      setSupportLanguage(pref.language);
      setPreferenceReady(true);
    });
    return () => { cancelled = true; };
  }, [nav.skipOnboarding]);

  if (!preferenceReady) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <Splash />
      </AppShell>
    );
  }

  if (!onboarded) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <OnboardingScreen
            initialStepId={nav.onboardingStep ?? undefined}
            onDone={async (language) => {
              await saveOnboardingPreference({ onboarded: true, language });
              setSupportLanguage(language);
              setOnboarded(true);
            }}
          />
        </AppProviders>
      </AppShell>
    );
  }

  if (nav.showFeedback) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <BetaFeedbackScreen onBack={() => nav.setShowFeedback(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  if (nav.showSources) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <SourcesScreen onBack={() => nav.setShowSources(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  // Phase 22 audit fix P1-06: Settings screen with reset affordance.
  if (nav.showSettings) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <SettingsScreen
            onBack={() => nav.setShowSettings(false)}
            showReviewerTools={nav.reviewerMode}
            onOpenReview={nav.reviewerMode ? () => { nav.setShowSettings(false); nav.setShowReview(true); } : undefined}
            onReset={async () => {
              // Clear onboarding preference via the same storage path the
              // app loads from. This forces a fresh onboarding + fresh
              // screens on the next cold start.
              try {
                await clearOnboardingPreference();
              } catch (err) {
                if (__DEV__) console.warn('[settings] failed to clear onboarding preference', err);
              }
              // Force back to a cold-start state.
              setOnboarded(false);
              setSupportLanguage('en');
              nav.setShowSettings(false);
            }}
          />
        </AppProviders>
      </AppShell>
    );
  }

  // Phase 28 profile editor.
  if (nav.showProfile) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <ProfileScreen onBack={() => nav.setShowProfile(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  if (nav.showDailyRush) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <DailyRushScreen supportLanguage={supportLanguage} onBack={() => nav.setShowDailyRush(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  // Sensei Translation Review — hidden dev tool for native-speaker reviewers.
  if (nav.showReview) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <SenseiReviewScreen onBack={() => nav.setShowReview(false)} />
      </AppShell>
    );
  }

  const bottomTabs = getBottomNavigationTabs();
  return (
    <AppShell maxWidth={shellMaxWidth}>
      <AppProviders>
        <View style={styles.body}>
          {renderTab({
            tab: nav.tab,
            supportLanguage,
            dueReviewMode: nav.dueReviewMode,
            onOpenFeedback: () => nav.setShowFeedback(true),
            onOpenSources: () => nav.setShowSources(true),
            onOpenSettings: () => nav.setShowSettings(true),
            onOpenProfile: () => nav.setShowProfile(true),
            onStartLesson: () => nav.setTab('Lessons'),
            onReviewDue: nav.onReviewDue,
            onOpenDailyRush: () => nav.setShowDailyRush(true),
          })}
        </View>
        <TabBar items={bottomTabs} activeId={nav.tab} onSelect={nav.onTabChange} />
        <CompletionToast />
        <LessonErrorToast />
      </AppProviders>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  // Width is now driven by useWindowDimensions() in App; styles.body stays
  // width: 100% / height: 100% / minWidth: 0 / overflow: hidden so the children control layout.
  body: { flex: 1, width: '100%', height: '100%', minWidth: 0, overflow: 'hidden', backgroundColor: ds.colors.background },
});