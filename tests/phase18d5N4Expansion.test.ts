import { describe, expect, it } from 'vitest';

import { getN4VocabularyCandidatePack, getN4KanjiCandidatePack } from '../src/data/candidates/n4CandidatePack';

describe('Phase 18D-5 N4 candidate expansion', () => {
  it('contains at least 600 N4 vocabulary candidates', () => {
    const pack = getN4VocabularyCandidatePack();
    expect(pack.length).toBeGreaterThanOrEqual(600);
  });

  it('contains at least 150 N4 kanji candidates', () => {
    const pack = getN4KanjiCandidatePack();
    expect(pack.length).toBeGreaterThanOrEqual(150);
  });

  it('N4 vocabulary entries have required fields and review status', () => {
    const pack = getN4VocabularyCandidatePack();
    for (const entry of pack) {
      expect(entry.japanese.trim().length).toBeGreaterThan(0);
      expect(entry.kana.trim().length).toBeGreaterThan(0);
      expect(entry.english.trim().length).toBeGreaterThan(0);
      expect(entry.source.id.trim().length).toBeGreaterThan(0);
      expect(entry.reviewStatus).toMatch(/^(sensei-review-needed|approved-for-beta)$/);
      expect(entry.level).toBe('N4');
    }
  });

  it('N4 kanji entries have required fields and review status', () => {
    const pack = getN4KanjiCandidatePack();
    for (const k of pack) {
      expect(k.kanji.trim().length).toBeGreaterThan(0);
      expect(k.meanings.length).toBeGreaterThan(0);
      expect(k.jlptLevel).toBe('N4');
      expect(['sensei-review-needed', 'approved-for-beta']).toContain(k.reviewStatus);
    }
  });
});