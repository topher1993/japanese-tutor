import { describe, expect, it } from 'vitest';
import { createFakeSqliteDatabase } from './support/fakeSqliteDatabase';
import { createSqliteLearningRepository } from '../src/repositories/sqliteLearningRepository';
import { getAllLessons } from '../src/services/lessonService';
import { createLessonNavigator } from '../src/services/lessonNavigatorService';
import { createPracticeProgressStore } from '../src/services/practiceProgressStore';
import { createFlashcardDeck, filterFlashcardsByCategory, getFlashcardStudySummary } from '../src/services/flashcardService';
import { createQuizSession, answerCurrentQuestion, getCurrentQuestion, getQuizSessionProgress } from '../src/services/quizSessionService';
import { localDateKey } from '../src/services/dailyTodoService';

describe('Phase 4 persistence and practice systems', () => {
  it('persists lessons and progress through a SQLite-style repository', async () => {
    const db = createFakeSqliteDatabase();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    expect((await repo.getLessons()).length).toBeGreaterThanOrEqual(5);
    expect((await repo.findLessonsByCategory('safety')).map(lesson => lesson.id)).toContain('lesson-safety-stop');
    await repo.saveCompletedLesson('lesson-safety-stop', 3, '2026-06-18');
    const progress = await repo.getProgress();
    expect(progress.completedLessonIds).toContain('lesson-safety-stop');
    expect(progress.streak.currentStreak).toBe(1);
  });

  it('supports lesson list/detail navigation without losing selected lesson', () => {
    const navigator = createLessonNavigator(getAllLessons());
    expect(navigator.list().length).toBeGreaterThanOrEqual(5);
    const opened = navigator.open('lesson-schedule-time');
    expect(opened.selectedLesson?.title).toContain('Schedule');
    expect(opened.nextLesson()?.id).toBe('lesson-emergency');
    expect(opened.previousLesson()?.id).toBe('lesson-asking-help');
  });

  it('filters flashcards by category and summarizes due cards', () => {
    const deck = createFlashcardDeck(getAllLessons());
    const safety = filterFlashcardsByCategory(deck, 'safety');
    expect(safety.every(card => card.category === 'safety')).toBe(true);
    // Phase 25 / P2-1: cards now use todayIso() so query the summary for today.
    const today = localDateKey();
    const summary = getFlashcardStudySummary(deck, today);
    expect(summary.totalCards).toBe(deck.cards.length);
    expect(summary.dueToday).toBe(deck.cards.length);
    expect(summary.categories).toContain('safety');
  });

  it('reports interactive quiz question progress while answering', () => {
    let session = createQuizSession();
    expect(getQuizSessionProgress(session)).toMatchObject({ current: 1, answered: 0 });
    const first = getCurrentQuestion(session)!;
    session = answerCurrentQuestion(session, first.correctChoice);
    expect(getQuizSessionProgress(session)).toMatchObject({ current: 2, answered: 1 });
    expect(getCurrentQuestion(session)?.id).not.toBe(first.id);
  });

  it('saves practice progress through the repository-backed store', async () => {
    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    await repo.saveLessons(getAllLessons());
    const store = createPracticeProgressStore(repo);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    await store.completeCurrentLesson('lesson-workplace-greetings', 2, localDateKey(yesterday));
    await store.completeCurrentLesson('lesson-safety-stop', 3, localDateKey(today));
    const dashboard = await store.getDashboard();
    expect(dashboard.completedLessons).toBe(2);
    expect(dashboard.currentStreak).toBe(2);
    expect(dashboard.nextRecommendedLesson?.id).toBe('lesson-asking-help');
  });
});
