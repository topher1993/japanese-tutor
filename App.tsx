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
import { wrapTabChangeForAnalytics } from './src/utils/wrapTabChangeForAnalytics';
import { track } from './src/services/analyticsService';
// Phase 44.3: initialize the PostHog backend on app mount so the
// very first event (tab_visited initial: true) gets transmitted.
// Safe to call repeatedly; initBackend is idempotent and skips
// itself when EXPO_PUBLIC_ANALYTICS_KEY is unset.
import { initBackend } from './src/services/analyticsBackend';

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
 *
 * Phase 44.2 — analytics wiring. App.tsx is the single integration point
 * for cross-cutting events (tab changes, onboarding completion, settings
 * reset) so that all `track()` call sites in the render tree are grep-able
 * from one file. Per-screen events (lesson_opened, mark_complete_*) live
 * in the screen/hook that owns the relevant state transition.
 */
export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const isTabletOrFoldable = windowWidth >= 600;
  const shellMaxWidth = isTabletOrFoldable ? 480 : undefined;

  // Single source of navigation state, owned by useAppNavigation.
  const nav = useAppNavigation();

  // Phase 44.2: fire an analytics event on the initial tab paint so
    // the first session's starting tab is captured (not just subsequent
    // switches). This effect runs exactly once on mount. track() is a
    // no-op in test mode.
    React.useEffect(() => {
      // Phase 44.3: kick off backend init before the first event so the
      // SDK has a chance to set up before tab_visited fires. initBackend
      // is a no-op when no API key is set, so this is safe in dev too.
      void initBackend();
      track('tab_visited', { tab: nav.tab, initial: true });
      // We intentionally only run on mount; nav.onTabChange (wrapped
      // below) handles subsequent switches with `initial` undefined.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

  // Phase 44.2: tab change → analytics event. The wrapper preserves
  // the original handler's side effects (nav state updates) and
  // adds a track() call without coupling the hook to analytics.
  const onTabChangeWithAnalytics = React.useMemo(
    () => wrapTabChangeForAnalytics(nav.onTabChange),
    [nav.onTabChange],
  );

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
              // Phase 44.2: capture the onboarding completion so we
              // can measure onboarding funnel drop-off. The event
              // includes the chosen support language (scrubbed by
              // track() anyway, but the language is already on the
              // safe list of typed enums).
              track('onboarding_completed', { language });
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
              // Phase 44.2: capture the reset action so we can
              // measure how many users reset their progress.
              // Settings is the only call site, so the source is
              // hardcoded — no need to thread it through.
              track('settings_reset_app', { source: 'settings' });
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
        <TabBar items={bottomTabs} activeId={nav.tab} onSelect={onTabChangeWithAnalytics} />
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