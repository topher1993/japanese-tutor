import { describe, expect, it } from 'vitest';
import { getDailyLesson, getLocalizedLessonItem, getWorkplaceSurvivalTopics } from '../src/services/lessonService';

describe('Sensei-compatible lesson data', () => {
  it('returns a daily lesson with multilingual learner content', () => {
    // Phase 30: getDailyLesson now returns a DailyLessonView; the
    // SenseiLesson itself lives at `.lesson`.
    const view = getDailyLesson();
    expect(view.lesson.title).toContain('Workplace Greetings');
    expect(view.lesson.items.length).toBeGreaterThanOrEqual(3);
    expect(view.lesson.items[0]).toMatchObject({ japanese: expect.any(String), romaji: expect.any(String), english: expect.any(String), vietnamese: expect.any(String), filipino: expect.any(String) });
  });

  it('localizes lesson item explanations by selected support language', () => {
    const item = getDailyLesson().lesson.items[0];
    expect(getLocalizedLessonItem(item, 'vi').supportText).toBe(item.vietnamese);
    expect(getLocalizedLessonItem(item, 'tl').supportText).toBe(item.filipino);
    expect(getLocalizedLessonItem(item, 'en').supportText).toBe(item.english);
  });

  it('includes workplace survival topics for MVP scope', () => {
    const topics = getWorkplaceSurvivalTopics().map(topic => topic.id);
    expect(topics).toContain('safety-instructions');
    expect(topics).toContain('asking-for-help');
    expect(topics).toContain('absence-tardiness');
  });
});
