import { describe, expect, it } from 'vitest';
import { completeLesson, calculateNextStreak, createInitialProgress } from '../src/services/progressService';

describe('progress and streak service', () => {
  it('records completed lessons and quiz score history', () => {
    const progress = completeLesson(createInitialProgress('2026-06-18'), 'lesson-workplace-greetings', 4, '2026-06-18');
    expect(progress.completedLessonIds).toContain('lesson-workplace-greetings');
    expect(progress.quizScores[0]).toMatchObject({ lessonId: 'lesson-workplace-greetings', score: 4 });
  });

  it('increments streak on consecutive study days', () => {
    expect(calculateNextStreak({ currentStreak: 2, longestStreak: 5, lastStudyDate: '2026-06-17' }, '2026-06-18')).toMatchObject({ currentStreak: 3, longestStreak: 5 });
  });

  it('resets streak after a missed day', () => {
    expect(calculateNextStreak({ currentStreak: 4, longestStreak: 4, lastStudyDate: '2026-06-15' }, '2026-06-18')).toMatchObject({ currentStreak: 1, longestStreak: 4 });
  });
});
