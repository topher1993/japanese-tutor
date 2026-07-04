// Phase 42 / P1-1 — Tab routing extracted from App.tsx.
//
// The original App.tsx had a `render(tab, supportLanguage, ...callbacks)`
// function that returned the correct screen element for the active tab.
// This module replaces that function with a typed React component so
// each tab is rendered as JSX inside the AppShell tree.

import React from 'react';

import { HomeScreen } from '../screens/HomeScreen';
import { LessonsScreen } from '../screens/LessonsScreen';
import { FlashcardsScreen } from '../screens/FlashcardsScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import type { AppTab } from '../types/navigation';
import type { LearnerLanguage } from '../types/onboarding';

export interface RenderTabProps {
  tab: AppTab;
  supportLanguage: LearnerLanguage;
  dueReviewMode: boolean;
  onOpenFeedback: () => void;
  onOpenSources: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onStartLesson: () => void;
  onReviewDue: () => void;
  onOpenDailyRush: () => void;
}

export function renderTab(props: RenderTabProps): React.ReactNode {
  const { tab, supportLanguage, dueReviewMode } = props;
  if (tab === 'Lessons') return <LessonsScreen supportLanguage={supportLanguage} />;
  if (tab === 'Flashcards') return <FlashcardsScreen supportLanguage={supportLanguage} dueReviewMode={dueReviewMode} />;
  if (tab === 'Quiz') return <QuizScreen supportLanguage={supportLanguage} />;
  if (tab === 'Progress') return (
    <ProgressScreen
      onOpenFeedback={props.onOpenFeedback}
      onOpenSources={props.onOpenSources}
      onOpenSettings={props.onOpenSettings}
      onOpenProfile={props.onOpenProfile}
    />
  );
  return (
    <HomeScreen
      supportLanguage={supportLanguage}
      onStartLesson={props.onStartLesson}
      onReviewDue={props.onReviewDue}
      onOpenDailyRush={props.onOpenDailyRush}
    />
  );
}