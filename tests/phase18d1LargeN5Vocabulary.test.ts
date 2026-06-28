import { describe, expect, it } from 'vitest';

import { getN5VocabularyCandidatePack } from '../src/data/candidates/n5VocabularyCandidatePack';

describe('Phase 18D-1 large N5 vocabulary candidate pack', () => {
  it('contains at least 500 N5 vocabulary candidates', () => {
    const pack = getN5VocabularyCandidatePack();
    expect(pack.length).toBeGreaterThanOrEqual(500);
  });

  it('has no duplicate Japanese surface forms', () => {
    const pack = getN5VocabularyCandidatePack();
    const japanese = pack.map((entry) => entry.japanese);
    expect(new Set(japanese).size).toBe(pack.length);
  });

  it('has every entry with required learner fields and source metadata', () => {
    const pack = getN5VocabularyCandidatePack();
    for (const entry of pack) {
      expect(entry.japanese.trim().length).toBeGreaterThan(0);
      expect(entry.kana.trim().length).toBeGreaterThan(0);
      expect(entry.romaji.trim().length).toBeGreaterThan(0);
      expect(entry.english.trim().length).toBeGreaterThan(0);
      expect(entry.source.id.trim().length).toBeGreaterThan(0);
      expect(entry.source.license.trim().length).toBeGreaterThan(0);
      expect(entry.reviewStatus).toMatch(/^(sensei-review-needed|approved-for-beta)$/);
    }
  });

  it('marks Vietnamese and Filipino translations as pending when not reviewed', () => {
    const pack = getN5VocabularyCandidatePack();
    const sample = pack[0];
    expect(sample.vietnamese.includes('pending')).toBe(true);
    expect(sample.filipino.includes('pending')).toBe(true);
  });
});