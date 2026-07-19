import { describe, expect, it } from 'vitest';

import { buildKoiLearningSummary } from '../src/features/koi-sensei/integration/learningSummaryBridge';
import type { UserProfile } from '../src/types/userProfile';

const profile: UserProfile = {
  onboarded: true,
  static: {
    supportLanguage: 'tl',
    studyGoal: 'jlpt-prep',
    workplace: null,
    jlptTarget: 'N4',
    dailyStudyMinutes: 10,
    audioStudyDelayMs: 800,
  },
  dynamic: {
    xp: 0,
    streak: { currentStreak: 3, longestStreak: 5 },
    dailyRush: { totalRuns: 0, totalGood: 0, totalAgain: 0, totalXpEarned: 0 },
    placement: { level: 'N4', scorePercent: 70, completedAt: '2026-07-18', testVersion: 'v1' },
  },
  meta: { schemaVersion: 1, createdAt: '2026-07-01', updatedAt: '2026-07-20' },
};

describe('Koi detailed-progress summary', () => {
  it('shares only bounded aggregate learning fields after explicit consent', () => {
    const result = buildKoiLearningSummary({
      revision: 42,
      dueCount: 7,
      now: Date.parse('2026-07-20T12:00:00.000Z'),
      profile,
      progress: {
        startedAt: '2026-07-01',
        completedLessonIds: ['lesson-a', 'lesson-a', 'lesson-b'],
        quizScores: [
          { lessonId: 'lesson-a', score: 40, completedAt: '2026-07-19' },
          { lessonId: 'lesson-b', score: 90, completedAt: '2026-07-20' },
        ],
        streak: { currentStreak: 4, longestStreak: 6, lastStudyDate: '2026-07-20' },
      },
      events: { dailyActivity: { '2026-07-18': {}, '2026-07-20': {} } },
    });

    expect(result).toMatchObject({
      revision: 42,
      supportLanguage: 'tl',
      jlptTarget: 'N4',
      placementLevel: 'N4',
      studyGoalId: 'jlpt-prep',
      dueCount: 7,
      streakDays: 4,
      completionCounts: { lessons: 2, quizzes: 2 },
      masteryBuckets: { mastered: 1, developing: 0, needs_review: 1 },
      recentQuizAverage: 65,
      recentActiveDays: 3,
      weakTopicIds: ['lesson-a'],
    });
    expect(JSON.stringify(result)).not.toContain('answer');
    expect(JSON.stringify(result)).not.toContain('prompt');
  });

  it('caps counters and weak-topic identifiers at the approved contract bounds', () => {
    const result = buildKoiLearningSummary({
      revision: Number.MAX_SAFE_INTEGER,
      dueCount: Number.MAX_SAFE_INTEGER,
      profile: null,
      progress: {
        startedAt: '2026-01-01',
        completedLessonIds: Array.from({ length: 120 }, (_, index) => `lesson-${index}`),
        quizScores: Array.from({ length: 120 }, (_, index) => ({
          lessonId: `lesson-${index}`,
          score: 10,
          completedAt: '2026-07-20',
        })),
        streak: { currentStreak: Number.MAX_SAFE_INTEGER, longestStreak: Number.MAX_SAFE_INTEGER },
      },
      events: {},
    });
    expect(result.dueCount).toBe(100_000);
    expect(result.streakDays).toBe(100_000);
    expect(result.weakTopicIds).toHaveLength(20);
    expect(result.supportLanguage).toBe('en');
  });
});
