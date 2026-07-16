import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';

import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { BetaFeedbackScreen } from './src/screens/BetaFeedbackScreen';
import { SourcesScreen } from './src/screens/SourcesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DailyRushScreen } from './src/screens/DailyRushScreen';
import { PlacementTestScreen } from './src/screens/PlacementTestScreen';
import { SentenceLabScreen } from './src/screens/SentenceLabScreen';
import { ScreenScaffold } from './src/components/ScreenScaffold';
import { ScreenHeader } from './src/components/ScreenHeader';
import { SenseiReviewScreen } from './src/screens/SenseiReviewScreen';
import { JlptExamFlowScreen } from './src/screens/JlptExamFlowScreen';
import { KoiSenseiScreen } from './src/features/koi-sensei/ui/KoiSenseiScreen';
import { TabBar } from './src/components/TabBar';
import { CompletionToast, LessonErrorToast } from './src/components/CompletionToast';
import { ds } from './src/theme/designSystem';
import { getResponsiveLayout, getShellMaxWidth } from './src/services/responsiveLayoutService';
import { useResponsiveOrientation } from './src/hooks/useResponsiveOrientation';
import type { AppTab } from './src/types/navigation';
import { getBottomNavigationTabs } from './src/services/appNavigationService';

import { AppProviders } from './src/app/AppProviders';
import { AppShell } from './src/app/AppShell';
import { Splash } from './src/app/Splash';
import { renderTab } from './src/app/renderTab';
import { useAppNavigation } from './src/app/useAppNavigation';
import { useUserProfileContext } from './src/services/userProfileContext';
import {
  flushQueuedAnalytics,
  initializeAnalyticsContext,
  shouldTrackInitialTab,
  track,
} from './src/services/analyticsService';
import { openOnboardingStorage } from './src/app/onboardingStorage';
import { getJlptExamAttemptRepository } from './src/app/jlptExamStorage';
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
  return (
    <AppProviders>
      <AppContent />
    </AppProviders>
  );
}

