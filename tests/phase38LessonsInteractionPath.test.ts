import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { getAllLessons } from '../src/services/lessonService';
import { buildLessonInteractionPath } from '../src/services/lessonInteractionPathService';
import { completeLesson, createInitialProgress } from '../src/services/progressService';
import type { LearnerProgress } from '../src/types/progress';

/**
 * Phase 43 — LessonsScreen refactor: the `LessonPathRow` sub-component
 * (which uses `item.primaryActionLabel`) was extracted from
 * `src/screens/LessonsScreen.tsx` to `src/screens/lessons/LessonPathRow.tsx`.
 * The 'Lessons screen renders the current-week path' test now scans both
 * files. A regression guard is added so LessonsScreen.tsx doesn't re-inline
 * the LessonPathRow JSX in the future.
 */
const lessonsSource = readFileSync('src/screens/LessonsScreen.tsx', 'utf8');
const lessonPathRowSource = readFileSync('src/screens/lessons/LessonPathRow.tsx', 'utf8');
const lessonsScreenShell = lessonsSource + '\n\n' + lessonPathRowSource;
const lessons = getAllLessons();
const weekOne = lessons.filter(lesson => lesson.week === 1);

function progressWith(completedIds: string[]): LearnerProgress {
  let progress = createInitialProgress('2026-07-01');
  for (const id of completedIds) {
    progress = completeLesson(progress, id, 100, '2026-07-01');
  }
  return progress;
}

describe('Phase 38 Lessons interaction path', () => {
  it('builds a scalable per-progress lesson path with completed, current, and locked states', () => {
    const progress = progressWith(weekOne.slice(0, 2).map(lesson => lesson.id));

    const path = buildLessonInteractionPath(lessons, progress);

    expect(path.currentLesson?.id).toBe(weekOne[2].id);
    expect(path.currentWeek.week).toBe(1);
    expect(path.currentWeek.completedCount).toBe(2);
    expect(path.currentWeek.totalCount).toBe(weekOne.length);
    expect(path.currentWeek.lessons.map(item => item.state)).toEqual([
      'completed',
      'completed',
      'current',
      'locked',
      'locked',
    ]);
    expect(path.currentWeek.lessons[0].primaryActionLabel).toBe('Review again');
    expect(path.currentWeek.lessons[2].primaryActionLabel).toBe('Resume lesson');
    expect(path.currentWeek.lessons[3].primaryActionLabel).toContain(weekOne[2].title);
  });

  it('moves to the next week when the previous week is finished without hard-coded week state', () => {
    const progress = progressWith(weekOne.map(lesson => lesson.id));

    const path = buildLessonInteractionPath(lessons, progress);

    expect(path.currentLesson?.week).toBe(2);
    expect(path.currentWeek.week).toBe(2);
    expect(path.previousWeekComplete).toBe(true);
    expect(path.currentWeek.completedCount).toBe(0);
    expect(path.currentWeek.lessons[0].state).toBe('current');
  });

  it('keeps completed lessons reviewable after the whole course is finished', () => {
    const progress = progressWith(lessons.map(lesson => lesson.id));

    const path = buildLessonInteractionPath(lessons, progress);

    expect(path.courseComplete).toBe(true);
    expect(path.currentLesson?.id).toBe(lessons[lessons.length - 1].id);
    expect(path.currentWeek.lessons.every(item => item.state === 'completed')).toBe(true);
    expect(path.currentWeek.lessons.every(item => item.primaryActionLabel === 'Review again')).toBe(true);
  });

  it('Lessons continue CTA opens the current lesson without completing it', () => {
    const testIdIndex = lessonsSource.indexOf('testID="learn-continue-button"');
    expect(testIdIndex, 'Continue button missing').toBeGreaterThan(0);
    const continueButtonWindow = lessonsSource.slice(Math.max(0, testIdIndex - 500), testIdIndex + 80);
    expect(continueButtonWindow).toContain('setSelected(dailyLesson.lesson.id)');
    expect(continueButtonWindow).not.toContain('completeCurrentLesson');
    expect(continueButtonWindow).not.toContain('notifyLessonCompleted');
  });

  it('Lessons screen renders the current-week path and uses state-driven review/lock labels', () => {
    // Phase 43: 'item.primaryActionLabel' moved to src/screens/lessons/LessonPathRow.tsx
    expect(lessonsScreenShell).toContain('buildLessonInteractionPath');
    expect(lessonsScreenShell).toContain('Lesson path');
    expect(lessonsScreenShell).toContain('item.primaryActionLabel');
    expect(lessonsScreenShell).toContain('selectedLessonCompleted && nextLesson && nextLessonUnlockedByTodos');
    expect(lessonsScreenShell).toContain('selectedLessonLockedByTodos');
    expect(lessonsScreenShell).toContain('Finish this week’s todos first');
    expect(lessonsScreenShell).toContain('Completed');
    expect(lessonsScreenShell).toContain('item.state === \'locked\'');
    // Regression guard: LessonsScreen.tsx must NOT contain the inline
    // LessonPathRow JSX (it lives in src/screens/lessons/LessonPathRow.tsx now).
    expect(lessonsSource).not.toContain('item.primaryActionLabel');
  });
});
