import { describe, expect, it } from 'vitest';

import { getExampleSentenceCandidatePack } from '../src/data/candidates/exampleSentenceCandidatePack';

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

  it('marks every entry as candidate-only (no live app use)', () => {
    const pack = getExampleSentenceCandidatePack();
    for (const s of pack) {
      expect(s.connectedToApp).toBe(false);
    }
  });
});