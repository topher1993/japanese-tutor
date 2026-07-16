import { describe, expect, it } from 'vitest';

import { getAllLessons, getDailyLesson, getPhraseLessons } from '../src/services/lessonService';
import { buildLessonInteractionPath } from '../src/services/lessonInteractionPathService';
import { lessonsForPlacementLevel, placementLevelToCourseLevel } from '../src/services/placementPathService';
import { createInitialProgress, completeLesson } from '../src/services/progressService';
import type { LearnerProgress } from '../src/types/progress';

function progressWithCompleted(completedLessonIds: string[]): LearnerProgress {
  return {
    ...createInitialProgress('2026-07-14'),
    completedLessonIds,
  };
}

function phraseIds(level: 'Absolute Beginner' | 'N5' | 'N4' | 'N3'): string[] {
  return getPhraseLessons().filter(lesson => lesson.level === level).map(lesson => lesson.id);
}

describe('placement-aware lesson path', () => {
  it('keeps the existing canonical path for learners without a placement result', () => {
    expect(getDailyLesson(createInitialProgress('2026-07-14')).lesson.level).toBe('N5');
    const lessons = lessonsForPlacementLevel(getPhraseLessons(), undefined);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons[0].level).toBe('N5');
    expect(lessons.every(lesson => lesson.level !== 'Absolute Beginner')).toBe(true);
  });

  it('starts an N4 learner at the first N4 lesson', () => {
    const view = getDailyLesson(createInitialProgress('2026-07-14'), 'N4');
    const firstN4Phrase = getPhraseLessons().find(lesson => lesson.level === 'N4');
    expect(view.lesson.level).toBe('N4');
    expect(view.lesson.id).toBe(firstN4Phrase?.id);
  });

  it('starts an absolute beginner on foundation lessons without kanji-first content', () => {
    expect(placementLevelToCourseLevel('absolute-beginner')).toBe('Absolute Beginner');
    const lessons = lessonsForPlacementLevel(getAllLessons(), 'absolute-beginner');
    expect(lessons.length).toBeGreaterThan(0);
    const foundation = lessons.filter(lesson => lesson.level === 'Absolute Beginner');
    expect(foundation.length).toBeGreaterThan(0);
    expect(foundation.every(lesson => lesson.items.every(item => !/[一-龯]/.test(item.japanese)))).toBe(true);
    expect(Array.from(new Set(lessons.map(lesson => lesson.level)))).toEqual([
      'Absolute Beginner',
      'N5',
      'N4',
      'N3',
    ]);
  });

  it('starts N3 and N3-or-above learners on the N3 track', () => {
    expect(placementLevelToCourseLevel('N3')).toBe('N3');
    expect(placementLevelToCourseLevel('N3-or-above')).toBe('N3');
    expect(getDailyLesson(createInitialProgress('2026-07-14'), 'N3').lesson.level).toBe('N3');
    expect(getDailyLesson(createInitialProgress('2026-07-14'), 'N3-or-above').lesson.level).toBe('N3');
  });

  it('advances within the selected level without changing lower-level completion state', () => {
    const n4 = getPhraseLessons().find(lesson => lesson.level === 'N4')!;
    const progress = completeLesson(createInitialProgress('2026-07-14'), n4.id, 100, '2026-07-14');
    const path = buildLessonInteractionPath(getPhraseLessons(), progress, 'N4');
    expect(path.currentLesson?.level).toBe('N4');
    expect(path.currentLesson?.id).not.toBe(n4.id);
    expect(progress.completedLessonIds).toEqual([n4.id]);
  });

  it('treats placement as a starting level and keeps every higher phrase level in order', () => {
    const levelsFor = (placement: 'N5' | 'N4' | 'N3' | 'N3-or-above') => (
      Array.from(new Set(lessonsForPlacementLevel(getPhraseLessons(), placement).map(lesson => lesson.level)))
    );

    expect(levelsFor('N5')).toEqual(['N5', 'N4', 'N3']);
    expect(levelsFor('N4')).toEqual(['N4', 'N3']);
    expect(levelsFor('N3')).toEqual(['N3']);
    expect(levelsFor('N3-or-above')).toEqual(['N3']);
  });

  it('moves an absolute beginner across every curriculum boundary', () => {
    const foundationIds = phraseIds('Absolute Beginner');
    const n5Ids = phraseIds('N5');
    const n4Ids = phraseIds('N4');
    const n3Ids = phraseIds('N3');

    expect(getDailyLesson(progressWithCompleted([]), 'absolute-beginner').lesson.level).toBe('Absolute Beginner');
    expect(getDailyLesson(progressWithCompleted(foundationIds), 'absolute-beginner').lesson.level).toBe('N5');
    expect(getDailyLesson(progressWithCompleted([...foundationIds, ...n5Ids]), 'absolute-beginner').lesson.level).toBe('N4');
    expect(getDailyLesson(progressWithCompleted([...foundationIds, ...n5Ids, ...n4Ids]), 'absolute-beginner').lesson.level).toBe('N3');

    const complete = getDailyLesson(
      progressWithCompleted([...foundationIds, ...n5Ids, ...n4Ids, ...n3Ids]),
      'absolute-beginner',
    );
    expect(complete.isCourseComplete).toBe(true);
    expect(complete.lessonsDoneThisWeek).toBe(complete.lessonsTotalThisWeek);
  });

  it('moves placed N5 and N4 learners into the next higher level', () => {
    const n5Ids = phraseIds('N5');
    const n4Ids = phraseIds('N4');

    expect(getDailyLesson(progressWithCompleted(n5Ids), 'N5').lesson.level).toBe('N4');
    expect(getDailyLesson(progressWithCompleted([...n5Ids, ...n4Ids]), 'N5').lesson.level).toBe('N3');
    expect(getDailyLesson(progressWithCompleted(n4Ids), 'N4').lesson.level).toBe('N3');

    const n4Path = buildLessonInteractionPath(getPhraseLessons(), progressWithCompleted(n4Ids), 'N4');
    expect(n4Path.courseComplete).toBe(false);
    expect(n4Path.currentLesson?.level).toBe('N3');
  });

  it('keeps explicit single-level review catalogs available independently of placement', () => {
    for (const level of ['Absolute Beginner', 'N5', 'N4', 'N3'] as const) {
      const reviewLessons = getPhraseLessons().filter(lesson => lesson.level === level);
      expect(reviewLessons.length).toBeGreaterThan(0);
      expect(reviewLessons.every(lesson => lesson.level === level)).toBe(true);
    }
  });
});
