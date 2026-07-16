import { describe, expect, it } from 'vitest';
import {
  buildDailyTodoBoard,
  calculateStudyStreak,
  COURSE_COMPLETE_DAILY_TODO_DEFINITIONS,
  localDateKey,
  scaleDailyTodoTarget,
} from '../src/services/dailyTodoService';

describe('dailyTodoService', () => {
  it('scales weekly requirements from the daily plan and caps sparse content', () => {
    expect(scaleDailyTodoTarget('daily-rush')).toBe(7);
    expect(scaleDailyTodoTarget('flashcards')).toBe(35);
    expect(scaleDailyTodoTarget('lesson', 5)).toBe(5);
  });

  it('starts a fresh daily board with all focused tasks open', () => {
    const board = buildDailyTodoBoard('2026-07-11', undefined);
    expect(board.totalCount).toBe(3);
    expect(board.completedCount).toBe(0);
    expect(board.allDone).toBe(false);
    expect(board.todos.map(todo => todo.progress)).toEqual([0, 0, 0]);
  });

  it('marks today lesson, rush, and flashcards from date-scoped activity', () => {
    const board = buildDailyTodoBoard(
      '2026-07-11',
      {
        lessonIds: ['lesson-1'],
        dailyRushCompleted: true,
        flashcardReviewIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      },
    );
    expect(board.completedCount).toBe(3);
    expect(board.allDone).toBe(true);
    expect(board.todos.map(todo => todo.helperText)).toEqual([
      'Done — 1 / 1 lesson',
      'Done — 1 / 1 rush',
      'Done — 5 / 5 cards',
    ]);
  });

  it('does not carry yesterday activity into today', () => {
    const board = buildDailyTodoBoard('2026-07-12', undefined);
    expect(board.completedCount).toBe(0);
    expect(board.allDone).toBe(false);
  });

  it('replaces an impossible lesson goal with a quiz after course completion', () => {
    const board = buildDailyTodoBoard(
      '2026-07-12',
      { quizCompleted: true, dailyRushCompleted: true, flashcardReviewIds: ['a', 'b', 'c', 'd', 'e'] },
      COURSE_COMPLETE_DAILY_TODO_DEFINITIONS,
    );
    expect(board.todos.map(status => status.todo.kind)).toEqual(['quiz', 'daily-rush', 'flashcards']);
    expect(board.allDone).toBe(true);
  });

  it('counts every intentional practice mode toward a local-calendar study streak', () => {
    const streak = calculateStudyStreak({
      '2026-07-08': { lessonIds: ['lesson-1'] },
      '2026-07-09': { dailyRushCompleted: true },
      '2026-07-10': { flashcardReviewIds: ['card-1'] },
      '2026-07-11': { quizCompleted: true },
      '2026-07-12': { sentenceLabReviewIds: ['sentence-1'] },
    }, new Date(2026, 6, 12, 12));
    expect(streak).toEqual({ currentStreak: 5, longestStreak: 5 });
  });

  it('keeps yesterday active but resets a streak after a missed day', () => {
    expect(calculateStudyStreak(
      { '2026-07-10': { quizCompleted: true }, '2026-07-11': { quizCompleted: true } },
      new Date(2026, 6, 12, 12),
    ).currentStreak).toBe(2);
    expect(calculateStudyStreak(
      { '2026-07-09': { quizCompleted: true }, '2026-07-10': { quizCompleted: true } },
      new Date(2026, 6, 12, 12),
    ).currentStreak).toBe(0);
  });

  it('uses the learner local calendar date instead of UTC rollover', () => {
    const localMidnight = new Date(2026, 6, 11, 0, 30, 0);
    expect(localDateKey(localMidnight)).toBe('2026-07-11');
  });
});
