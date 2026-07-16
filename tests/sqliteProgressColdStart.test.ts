import { describe, expect, it } from 'vitest';
import { createSqliteLearningRepository, type ExtendedLearnerProgress } from '../src/repositories/sqliteLearningRepository';
import { createFakeSqliteDatabase } from './support/fakeSqliteDatabase';

describe('SQLite learner-progress cold-start hydration', () => {
  it('reconstructs quiz history and streaks from persisted completion rows', async () => {
    const database = createFakeSqliteDatabase();
    const firstSession = createSqliteLearningRepository(database);
    await firstSession.initialize();

    await firstSession.saveCompletedLesson('lesson-1', 80, '2026-07-10');
    await firstSession.saveCompletedLesson('lesson-2', 90, '2026-07-11');
    await firstSession.saveCompletedLesson('lesson-3', 70, '2026-07-11');
    const extended = await firstSession.getProgress() as ExtendedLearnerProgress;
    await firstSession.saveExtendedProgress?.({
      ...extended,
      todoStates: { 'week-1': { progress: 3 } },
      weekTodosInitialized: { 1: true },
      todoEventCounts: { dailyActivity: { '2026-07-11': { quizCompleted: true } } },
      weeklyReviewCompletions: [{ weekIso: '2026-W28' }],
    });

    const secondSession = createSqliteLearningRepository(database);
    const reloaded = await secondSession.getProgress() as ExtendedLearnerProgress;

    expect(reloaded.completedLessonIds).toEqual(['lesson-1', 'lesson-2', 'lesson-3']);
    expect(reloaded.quizScores).toEqual([
      { lessonId: 'lesson-1', score: 80, completedAt: '2026-07-10' },
      { lessonId: 'lesson-2', score: 90, completedAt: '2026-07-11' },
      { lessonId: 'lesson-3', score: 70, completedAt: '2026-07-11' },
    ]);
    expect(reloaded.streak).toEqual({ currentStreak: 2, longestStreak: 2, lastStudyDate: '2026-07-11' });
    expect(reloaded.todoStates).toEqual({ 'week-1': { progress: 3 } });
    expect(reloaded.weeklyReviewCompletions).toEqual([{ weekIso: '2026-W28' }]);
  });

  it('keeps completed IDs from legacy rows that lack score metadata', async () => {
    const database = createFakeSqliteDatabase();
    database.tables?.set('progress', [{
      id: 'legacy', lesson_id: 'legacy-lesson', completed: 1,
      completed_at: null, score: null, todo_states: '{}',
      week_todos_initialized: '{}', todo_event_counts: '{}',
      weekly_review_completions: '[]',
    }]);
    const repository = createSqliteLearningRepository(database);
    const progress = await repository.getProgress();

    expect(progress.completedLessonIds).toEqual(['legacy-lesson']);
    expect(progress.quizScores).toEqual([]);
    expect(progress.streak.currentStreak).toBe(0);
  });
});
