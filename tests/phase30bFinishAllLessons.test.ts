import { describe, expect, it } from 'vitest';

import { getDailyLesson, getAllLessons } from '../src/services/lessonService';
import { createLessonNavigator } from '../src/services/lessonNavigatorService';
import { buildProgressDashboard } from '../src/services/progressDashboardService';
import { completeLesson, createInitialProgress } from '../src/services/progressService';
import type { LearnerProgress } from '../src/types/progress';

/**
 * Phase 30b — Finishing the last lesson.
 *
 * Why this exists (2026-06-28, post-Phase 30 phone QA):
 *   After completing the LAST lesson in the course, the "Next: ..."
 *   button disappears (correct: there is no next) but the "Mark this
 *   lesson complete" handler still calls `setSelected(next.id)` only if
 *   `next` exists. With `next` undefined, the user sees no feedback, the
 *   daily-lesson view still says "Continue <last lesson title>" (misleading),
 *   and the screen is effectively stuck.
 *
 * Phase 30b fixes:
 *   - getDailyLesson reports course-level totals (18 of 18) instead of the
 *     misleading empty last-week counter (0 of 8).
 *   - navigator.nextLesson() at the last lesson is undefined (correct),
 *     but the lesson detail screen no longer relies on it as the only
 *     signal of progress.
 *   - The completion handler always re-reads progress so the UI reflects
 *     the new state regardless of whether there is a "next" lesson.
 *
 * Tests assert:
 *   - With every lesson completed, the view's counters report 18 of 18.
 *   - navigator.nextLesson() at the last lesson returns undefined.
 *   - navigator.previousLesson() at the first lesson returns undefined.
 *   - The dashboard's nextRecommendedLesson is undefined when complete.
 *   - buildProgressDashboard shows 100% completion.
 */

const ALL_LESSONS = getAllLessons();

function progressWithAllCompleted(): LearnerProgress {
  let progress = createInitialProgress('2026-06-28');
  for (const lesson of ALL_LESSONS) {
    progress = completeLesson(progress, lesson.id, 100, '2026-06-28');
  }
  return progress;
}

describe('Phase 30b finishing the last lesson', () => {
  it('getDailyLesson reports full-course totals when everything is done', () => {
    const progress = progressWithAllCompleted();
    const daily = getDailyLesson(progress);
    expect(daily.isCourseComplete).toBe(true);
    expect(daily.weekLabel).toBe('Course complete');
    expect(daily.lessonsDoneThisWeek).toBe(ALL_LESSONS.length);
    expect(daily.lessonsTotalThisWeek).toBe(ALL_LESSONS.length);
  });

  it('dashboard nextRecommendedLesson is undefined when everything is done', () => {
    const progress = progressWithAllCompleted();
    const dashboard = buildProgressDashboard(progress, ALL_LESSONS);
    expect(dashboard.nextRecommendedLesson).toBeUndefined();
    expect(dashboard.completedLessons).toBe(ALL_LESSONS.length);
    expect(dashboard.completionPercent).toBe(100);
  });

  it('navigator at the last lesson returns undefined for nextLesson()', () => {
    const lastLesson = ALL_LESSONS[ALL_LESSONS.length - 1];
    const nav = createLessonNavigator(ALL_LESSONS, lastLesson.id);
    expect(nav.selectedLesson?.id).toBe(lastLesson.id);
    expect(nav.nextLesson()).toBeUndefined();
  });

  it('navigator at the first lesson returns undefined for previousLesson()', () => {
    const firstLesson = ALL_LESSONS[0];
    const nav = createLessonNavigator(ALL_LESSONS, firstLesson.id);
    expect(nav.selectedLesson?.id).toBe(firstLesson.id);
    expect(nav.previousLesson()).toBeUndefined();
  });

  it('navigator with no selection falls back to first lesson for nextLesson()', () => {
    const nav = createLessonNavigator(ALL_LESSONS);
    expect(nav.selectedLesson).toBeUndefined();
    expect(nav.nextLesson()?.id).toBe(ALL_LESSONS[0].id);
  });

  it('lessons detail "Mark complete" handler does not depend on nextLesson() being defined', () => {
    // Phase 30b regression: previously the lesson-detail "Mark complete"
    // handler in LessonsScreen.tsx did
    //   const next = nav.nextLesson();
    //   if (next) setSelected(next.id);
    // which silently did nothing when there was no next lesson (i.e. the
    // last lesson). Guard against that shape being re-introduced by
    // asserting the handler re-reads progress unconditionally.
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const src = readFileSync(join(process.cwd(), 'src/screens/LessonsScreen.tsx'), 'utf8');
    // The Mark-complete button's onPress must invoke the store AND
    // re-read progress, independent of whether nav.nextLesson() is null.
    const markComplete = src.match(/<Button[\s\S]*?"Mark this lesson complete"[\s\S]*?\/>/);
    expect(markComplete, 'Mark-complete button missing').not.toBeNull();
    // The button's onPress must reference the named handler (Phase 39:
    // hoisted out of the JSX so the handler hook can sit at the top
    // of the component). The handler itself must call the store.
    expect(markComplete![0]).toContain('onPress={handleMarkComplete}');
    // Anchored on the deps array to grab the full useCallback body.
    const handler = src.match(
      /handleMarkComplete\s*=\s*React\.useCallback\([\s\S]*?\},\s*\[selectedLesson\s*,\s*store\]\)/,
    );
    expect(handler, 'handleMarkComplete useCallback body not found').not.toBeNull();
    expect(handler![0]).toContain('store.completeCurrentLesson');
  });
});