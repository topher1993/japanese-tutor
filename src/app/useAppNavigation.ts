// Phase 42 / P1-1 — Navigation state hook extracted from App.tsx.
//
// The original App.tsx had 9 useState calls all managing navigation: which
// tab is active, which modal-screen overlay is showing (settings, profile,
// feedback, sources, daily-rush, sensei-review), whether the learner is
// in due-review mode, etc. Plus three URL-param gates that fire on first
// render.
//
// This hook bundles all of that into a single state object plus a stable
// callback set. Each field is settable individually; modal screens can be
// opened or closed without touching the others. The dev-only URL-param
// gates (__DEV__-guarded) remain in here because they're part of the
// navigation bootstrap contract.

import { useCallback, useMemo, useState } from 'react';

import type { AppTab } from '../types/navigation';
import { createAppSearchParams } from '../services/queryParamService';
import { getBottomNavigationTabs } from '../services/appNavigationService';

export interface AppNavigation {
  tab: AppTab;
  setTab: (next: AppTab) => void;
  onTabChange: (next: AppTab) => void;
  showFeedback: boolean;
  setShowFeedback: (v: boolean) => void;
  showSources: boolean;
  setShowSources: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  showProfile: boolean;
  setShowProfile: (v: boolean) => void;
  showReview: boolean;
  setShowReview: (v: boolean) => void;
  showDailyRush: boolean;
  setShowDailyRush: (v: boolean) => void;
  dueReviewMode: boolean;
  onReviewDue: () => void;
  reviewerMode: boolean;
  skipOnboarding: boolean;
  onboardingStep: 'welcome' | 'language' | 'workplace-goal' | 'daily-habit' | null;
  tabs: AppTab[];
}

export function useAppNavigation(): AppNavigation {
  // Phase 22 audit fix P1-08: query-param shell escape hatches are gated
  // behind __DEV__ so production builds never honor `?tab=`, `?screen=`,
  // `?skipOnboarding=`, or `?onboarding=`. Production only relies on
  // persisted state.
  const params = __DEV__ ? createAppSearchParams() : null;
  const getParam = (name: string): string | null => params ? params.get(name) : null;

  const requestedTab = getParam('tab') as AppTab | null;
  const onboardingStep = getParam('onboarding') as 'welcome' | 'language' | 'workplace-goal' | 'daily-habit' | null;
  const reviewerMode = getParam('reviewer') === '1';
  const skipOnboarding = getParam('skipOnboarding') === '1';

  const tabs = useMemo(() => getBottomNavigationTabs().map(t => t.id), []);

  const [tab, setTab] = useState<AppTab>(requestedTab && tabs.includes(requestedTab) ? requestedTab : 'Home');
  const [showFeedback, setShowFeedback] = useState(getParam('screen') === 'feedback');
  const [showSources, setShowSources] = useState(getParam('screen') === 'sources');
  const [showSettings, setShowSettings] = useState(getParam('screen') === 'settings');
  const [showProfile, setShowProfile] = useState(getParam('screen') === 'profile');
  const [showReview, setShowReview] = useState(reviewerMode && getParam('screen') === 'review');
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

  return {
    tab,
    setTab,
    onTabChange,
    showFeedback,
    setShowFeedback,
    showSources,
    setShowSources,
    showSettings,
    setShowSettings,
    showProfile,
    setShowProfile,
    showReview,
    setShowReview,
    showDailyRush,
    setShowDailyRush,
    dueReviewMode,
    onReviewDue,
    reviewerMode,
    skipOnboarding,
    onboardingStep,
    tabs,
  };
}