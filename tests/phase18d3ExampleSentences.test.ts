import { describe, expect, it } from 'vitest';

import { getExampleSentenceCandidatePack, getExampleSentencesForApp, getLessonExampleSentencePack } from '../src/data/candidates/exampleSentenceCandidatePack';

describe('Phase 18D-3 example sentence candidate pack', () => {
  it('contains at least 300 example sentence candidates', () => {
    const pack = getExampleSentenceCandidatePack();
    expect(pack.length).toBeGreaterThanOrEqual(300);
  });

  it('has no duplicate Japanese sentences', () => {
    const pack = getExampleSentenceCandidatePack();
    const seen = new Set(pack.map((s) => s.japanese));
    expect(seen.size).toBe(pack.length);
  });

  it('has every entry with required fields and source metadata', () => {
    const pack = getExampleSentenceCandidatePack();
    for (const s of pack) {
      expect(s.japanese.trim().length).toBeGreaterThan(0);
      expect(s.english.trim().length).toBeGreaterThan(0);
      expect(s.source.id.trim().length).toBeGreaterThan(0);
      expect(s.source.license.trim().length).toBeGreaterThan(0);
      expect(s.reviewStatus).toMatch(/^(sensei-review-needed|approved-for-beta)$/);
      expect(s.jlptLevel === 'N5' || s.jlptLevel === 'N4').toBe(true);
    }
  });

  it('marks every candidate entry as candidate-only (lesson examples are added separately for the app screen)', () => {
    const pack = getExampleSentenceCandidatePack();
    for (const s of pack) {
      expect(s.connectedToApp).toBe(false);
    }
  });

  it('adds N4 lesson examples to the app-facing Example sentences source', () => {
    const lessonExamples = getLessonExampleSentencePack();
    const appExamples = getExampleSentencesForApp();
    const n4LessonExamples = lessonExamples.filter(s => s.jlptLevel === 'N4');
    const n4DailyLifeExamples = appExamples.filter(s => s.jlptLevel === 'N4' && s.category === 'daily-life');

    expect(n4LessonExamples).toHaveLength(100);
    expect(n4DailyLifeExamples.length).toBeGreaterThan(0);
    expect(n4DailyLifeExamples.some(s => s.japanese === '毎朝六時に起きて、シャワーを浴びます。')).toBe(true);
    const morningRoutine = n4DailyLifeExamples.find(s => s.japanese === '毎朝六時に起きて、シャワーを浴びます。');
    expect(morningRoutine?.romaji).toBe('maiasa rokuji ni okite, shawaa o abimasu.');
    expect(n4LessonExamples.every(s => s.romaji.trim().length > 0)).toBe(true);
    expect(n4DailyLifeExamples.every(s => s.connectedToApp)).toBe(true);
  });
});