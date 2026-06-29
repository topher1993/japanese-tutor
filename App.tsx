import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StatusBar, useWindowDimensions, View, StyleSheet, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { HomeScreen } from './src/screens/HomeScreen';
import { LessonsScreen } from './src/screens/LessonsScreen';
import { FlashcardsScreen } from './src/screens/FlashcardsScreen';
import { QuizScreen } from './src/screens/QuizScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { BetaFeedbackScreen } from './src/screens/BetaFeedbackScreen';
import { SourcesScreen } from './src/screens/SourcesScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { DailyRushScreen } from './src/screens/DailyRushScreen';
import { SenseiReviewScreen } from './src/screens/SenseiReviewScreen';
import { TabBar } from './src/components/TabBar';
import { CompletionToast } from './src/components/CompletionToast';
import { ds } from './src/theme/designSystem';
import type { AppTab } from './src/types/navigation';
import type { LearnerLanguage } from './src/types/onboarding';
import type { SqliteLikeDatabase } from './src/repositories/sqliteLearningRepository';
import {
  createWebOnboardingStorage,
  createOnboardingPreferenceStore,
  getDefaultOnboardingPreference,
} from './src/services/onboardingPreferenceService';
import { createAppSearchParams } from './src/services/queryParamService';
import { appSafeAreaEdges, createAppShellPadding } from './src/services/appSafeAreaLayoutService';
import { getBottomNavigationTabs } from './src/services/appNavigationService';
import { createInMemoryKeyValueStorage } from './src/services/keyValueStorage';
import { LearningRepositoryProvider } from './src/services/learningContext';
import { UserProfileProvider } from './src/services/userProfileContext';

const bottomTabs = getBottomNavigationTabs();
const tabs: AppTab[] = bottomTabs.map(tab => tab.id);

function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserProfileProvider>
      <LearningRepositoryProvider>{children}</LearningRepositoryProvider>
    </UserProfileProvider>
  );
}

