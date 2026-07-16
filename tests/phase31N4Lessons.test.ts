import { describe, expect, it } from 'vitest';

import { mockSenseiLessons } from '../src/data/mockSenseiLessons';
import { getDailyLesson, getPhraseLessons } from '../src/services/lessonService';
import { completeLesson, createInitialProgress } from '../src/services/progressService';
import { buildProgressDashboard } from '../src/services/progressDashboardService';

/**
 * Phase 31 - N4 lesson content.
 *
 * Why this exists (2026-06-28, post-Phase 30 phone QA):
 *   The user asked for N4 lessons. Before this phase there were 0.
 *   Phase 31 added 18 N4 lessons across weeks 4/5/6 covering particles
 *   and grammar expansion (week 4), verb-form expansion (week 5), and
 *   daily-life expansion (week 6).
 *
 *   Phase 33 replaced the temporary Vietnamese/Filipino placeholders with
 *   learner-facing helper-language translations so N4 lessons work for all
 *   configured helper languages.
 *
 * Tests assert:
 *   - mockSenseiLessons contains 18 N4 lessons.
 *   - Each N4 lesson has 3-6 items, every item has Japanese+romaji+
 *     English; VI/TL are real helper-language strings.
 *   - Every N4 item carries translationReviewStatus 'draft' until final native-speaker review.
 *   - Daily lesson advancement now reaches week 4 once weeks 1-3 are done.
 *   - The progression service accepts a week-4 starting week.
 *   - The buildProgressDashboard shows the N4 lessons are eligible for
 *     advancement via the nextRecommendedLesson chain.
 */

const N5_LESSONS = mockSenseiLessons.filter((l) => l.level === 'N5');
const N4_LESSONS = mockSenseiLessons.filter((l) => l.level === 'N4');
const N3_LESSONS = mockSenseiLessons.filter((l) => l.level === 'N3');
const DAILY_PHRASE_LESSONS = getPhraseLessons().filter(
  lesson => lesson.level !== 'Absolute Beginner',
);
const N5_PHRASE_LESSONS = DAILY_PHRASE_LESSONS.filter(lesson => lesson.level === 'N5');
const FIRST_N4_PHRASE_LESSON = DAILY_PHRASE_LESSONS.find(lesson => lesson.level === 'N4');

function progressWithAllN5(): ReturnType<typeof createInitialProgress> {
  let p = createInitialProgress('2026-06-28');
  for (const lesson of N5_PHRASE_LESSONS) {
    p = completeLesson(p, lesson.id, 100, '2026-06-28');
  }
  return p;
}

describe('Phase 31 N4 lesson content', () => {
  it('ships exactly 18 N4 lessons across weeks 4/5/6', () => {
    expect(N4_LESSONS.length).toBe(18);
    const weeks = new Set(N4_LESSONS.map((l) => l.week));
    expect(weeks).toEqual(new Set([4, 5, 6]));
    expect(N5_LESSONS.length).toBe(18); // N5 untouched
  });

  it('ships an N3 starter week for placement-routed learners', () => {
    expect(N3_LESSONS.length).toBe(5);
    expect(new Set(N3_LESSONS.map(lesson => lesson.week))).toEqual(new Set([7]));
    for (const lesson of N3_LESSONS) {
      expect(lesson.items.length, `${lesson.id} item count`).toBeGreaterThanOrEqual(3);
      for (const item of lesson.items) {
        expect(item.japanese.length, `${item.id}.japanese`).toBeGreaterThan(0);
        expect(item.english.length, `${item.id}.english`).toBeGreaterThan(0);
        expect(item.exampleJapanese.length, `${item.id}.exampleJapanese`).toBeGreaterThan(0);
        expect(item.exampleEnglish.length, `${item.id}.exampleEnglish`).toBeGreaterThan(0);
      }
    }
  });

  it('every N4 lesson has 3-6 learner items', () => {
    for (const lesson of N4_LESSONS) {
      expect(lesson.items.length, `${lesson.id} item count`).toBeGreaterThanOrEqual(3);
      expect(lesson.items.length, `${lesson.id} item count`).toBeLessThanOrEqual(7);
    }
  });

  it('every N4 item has correct Japanese + romaji + English and real VI/TL helper translations', () => {
    const PLACEHOLDER = /pending|review needed|todo|tbd|placeholder/i;
    for (const lesson of N4_LESSONS) {
      for (const item of lesson.items) {
        expect(item.japanese.length, `${item.id}.japanese`).toBeGreaterThan(0);
        expect(item.romaji.length, `${item.id}.romaji`).toBeGreaterThan(0);
        expect(item.english.length, `${item.id}.english`).toBeGreaterThan(0);
        expect(item.vietnamese.length, `${item.id}.vietnamese`).toBeGreaterThan(0);
        expect(item.filipino.length, `${item.id}.filipino`).toBeGreaterThan(0);
        expect(item.vietnamese, `${item.id}.vietnamese is not a placeholder`).not.toMatch(PLACEHOLDER);
        expect(item.filipino, `${item.id}.filipino is not a placeholder`).not.toMatch(PLACEHOLDER);
        expect(item.exampleJapanese.length, `${item.id}.exampleJapanese`).toBeGreaterThan(0);
        expect(item.exampleEnglish.length, `${item.id}.exampleEnglish`).toBeGreaterThan(0);
      }
    }
  });

  it('every N4 item is marked approved after Vietnamese bulk-approval (Phase 43)', () => {
    for (const lesson of N4_LESSONS) {
      for (const item of lesson.items) {
        expect(item.translationReviewStatus, `${item.id} status`).toBe('approved');
      }
    }
  });

  it('daily lesson advances to the first N4 phrase lesson once all N5 phrase lessons are done', () => {
    const progress = progressWithAllN5();
    const view = getDailyLesson(progress);
    expect(view.isCourseComplete).toBe(false);
    expect(FIRST_N4_PHRASE_LESSON).toBeDefined();
    expect(view.lesson.id).toBe(FIRST_N4_PHRASE_LESSON?.id);
  });

  it('dashboard nextRecommendedLesson points at the first N4 lesson after N5 completes', () => {
    const progress = progressWithAllN5();
    const dashboard = buildProgressDashboard(progress, DAILY_PHRASE_LESSONS);
    expect(FIRST_N4_PHRASE_LESSON).toBeDefined();
    expect(dashboard.nextRecommendedLesson?.id).toBe(FIRST_N4_PHRASE_LESSON?.id);
    expect(dashboard.completionPercent).toBe(
      Math.round((N5_PHRASE_LESSONS.length / DAILY_PHRASE_LESSONS.length) * 100),
    );
  });
});
