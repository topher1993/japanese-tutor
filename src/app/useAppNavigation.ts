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

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AppTab, LessonTool } from '../types/navigation';
import type { VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';
import { createAppSearchParams } from '../services/queryParamService';
import { getBottomNavigationTabs } from '../services/appNavigationService';
import { loadPersistedNavigationState, savePersistedNavigationState } from './navigationStorage';

export interface AppNavigation {
  navigationReady: boolean;
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
  showPlacement: boolean;
  setShowPlacement: (v: boolean) => void;
  showReview: boolean;
  setShowReview: (v: boolean) => void;
  showDailyRush: boolean;
  setShowDailyRush: (v: boolean) => void;
  showSentenceLab: boolean;
  setShowSentenceLab: (v: boolean) => void;
  showJlptExam: boolean;
  setShowJlptExam: (v: boolean) => void;
  dueReviewMode: boolean;
  onReviewDue: () => void;
  weakReviewMode: boolean;
  onPracticeWeak: () => void;
  grammarReviewMode: boolean;
  onOpenGrammar: () => void;
  pendingLessonId: string | null;
  pendingLessonTool: LessonTool | null;
  onOpenLesson: (lessonId?: string) => void;
  onOpenLessonTool: (tool: LessonTool) => void;
  clearPendingLessonDestination: () => void;
  flashcardLearningGroup: VocabularyLearningGroup | null;
  setFlashcardLearningGroup: (group: VocabularyLearningGroup | null) => void;
  onPracticeWordGroup: (group: VocabularyLearningGroup) => void;
  flashcardTopic: string | null;
  setFlashcardTopic: (topic: string | null) => void;
  onPracticeTopic: (topic: string) => void;
  reviewerMode: boolean;
  skipOnboarding: boolean;
  onboardingStep: 'welcome' | 'language' | 'workplace-goal' | 'daily-habit' | null;
  tabs: AppTab[];
}

export function useAppNavigation(onTabVisited: (next: AppTab) => void = () => undefined): AppNavigation {
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

  const [tab, setTabState] = useState<AppTab>(requestedTab && tabs.includes(requestedTab) ? requestedTab : 'Home');
  const [showFeedback, setShowFeedback] = useState(getParam('screen') === 'feedback');
  const [showSources, setShowSources] = useState(getParam('screen') === 'sources');
  const [showSettings, setShowSettings] = useState(getParam('screen') === 'settings');
  const [showProfile, setShowProfile] = useState(getParam('screen') === 'profile');
  const [showPlacement, setShowPlacement] = useState(getParam('screen') === 'placement');
  const [showReview, setShowReview] = useState(reviewerMode && getParam('screen') === 'review');
  const requestedDailyRush = getParam('screen') === 'daily-rush';
  const [showDailyRush, setShowDailyRushState] = useState(requestedDailyRush);
  const [showSentenceLab, setShowSentenceLab] = useState(getParam('screen') === 'sentence-lab');
  const [showJlptExam, setShowJlptExam] = useState(getParam('screen') === 'jlpt-exam');
  const [navigationReady, setNavigationReady] = useState(requestedDailyRush);
  // Phase 25 / P1-1: when Home's "Review N due cards now" CTA is pressed,
  // jump to Flashcards with this flag set. Flashcards uses it to pre-filter
  // the deck to cards whose SRS row is due. Cleared on any non-Flashcards tab.
  const [dueReviewMode, setDueReviewMode] = useState(false);
  const [weakReviewMode, setWeakReviewMode] = useState(false);
  const [grammarReviewMode, setGrammarReviewMode] = useState(false);
  const [pendingLessonId, setPendingLessonId] = useState<string | null>(null);
  const [pendingLessonTool, setPendingLessonTool] = useState<LessonTool | null>(null);
  const [flashcardLearningGroup, setFlashcardLearningGroup] = useState<VocabularyLearningGroup | null>(null);
  const [flashcardTopic, setFlashcardTopic] = useState<string | null>(null);

  useEffect(() => {
    if (requestedDailyRush) {
      void savePersistedNavigationState({ showDailyRush: true });
      setNavigationReady(true);
      return;
    }
    let cancelled = false;
    loadPersistedNavigationState().then((state) => {
      if (!cancelled) setShowDailyRushState(state.showDailyRush);
    }).finally(() => {
      if (!cancelled) setNavigationReady(true);
    });
    return () => { cancelled = true; };
  }, [requestedDailyRush]);

  const setShowDailyRush = useCallback((value: boolean) => {
    setShowDailyRushState(value);
    void savePersistedNavigationState({ showDailyRush: value });
  }, []);

  const setTab = useCallback((next: AppTab) => {
    setTabState(next);
    onTabVisited(next);
  }, [onTabVisited]);

  const onReviewDue = useCallback(() => {
    setFlashcardLearningGroup(null);
    setFlashcardTopic(null);
    setDueReviewMode(true);
    setWeakReviewMode(false);
    setTab('Flashcards');
  }, [setTab]);
  const onPracticeWeak = useCallback(() => {
    setFlashcardLearningGroup(null);
    setFlashcardTopic(null);
    setWeakReviewMode(true);
    setDueReviewMode(false);
    setTab('Flashcards');
  }, [setTab]);
  const onOpenGrammar = useCallback(() => {
    setPendingLessonId(null);
    setPendingLessonTool(null);
    setGrammarReviewMode(true);
    setTab('Lessons');
  }, [setTab]);
  const onOpenLesson = useCallback((lessonId?: string) => {
    setPendingLessonId(lessonId ?? null);
    setPendingLessonTool(null);
    setGrammarReviewMode(false);
    setTab('Lessons');
  }, [setTab]);
  const onOpenLessonTool = useCallback((tool: LessonTool) => {
    setPendingLessonId(null);
    setPendingLessonTool(tool);
    setGrammarReviewMode(false);
    setTab('Lessons');
  }, [setTab]);
  const clearPendingLessonDestination = useCallback(() => {
    setPendingLessonId(null);
    setPendingLessonTool(null);
  }, []);
  const onPracticeWordGroup = useCallback((group: VocabularyLearningGroup) => {
    setFlashcardLearningGroup(group);
    setFlashcardTopic(null);
    setWeakReviewMode(true);
    setDueReviewMode(false);
    setTab('Flashcards');
  }, [setTab]);
  const onPracticeTopic = useCallback((topic: string) => {
    setFlashcardTopic(topic);
    setFlashcardLearningGroup(null);
    setWeakReviewMode(false);
    setDueReviewMode(false);
    setTab('Flashcards');
  }, [setTab]);
  const onTabChange = useCallback((next: AppTab) => {
    setTab(next);
    if (next !== 'Flashcards') setDueReviewMode(false);
    if (next !== 'Flashcards') setWeakReviewMode(false);
    setGrammarReviewMode(false);
    setPendingLessonId(null);
    setPendingLessonTool(null);
    setFlashcardLearningGroup(null);
    setFlashcardTopic(null);
  }, [setTab]);

  return {
    navigationReady,
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
    showPlacement,
    setShowPlacement,
    showReview,
    setShowReview,
    showDailyRush,
    setShowDailyRush,
    showSentenceLab,
    setShowSentenceLab,
    showJlptExam,
    setShowJlptExam,
    dueReviewMode,
    onReviewDue,
    weakReviewMode,
    onPracticeWeak,
    grammarReviewMode,
    onOpenGrammar,
    pendingLessonId,
    pendingLessonTool,
    onOpenLesson,
    onOpenLessonTool,
    clearPendingLessonDestination,
    flashcardLearningGroup,
    setFlashcardLearningGroup,
    onPracticeWordGroup,
    flashcardTopic,
    setFlashcardTopic,
    onPracticeTopic,
    reviewerMode,
    skipOnboarding,
    onboardingStep,
    tabs,
  };
}
