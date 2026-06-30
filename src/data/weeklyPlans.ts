import type { WeekPlan } from '../types/weeklyTodo';
import { mockSenseiLessons } from './mockSenseiLessons';

// Phase 37b ships ONLY the N5 week 1 plan, with exactly one `lesson`-kind
// todo. Authored by hand per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37b step 2. The `lessonIds` are looked up from the actual lesson
// data module — never invented — so the gate verifier can cross-check against
// getAllLessons() at runtime.

const N5_WEEK_1_LESSON_IDS = mockSenseiLessons
  .filter(lesson => lesson.level === 'N5' && lesson.week === 1)
  .map(lesson => lesson.id);

export const WEEKLY_PLANS: WeekPlan[] = [
  {
    weekNumber: 1,
    passingStrategy: 'all',
    todos: [
      {
        id: 'n5-w1-lessons',
        kind: 'lesson',
        title: 'Complete every Week 1 lesson',
        // §11.2: target = lessonIds.length (every listed lesson complete).
        target: N5_WEEK_1_LESSON_IDS.length,
        unit: 'lessons',
        lessonIds: [...N5_WEEK_1_LESSON_IDS],
      },
      // Phase 37d-1: a daily-rush todo so end-to-end recompute can be
      // exercised against a real todo of this kind. Inactive while
      // todoFeatureEnabled stays false (37g flip); even when the gate UI
      // appears in 37c, adding this todo does not change learner-visible
      // behavior — the current lesson todo is still the gate.
      {
        id: 'n5-w1-daily-rush',
        kind: 'daily-rush',
        title: 'Complete one Daily Flashcard Rush',
        // §5 row `daily-rush`: target = 1. The recompute helper flips this
        // todo to progress=1 once any date appears in
        // todoEventCounts.dailyRushDates[1].
        target: 1,
        unit: 'rush',
      },
    ],
  },
];