function AppShell({ children, maxWidth }: { children: React.ReactNode; maxWidth?: number }) {
  // Phase 22 audit fix P1-05: only cap width on tablet/foldable breakpoints.
  // On phones (the actual target device), use full width.
  const containerStyle = maxWidth
    ? [styles.app, styles.safeAreaPadding, { maxWidth, alignSelf: 'center' as const }]
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

function Splash() {
  return (
    <View style={styles.splash}>
      <Text style={styles.splashBrand}>日本語</Text>
      <Text style={styles.splashName}>Tutor</Text>
    </View>
  );
}

function render(
  tab: AppTab,
  supportLanguage: LearnerLanguage,
  onOpenFeedback: () => void,
  onOpenSources: () => void,
  onOpenSettings: () => void,
  onOpenProfile: () => void,
  onStartLesson: () => void,
  onReviewDue: () => void,
  onOpenDailyRush: () => void,
  dueReviewMode: boolean,
) {
  if (tab === 'Lessons') return <LessonsScreen supportLanguage={supportLanguage} />;
  if (tab === 'Flashcards') return <FlashcardsScreen supportLanguage={supportLanguage} dueReviewMode={dueReviewMode} />;
  if (tab === 'Quiz') return <QuizScreen supportLanguage={supportLanguage} />;
  if (tab === 'Progress') return <ProgressScreen onOpenFeedback={onOpenFeedback} onOpenSources={onOpenSources} onOpenSettings={onOpenSettings} onOpenProfile={onOpenProfile} />;
  return <HomeScreen supportLanguage={supportLanguage} onStartLesson={onStartLesson} onReviewDue={onReviewDue} onOpenDailyRush={onOpenDailyRush} />;
}

/**
 * P0-01: onboarding preference used to load synchronously via
 * `createBrowserOnboardingStorage()` which returned `undefined` on React
 * Native, silently dropping the learner's preference on every cold start.
 *
 * P0-02: the SQLite repository is now wrapped in `LearningRepositoryProvider`
 * (opened lazily) and screens consume it via `useLearningContext()`.
 */
export default function App() {
  // Phase 22 audit fix P1-08: query-param shell escape hatches are gated
  // behind __DEV__ so production builds never honor `?tab=`, `?screen=`,
  // `?skipOnboarding=`, or `?onboarding=`. Production only relies on
  // persisted state.
  const params = __DEV__ ? createAppSearchParams() : null;
  const getParam = (name: string): string | null => params ? params.get(name) : null;
  // Phase 22 audit fix P1-05: cap width only on tablet/foldable breakpoints.
  const { width: windowWidth } = useWindowDimensions();
  const isTabletOrFoldable = windowWidth >= 600;
  const shellMaxWidth = isTabletOrFoldable ? 480 : undefined;
  const requestedTab = getParam('tab') as AppTab | null;
  const onboardingStep = getParam('onboarding') as 'welcome' | 'language' | 'workplace-goal' | 'daily-habit' | null;
  const skipOnboarding = getParam('skipOnboarding') === '1';

  const [preferenceReady, setPreferenceReady] = useState(false);
  const [onboarded, setOnboarded] = useState(skipOnboarding);
  const [supportLanguage, setSupportLanguage] = useState<LearnerLanguage>('en');
  const [tab, setTab] = useState<AppTab>(requestedTab && tabs.includes(requestedTab) ? requestedTab : 'Home');
  const [showFeedback, setShowFeedback] = useState(getParam('screen') === 'feedback');
  const [showSources, setShowSources] = useState(getParam('screen') === 'sources');
  const [showSettings, setShowSettings] = useState(getParam('screen') === 'settings');
  const [showProfile, setShowProfile] = useState(getParam('screen') === 'profile');
  const [showReview, setShowReview] = useState(getParam('screen') === 'review');
  const [showDailyRush, setShowDailyRush] = useState(getParam('screen') === 'daily-rush');
  // Phase 25 / P1-1: when Home's "Review N due cards now" CTA is pressed,
  // jump to Flashcards with this flag set. Flashcards uses it to pre-filter
  // the deck to cards whose SRS row is due. Cleared on any non-Flashcards tab.
  const [dueReviewMode, setDueReviewMode] = useState(false);
  const onReviewDue = useCallback(() => {
    setDueReviewMode(true);
    setTab('Flashcards');
  }, []);
  const onTabChange = useCallback((next: AppTab) => {
    setTab(next);
    if (next !== 'Flashcards') setDueReviewMode(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreference() {
      try {
        let storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> } | null = null;

        if (Platform.OS === 'web') {
          storage = createWebOnboardingStorage();
        } else {
          try {
            const SQLite = await import('expo-sqlite');
            const db = await SQLite.openDatabaseAsync('japanese-tutor.db');
            const { createTablesSql } = await import('./src/db/schema');
            for (const sql of createTablesSql) await db.execAsync(sql);
            const { createSqliteKeyValueStorage } = await import('./src/services/keyValueStorage');
            storage = createSqliteKeyValueStorage({
              execAsync: (sql: string) => db.execAsync(sql),
              runAsync: (sql: string, ...params: unknown[]) => db.runAsync(sql, ...params as never[]),
              getAllAsync: ((sql: string, ...params: unknown[]) =>
                db.getAllAsync(sql, ...(params as never[]))) as SqliteLikeDatabase['getAllAsync'],
            });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[app] SQLite init failed; falling back to in-memory storage', err);
            storage = createInMemoryKeyValueStorage();
          }
        }

        const store = createOnboardingPreferenceStore(storage);
        const pref = await store.load();
        if (cancelled) return;
        setOnboarded(skipOnboarding || pref.onboarded);
        setSupportLanguage(pref.language);
        setPreferenceReady(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[app] onboarding preference load failed; using default', err);
        if (cancelled) return;
        const def = getDefaultOnboardingPreference();
        setOnboarded(skipOnboarding || def.onboarded);
        setSupportLanguage(def.language);
        setPreferenceReady(true);
      }
    }

    loadPreference();
    return () => { cancelled = true; };
  }, [skipOnboarding]);

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
            initialStepId={onboardingStep ?? undefined}
            onDone={async (language) => {
              try {
                let storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> } | null = null;
                if (Platform.OS === 'web') {
                  storage = createWebOnboardingStorage();
                } else {
                  try {
                    const SQLite = await import('expo-sqlite');
                    const db = await SQLite.openDatabaseAsync('japanese-tutor.db');
                    const { createTablesSql } = await import('./src/db/schema');
                    for (const sql of createTablesSql) await db.execAsync(sql);
                    const { createSqliteKeyValueStorage } = await import('./src/services/keyValueStorage');
                    storage = createSqliteKeyValueStorage({
                      execAsync: (sql: string) => db.execAsync(sql),
                      runAsync: (sql: string, ...params: unknown[]) => db.runAsync(sql, ...params as never[]),
                      getAllAsync: ((sql: string, ...params: unknown[]) =>
                        db.getAllAsync(sql, ...(params as never[]))) as SqliteLikeDatabase['getAllAsync'],
                    });
                  } catch {
                    storage = createInMemoryKeyValueStorage();
                  }
                }
                const store = createOnboardingPreferenceStore(storage);
                await store.save({ onboarded: true, language });
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[app] failed to persist onboarding choice', err);
              }
              setSupportLanguage(language);
              setOnboarded(true);
            }}
          />
        </AppProviders>
      </AppShell>
    );
  }

  if (showFeedback) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <BetaFeedbackScreen onBack={() => setShowFeedback(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  if (showSources) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <SourcesScreen onBack={() => setShowSources(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  // Phase 22 audit fix P1-06: Settings screen with reset affordance.
  if (showSettings) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <SettingsScreen
                      onBack={() => setShowSettings(false)}
                      onOpenReview={() => { setShowSettings(false); setShowReview(true); }}
                      onReset={async () => {
              // Clear onboarding preference via the same storage path the
              // app loads from. This forces a fresh onboarding + fresh
              // screens on the next cold start.
              try {
                const { clearOnboardingPreference } = await import('./src/services/onboardingPreferenceService');
                await clearOnboardingPreference();
              } catch (err) {
                // eslint-disable-next-line no-console
                console.warn('[settings] failed to clear onboarding preference', err);
              }
              // Force back to a cold-start state.
              setOnboarded(false);
              setSupportLanguage('en');
              setShowSettings(false);
            }}
          />
        </AppProviders>
      </AppShell>
    );
  }

  // Phase 28 profile editor.
  if (showProfile) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <ProfileScreen onBack={() => setShowProfile(false)} />
        </AppProviders>
      </AppShell>
    );
  }


  if (showDailyRush) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <DailyRushScreen supportLanguage={supportLanguage} onBack={() => setShowDailyRush(false)} />
        </AppProviders>
      </AppShell>
    );
  }

  // Sensei Translation Review — hidden dev tool for native-speaker reviewers.
  if (showReview) {
    return (
      <AppShell maxWidth={shellMaxWidth}>
        <SenseiReviewScreen onBack={() => setShowReview(false)} />
      </AppShell>
    );
  }

  return (
      <AppShell maxWidth={shellMaxWidth}>
        <AppProviders>
          <View style={styles.body}>{render(tab, supportLanguage, () => setShowFeedback(true), () => setShowSources(true), () => setShowSettings(true), () => setShowProfile(true), () => setTab('Lessons'), onReviewDue, () => setShowDailyRush(true), dueReviewMode)}</View>
          <TabBar items={bottomTabs} activeId={tab} onSelect={onTabChange} />
          <CompletionToast />
        </AppProviders>
      </AppShell>
    );
}

const styles = StyleSheet.create({
  // Phase 22 audit fix P1-05: removed the unconditional maxWidth: 360 cap.
  // Width is now driven by useWindowDimensions() in AppShell; styles.app stays
  // width: 100% / height: 100% / overflow: hidden so the children control layout.
  app: { flex: 1, width: '100%', height: '100%', overflow: 'hidden', backgroundColor: ds.colors.background },
  fill: { flex: 1, backgroundColor: ds.colors.background },
  safeAreaPadding: createAppShellPadding(),
  body: { flex: 1, width: '100%', height: '100%', minWidth: 0, overflow: 'hidden', backgroundColor: ds.colors.background },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: ds.colors.background },
  splashBrand: { fontSize: 44, fontWeight: '900', color: ds.colors.brand, marginBottom: ds.spacing.xs },
  splashName: { fontSize: 24, fontWeight: '900', color: ds.colors.text },
});