function AppContent() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isTabletLandscape } = getResponsiveLayout(windowWidth, windowHeight);
  const shellMaxWidth = getShellMaxWidth(windowWidth, windowHeight);
  useResponsiveOrientation();

  // Single source of navigation state. The hook routes every direct and
  // programmatic tab transition through this callback, so analytics cannot be
  // bypassed by Home CTAs, lesson links, placement, or review shortcuts.
  const trackTabVisit = React.useCallback((tab: AppTab) => {
    track('tab_visited', { tab, initial: false });
  }, []);
  const nav = useAppNavigation(trackTabVisit);
  const jlptExamRepository = React.useMemo(() => getJlptExamAttemptRepository(), []);
  const { ready: profileReady, profile, updateProfile } = useUserProfileContext();

  // Profile hydration includes the one-time legacy onboarding migration.
  // These values therefore stay synchronized with edits made in Profile.
  const onboarded = nav.skipOnboarding || profile?.onboarded === true;
  const supportLanguage = profile?.static.supportLanguage ?? 'en';

  const initialTabTracked = React.useRef(false);

  // Initialize identity/backend once. Screen effects may queue telemetry while
  // this work is in flight; flushQueuedAnalytics drains only pending events.
  React.useEffect(() => {
    void (async () => {
      try {
        const storage = await openOnboardingStorage();
        const context = await initializeAnalyticsContext(storage);
        const backendReady = await initBackend({ installId: context.installId });
        if (backendReady) flushQueuedAnalytics();
      } catch (err) {
        if (__DEV__) console.warn('[analytics] initialization failed; queue-only mode', err);
      }
    })();
  }, []);

  // Splash and onboarding are not tab visits. Emit the initial visit only
  // after both boot paths are ready and an onboarded tab is actually visible.
  React.useEffect(() => {
    if (!shouldTrackInitialTab({
      profileReady,
      navigationReady: nav.navigationReady,
      onboarded,
      alreadyTracked: initialTabTracked.current,
    })) return;
    initialTabTracked.current = true;
    track('tab_visited', { tab: nav.tab, initial: true });
  }, [profileReady, nav.navigationReady, nav.tab, onboarded]);

  // Onboarding preference lifecycle — owned by App.tsx because it bridges
  // the async load + render-after-ready contract.
  // Phase 47: stable callback for the Weekly Todo Board CTAs that route
  // to a different tab. Wrapped in useCallback so the identity doesn't
  // change on every render (matters because the callback is threaded
  // through renderTab -> LessonsScreen -> WeeklyTodoBoardView.onTodoPress).
  //
  // RULES OF HOOKS: this useCallback MUST stay above every early
  // `return` in this function. Previously it sat below the
  // `if (!preferenceReady) return <Splash />` path, which meant the
  // hook count differed between the first render (preferenceReady=false,
  // bailed at the early return — 7 hooks) and the post-hydration render
  // (8 hooks). React threw "Rendered more hooks than during the previous
  // render" and broke the app on cold-start. Moved here unconditionally
  // so the hook order is identical on every render.
  const onOpenTab = React.useCallback((next: AppTab) => {
    nav.setTab(next);
  }, [nav.setTab]);

  if (!profileReady || !nav.navigationReady) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <Splash />
      </AppShell>
    );
  }

  if (!onboarded) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <OnboardingScreen
          initialStepId={nav.onboardingStep ?? undefined}
          onDone={async (language) => {
            track('onboarding_completed', { language });
            await updateProfile({
              onboarded: true,
              static: { supportLanguage: language },
            });
          }}
        />
      </AppShell>
    );
  }

  if (nav.showKoiSensei) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <KoiSenseiScreen
          supportLanguage={supportLanguage}
          onBack={() => nav.setShowKoiSensei(false)}
        />
      </AppShell>
    );
  }

  if (nav.showFeedback) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <BetaFeedbackScreen onBack={() => nav.setShowFeedback(false)} />
      </AppShell>
    );
  }

  if (nav.showSources) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <SourcesScreen onBack={() => nav.setShowSources(false)} />
      </AppShell>
    );
  }

  // Phase 22 audit fix P1-06: Settings screen with reset affordance.
  if (nav.showSettings) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <SettingsScreen
          onBack={() => nav.setShowSettings(false)}
          showReviewerTools={nav.reviewerMode}
          onOpenReview={nav.reviewerMode ? () => { nav.setShowSettings(false); nav.setShowReview(true); } : undefined}
          onReset={async () => {
            track('settings_reset_app', { source: 'settings' });
            await jlptExamRepository.clearAll();
            // SettingsScreen has already reset the shared profile context.
            // Closing this overlay reveals onboarding with no second store.
            nav.setShowSettings(false);
          }}
        />
      </AppShell>
    );
  }

  // Phase 28 profile editor.
  if (nav.showProfile) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <ProfileScreen
          onBack={() => nav.setShowProfile(false)}
          onOpenPlacement={() => { nav.setShowProfile(false); nav.setShowPlacement(true); }}
        />
      </AppShell>
    );
  }

  if (nav.showDailyRush) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <DailyRushScreen supportLanguage={supportLanguage} onBack={() => nav.setShowDailyRush(false)} />
      </AppShell>
    );
  }

  if (nav.showPlacement) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <PlacementTestScreen
          source="home"
          onBack={() => nav.setShowPlacement(false)}
          onContinue={() => { nav.setShowPlacement(false); nav.setTab('Lessons'); }}
        />
      </AppShell>
    );
  }

  if (nav.showSentenceLab) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <ScreenScaffold>
          <ScreenHeader title="Back" onBack={() => nav.setShowSentenceLab(false)} />
          <SentenceLabScreen />
        </ScreenScaffold>
      </AppShell>
    );
  }

  if (nav.showJlptExam) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <JlptExamFlowScreen
          repository={jlptExamRepository}
          onExit={() => nav.setShowJlptExam(false)}
        />
      </AppShell>
    );
  }

  // (onOpenTab useCallback moved above the early returns to fix the
  // Rules-of-Hooks violation — see comment block above.)


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
      <View style={[styles.body, isTabletLandscape && styles.landscapeBody]}>
        {isTabletLandscape ? <TabBar items={bottomTabs} activeId={nav.tab} onSelect={nav.onTabChange} variant="rail" /> : null}
        <View style={isTabletLandscape ? styles.landscapeContent : styles.body}>
          {renderTab({
              tab: nav.tab,
              supportLanguage,
              dueReviewMode: nav.dueReviewMode,
              weakReviewMode: nav.weakReviewMode,
              grammarReviewMode: nav.grammarReviewMode,
              pendingLessonId: nav.pendingLessonId,
              pendingLessonTool: nav.pendingLessonTool,
              onLessonDestinationHandled: nav.clearPendingLessonDestination,
              onOpenFeedback: () => nav.setShowFeedback(true),
              onOpenSources: () => nav.setShowSources(true),
              onOpenSettings: () => nav.setShowSettings(true),
              onOpenProfile: () => nav.setShowProfile(true),
              onOpenPlacement: () => nav.setShowPlacement(true),
              onOpenKoiSensei: () => nav.setShowKoiSensei(true),
              onStartLesson: () => nav.onOpenLesson(),
              onOpenLesson: nav.onOpenLesson,
              onOpenLessonTool: nav.onOpenLessonTool,
              onReviewDue: nav.onReviewDue,
              onPracticeWeak: nav.onPracticeWeak,
              onOpenGrammar: nav.onOpenGrammar,
              onPracticeWordGroup: nav.onPracticeWordGroup,
              flashcardLearningGroup: nav.flashcardLearningGroup,
              flashcardTopic: nav.flashcardTopic,
              onPracticeTopic: nav.onPracticeTopic,
              onOpenDailyRush: () => nav.setShowDailyRush(true),
              onOpenSentenceLab: () => nav.setShowSentenceLab(true),
              onOpenJlptExam: () => nav.setShowJlptExam(true),
              // Phase 47: Weekly Todo Board CTAs.
              onOpenTab,
          })}
        </View>
      </View>
      {!isTabletLandscape ? <TabBar items={bottomTabs} activeId={nav.tab} onSelect={nav.onTabChange} /> : null}
      <CompletionToast />
      <LessonErrorToast />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  // Width is now driven by useWindowDimensions() in App; styles.body stays
  // width: 100% / height: 100% / minWidth: 0 / overflow: hidden so the children control layout.
  body: { flex: 1, width: '100%', height: '100%', minWidth: 0, overflow: 'hidden', backgroundColor: ds.colors.background },
  landscapeBody: { flexDirection: 'row' },
  // Stretch the screen instead of centering an intrinsic-width ScrollView.
  // The previous center alignment left most of a tablet's landscape canvas
  // empty and made Home feel like a narrow phone layout.
  landscapeContent: { flex: 1, minWidth: 0, alignItems: 'stretch' },
});
