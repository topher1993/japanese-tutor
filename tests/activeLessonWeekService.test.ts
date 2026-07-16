import { describe, expect, it } from 'vitest';

import { resolveActivePhraseWeek } from '../src/services/activeLessonWeekService';
import { getDailyLesson, getPhraseLessons } from '../src/services/lessonService';
import { createInitialProgress } from '../src/services/progressService';

const emptyProgress = () => createInitialProgress('2026-07-14');

describe('placement-aware active lesson week', () => {
  it.each([
    ['N4' as const, 'N4' as const],
    ['N3' as const, 'N3' as const],
    ['N3-or-above' as const, 'N3' as const],
  ])('starts a new %s learner at the first %s phrase week', (placement, courseLevel) => {
    const expectedWeek = getPhraseLessons().find(lesson => lesson.level === courseLevel)?.week;
    expect(expectedWeek).toBeDefined();
    expect(resolveActivePhraseWeek(emptyProgress(), placement)).toBe(expectedWeek);
  });

  it('keeps an unplaced learner on the N5 starting week', () => {
    const expectedWeek = getPhraseLessons().find(lesson => lesson.level === 'N5')?.week;
    expect(resolveActivePhraseWeek(emptyProgress())).toBe(expectedWeek);
  });

  it('does not label a skipped, empty prior week as completed', () => {
    expect(getDailyLesson(emptyProgress(), 'N4').isWeekPreview).toBe(false);
    expect(getDailyLesson(emptyProgress(), 'N3').isWeekPreview).toBe(false);
  });
});
