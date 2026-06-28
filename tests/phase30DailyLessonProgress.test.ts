import { describe, expect, it } from 'vitest';

import { getDailyLesson, getAllLessons } from '../src/services/lessonService';
import { buildLessonProgression } from '../src/services/lessonProgressionService';
import { buildProgressDashboard } from '../src/services/progressDashboardService';
import { completeLesson, createInitialProgress } from '../src/services/progressService';
import type { LearnerProgress } from '../src/types/progress';

/**
 * Phase 30 — Daily lesson progress visibility.
 *
 * Why this exists (2026-06-28, post-Phase 29 phone QA):
 *   The "Daily Lesson" screen always showed Week 1 Day 1 regardless of how
 *   many lessons the learner had completed. The Lessons screen header also
 *   always read "Week 1 of 12". Learners had no way to tell whether they
 *   had finished a week or how far they were through the current one.
 *
 * Root cause:
 *   - `getDailyLesson()` returned a hardcoded `mockSenseiLessons[0]`.
 *   - `buildLessonProgression()` always started at week 1.
 *   - Neither screen consulted `LearnerProgress.completedLessonIds`.
 *
 * Phase 30 fixes the data path:
 *   - `getDailyLesson(progress)` returns the next uncompleted lesson, or
 *     a preview of the next week when the current week is fully done.
 *   - `buildLessonProgression(currentWeek)` honors the caller's chosen
 *     starting week instead of forcing week 1.
 *   - `buildProgressDashboard` keeps its existing "first uncompleted" pick
 *     so screens can show the next recommended lesson.
 *
 * Tests assert:
 *   - With no progress: daily lesson is Week 1 Day 1.
 *   - With progress completing some Week 1 lessons: daily lesson advances
 *     to the next uncompleted Week 1 lesson.
 *   - With all Week 1 lessons completed: daily lesson shows the next week
 *     as a "preview".
 *   - The dashboard's nextRecommendedLesson matches the daily lesson.
 *   - The progression service accepts a non-default starting week.
 */

const ALL_LESSONS = getAllLessons();
const WEEK_1_IDS = ALL_LESSONS.filter((l) => l.week === 1).map((l) => l.id);
const WEEK_2_IDS = ALL_LESSONS.filter((l) => l.week === 2).map((l) => l.id);

function progressWith(completedIds: string[]): LearnerProgress {
  let progress = createInitialProgress('2026-06-28');
  for (const id of completedIds) {
    progress = completeLesson(progress, id, 100, '2026-06-28');
  }
  return progress;
}

describe('Phase 30 daily lesson progress visibility', () => {
  it('returns the first lesson when the learner has no progress', () => {
    const progress = progressWith([]);
    const daily = getDailyLesson(progress);
    expect(daily.lesson.id).toBe(WEEK_1_IDS[0]);
    expect(daily.weekLabel).toContain('Week 1');
    expect(daily.lessonsDoneThisWeek).toBe(0);
    expect(daily.lessonsTotalThisWeek).toBe(WEEK_1_IDS.length);
  });

  it('advances within the current week when some week 1 lessons are done', () => {
    const progress = progressWith(WEEK_1_IDS.slice(0, 2));
    const daily = getDailyLesson(progress);
    expect(daily.lesson.week).toBe(1);
    expect(daily.lesson.id).toBe(WEEK_1_IDS[2]);
    expect(daily.lessonsDoneThisWeek).toBe(2);
    expect(daily.lessonsTotalThisWeek).toBe(WEEK_1_IDS.length);
  });

  it('previews the next week when all lessons in the current week are done', () => {
    const progress = progressWith(WEEK_1_IDS);
    const daily = getDailyLesson(progress);
    expect(daily.lesson.week).toBe(2);
    expect(daily.lesson.id).toBe(WEEK_2_IDS[0]);
    expect(daily.lessonsDoneThisWeek).toBe(0);
    expect(daily.lessonsTotalThisWeek).toBe(WEEK_2_IDS.length);
    expect(daily.isWeekPreview).toBe(true);
  });

  it('matches the dashboard nextRecommendedLesson', () => {
    const progress = progressWith(WEEK_1_IDS.slice(0, 3));
    const daily = getDailyLesson(progress);
    const dashboard = buildProgressDashboard(progress, ALL_LESSONS);
    expect(daily.lesson.id).toBe(dashboard.nextRecommendedLesson?.id);
  });

  it('handles every lesson being completed by returning the last lesson with a "course complete" hint', () => {
    const progress = progressWith(ALL_LESSONS.map((l) => l.id));
    const daily = getDailyLesson(progress);
    expect(daily.isCourseComplete).toBe(true);
    expect(daily.lesson.id).toBe(ALL_LESSONS[ALL_LESSONS.length - 1].id);
  });

  it('buildLessonProgression honors a caller-supplied current week', () => {
    const progression = buildLessonProgression(3);
    expect(progression.currentWeek).toBe(3);
    expect(progression.currentWeekDetails().weekNumber).toBe(3);
  });

  it('progress dashboard reports the right completed-lesson count', () => {
    const progress = progressWith(WEEK_1_IDS.slice(0, 3));
    const dashboard = buildProgressDashboard(progress, ALL_LESSONS);
    expect(dashboard.completedLessons).toBe(3);
    expect(dashboard.totalLessons).toBe(ALL_LESSONS.length);
    expect(dashboard.completionPercent).toBeGreaterThan(0);
    expect(dashboard.nextRecommendedLesson?.id).toBe(WEEK_1_IDS[3]);
  });
});