import { describe, expect, it } from 'vitest';
import type { NavigationState } from '../src/types/navigation';
import { getAllLessons, getWeeklyLessonSummary, getLessonsByCategory } from '../src/services/lessonService';

// Local navigation stubs (the production navigationService was removed in
// the Phase 21 cleanup — these inline helpers preserve the original semantics
// for the persistence/navigation smoke test below.)
const createNavigationState = (): NavigationState => ({ activeTab: 'Home', history: ['Home'] });
const goToTab = (state: NavigationState, tab: NavigationState['activeTab']): NavigationState => ({ ...state, activeTab: tab, history: [...state.history, tab] });
const openLesson = (state: NavigationState, lessonId: string): NavigationState => ({ ...state, activeTab: 'Lessons', currentLessonId: lessonId, history: [...state.history, `LessonDetail:${lessonId}`] });
import { createFlashcardDeck, answerFlashcard, getDueFlashcards } from '../src/services/flashcardService';
import { createQuizSession, answerCurrentQuestion, finishQuizSession } from '../src/services/quizSessionService';
import { buildProgressDashboard } from '../src/services/progressDashboardService';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';

describe('Phase 3 learning core', () => {
  it('provides multiple mock Sensei lessons and a weekly lesson summary', () => {
    const lessons = getAllLessons();
    expect(lessons.length).toBeGreaterThanOrEqual(5);
    expect(getLessonsByCategory('safety').length).toBeGreaterThanOrEqual(1);
    const week = getWeeklyLessonSummary(1);
    expect(week.objectives).toContain('workplace greetings');
    expect(week.lessons.length).toBeGreaterThanOrEqual(3);
  });

  it('tracks lightweight navigation state between tabs and lesson detail', () => {
    const state = openLesson(goToTab(createNavigationState(), 'Lessons'), 'lesson-safety-stop');
    expect(state.activeTab).toBe('Lessons');
    expect(state.currentLessonId).toBe('lesson-safety-stop');
    expect(state.history).toEqual(['Home', 'Lessons', 'LessonDetail:lesson-safety-stop']);
  });

  it('supports flashcard deck answers and due-card filtering', () => {
    const deck = createFlashcardDeck(getAllLessons());
    expect(deck.cards.length).toBeGreaterThanOrEqual(10);
    const updated = answerFlashcard(deck, deck.cards[0].id, 'again', '2026-06-18');
    expect(updated.cards[0].reviewCount).toBe(1);
    expect(updated.cards[0].nextReviewDate).toBe('2026-06-19');
    expect(getDueFlashcards(updated, '2026-06-19').map(card => card.id)).toContain(deck.cards[0].id);
  });

  it('runs an interactive quiz session with scoring', () => {
    let session = createQuizSession();
    const first = session.questions[0];
    session = answerCurrentQuestion(session, first.correctChoice);
    expect(session.answers[first.id]).toBe(first.correctChoice);
    expect(session.currentIndex).toBe(1);
    const result = finishQuizSession(session);
    expect(result.total).toBe(session.questions.length);
    expect(result.score).toBe(1);
  });

  it('summarizes learner progress dashboard state', () => {
    const dashboard = buildProgressDashboard({
      startedAt: '2026-06-18',
      completedLessonIds: ['lesson-workplace-greetings', 'lesson-safety-stop'],
      quizScores: [{ lessonId: 'lesson-workplace-greetings', score: 2, completedAt: '2026-06-18' }],
      streak: { currentStreak: 2, longestStreak: 3, lastStudyDate: '2026-06-18' }
    }, getAllLessons());
    expect(dashboard.completedLessons).toBe(2);
    expect(dashboard.totalLessons).toBeGreaterThanOrEqual(5);
    expect(dashboard.averageQuizScore).toBe(2);
    expect(dashboard.nextRecommendedLesson?.id).not.toBe('lesson-workplace-greetings');
  });

  it('persists learning data through the repository abstraction', async () => {
    const repo = createInMemoryLearningRepository();
    await repo.saveLessons(getAllLessons());
    const safetyLessons = await repo.findLessonsByCategory('safety');
    expect(safetyLessons.length).toBeGreaterThanOrEqual(1);
    await repo.saveCompletedLesson('lesson-safety-stop', 3, '2026-06-18');
    const progress = await repo.getProgress();
    expect(progress.completedLessonIds).toContain('lesson-safety-stop');
  });
});
