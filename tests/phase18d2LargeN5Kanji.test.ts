import { describe, expect, it } from 'vitest';

import { getN5KanjiCandidatePack } from '../src/data/candidates/n5KanjiCandidatePack';

describe('Phase 18D-2 N5 kanji candidate pack (Phase 29 split: vocab moved out)', () => {
  // Phase 29 split: 81 multi-character compounds (学校, 仕事, 会社, 時間,
  // 今日, ...) that used to be in this pack were moved to
  // n5VocabularyCandidateData.ts. The kanji pack now contains only real
  // single CJK characters; the vocab pack owns words/phrases.
  it('contains 78 single-kanji N5 candidates (post-Phase 29 split)', () => {
    const pack = getN5KanjiCandidatePack();
    expect(pack.length).toBe(78);
  });

  it('has no duplicate kanji characters', () => {
    const pack = getN5KanjiCandidatePack();
    const seen = new Set(pack.map((k) => k.kanji));
    expect(seen.size).toBe(pack.length);
  });

  it('every entry is a single CJK character (no compounds/words)', () => {
    const pack = getN5KanjiCandidatePack();
    for (const k of pack) {
      expect(k.kanji.length).toBe(1);
      expect(k.kanji).toMatch(/[\u3400-\u9fff]/);
    }
  });

  it('has every entry with required fields and source metadata', () => {
    const pack = getN5KanjiCandidatePack();
    for (const k of pack) {
      expect(k.kanji.trim().length).toBeGreaterThan(0);
      expect(k.meanings.length).toBeGreaterThan(0);
      expect(k.romaji.trim().length).toBeGreaterThan(0);
      expect(k.source.id.trim().length).toBeGreaterThan(0);
      expect(k.source.license.trim().length).toBeGreaterThan(0);
      expect(['sensei-review-needed', 'approved-for-beta']).toContain(k.reviewStatus);
      expect(k.jlptLevel).toBe('N5');
    }
  });

  it('marks Vietnamese and Filipino translations as pending', () => {
    const pack = getN5KanjiCandidatePack();
    expect(pack[0].vietnamese).toContain('pending');
    expect(pack[0].filipino).toContain('pending');
  });
});