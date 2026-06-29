import { describe, expect, it } from 'vitest';

import { mockSenseiLessons } from '../src/data/mockSenseiLessons';

const JAPANESE_SCRIPT = /[\u3040-\u30ff\u3400-\u9fff]/;
const ROMAJI_SHOULD_NOT_CONTAIN_JAPANESE_SCRIPT = /^[^\u3040-\u30ff\u3400-\u9fff]+$/;

describe('N4 lesson content polish', () => {
  it('keeps N4 learner-facing Japanese fields in Japanese script, not romaji', () => {
    const n4Lessons = mockSenseiLessons.filter(lesson => lesson.level === 'N4');

    expect(n4Lessons.length).toBe(18);

    for (const lesson of n4Lessons) {
      for (const item of lesson.items) {
        expect(item.japanese, `${lesson.id}/${item.id} japanese`).toMatch(JAPANESE_SCRIPT);
        expect(item.exampleJapanese, `${lesson.id}/${item.id} exampleJapanese`).toMatch(JAPANESE_SCRIPT);
      }
    }
  });

  it('keeps N4 romaji fields romanized for beginner reading support', () => {
    const n4Items = mockSenseiLessons
      .filter(lesson => lesson.level === 'N4')
      .flatMap(lesson => lesson.items.map(item => ({ lessonId: lesson.id, item })));

    for (const { lessonId, item } of n4Items) {
      expect(item.romaji, `${lessonId}/${item.id} romaji`).toMatch(ROMAJI_SHOULD_NOT_CONTAIN_JAPANESE_SCRIPT);
    }
  });
});
