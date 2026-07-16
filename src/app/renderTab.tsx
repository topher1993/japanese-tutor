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
import type { AppTab, LessonTool } from '../types/navigation';
import type { LearnerLanguage } from '../types/onboarding';
import type { VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';

export interface RenderTabProps {
  tab: AppTab;
  supportLanguage: LearnerLanguage;
  dueReviewMode: boolean;
  weakReviewMode: boolean;
  grammarReviewMode: boolean;
  pendingLessonId: string | null;
  pendingLessonTool: LessonTool | null;
  onLessonDestinationHandled: () => void;
  onOpenFeedback: () => void;
  onOpenSources: () => void;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onOpenPlacement: () => void;
  onStartLesson: () => void;
  onOpenLesson: (lessonId?: string) => void;
  onOpenLessonTool: (tool: LessonTool) => void;
  onReviewDue: () => void;
  onPracticeWeak: () => void;
  onOpenGrammar: () => void;
  onPracticeWordGroup: (group: VocabularyLearningGroup) => void;
  flashcardLearningGroup: VocabularyLearningGroup | null;
  flashcardTopic: string | null;
  onPracticeTopic: (topic: string) => void;
  onOpenDailyRush: () => void;
  onOpenSentenceLab: () => void;
  onOpenJlptExam: () => void;
  // Phase 47: Weekly Todo Board CTAs route to other tabs / modal screens.
  // onOpenTab covers the 5 tab-based kinds (flashcards / quiz / kanji /
  // example-sentences). onOpenDailyRush is reused (same callback that
  // HomeScreen already uses) for the daily-rush kind.
  onOpenTab: (tab: AppTab) => void;
}

export function renderTab(props: RenderTabProps): React.ReactNode {
  const { tab, supportLanguage, dueReviewMode, weakReviewMode } = props;
  if (tab === 'Lessons') return (
    <LessonsScreen
      supportLanguage={supportLanguage}
      pendingLessonId={props.pendingLessonId ?? undefined}
      pendingLessonTool={props.pendingLessonTool ?? undefined}
      onPendingDestinationHandled={props.onLessonDestinationHandled}
      initialTrack={props.grammarReviewMode ? 'grammar' : undefined}
      onOpenTab={props.onOpenTab}
      onOpenDailyRush={props.onOpenDailyRush}
      onOpenSentenceLab={props.onOpenSentenceLab}
    />
  );
  if (tab === 'Flashcards') return <FlashcardsScreen supportLanguage={supportLanguage} dueReviewMode={dueReviewMode} weakReviewMode={weakReviewMode} initialLearningGroup={props.flashcardLearningGroup} initialTopic={props.flashcardTopic} />;
  if (tab === 'Quiz') return <QuizScreen supportLanguage={supportLanguage} onOpenJlptExam={props.onOpenJlptExam} />;
  if (tab === 'Progress') return (
    <ProgressScreen
      onOpenFeedback={props.onOpenFeedback}
      onOpenSources={props.onOpenSources}
      onOpenSettings={props.onOpenSettings}
      onOpenProfile={props.onOpenProfile}
      onPracticeWordGroup={props.onPracticeWordGroup}
      onPracticeTopic={props.onPracticeTopic}
      onPracticeWeak={props.onPracticeWeak}
      onOpenGrammar={props.onOpenGrammar}
    />
  );
  return (
    <HomeScreen
      supportLanguage={supportLanguage}
      onStartLesson={props.onStartLesson}
      onReviewDue={props.onReviewDue}
      onPracticeWeak={props.onPracticeWeak}
      onOpenDailyRush={props.onOpenDailyRush}
      onOpenFlashcards={() => props.onOpenTab('Flashcards')}
      onOpenSentenceLab={props.onOpenSentenceLab}
      onOpenQuiz={() => props.onOpenTab('Quiz')}
      onOpenLesson={props.onOpenLesson}
      onOpenKanji={() => props.onOpenLessonTool('kanji')}
      onOpenExampleSentences={() => props.onOpenLessonTool('example-sentences')}
      onPracticeWordGroup={props.onPracticeWordGroup}
      onOpenPlacement={props.onOpenPlacement}
    />
  );
}
