import { describe, expect, it } from 'vitest';

import { getN5KanjiCandidatePack } from '../src/data/candidates/n5KanjiCandidatePack';

describe('Phase 18D-2 large N5 kanji candidate pack', () => {
  it('contains at least 100 N5 kanji candidates', () => {
    const pack = getN5KanjiCandidatePack();
    expect(pack.length).toBeGreaterThanOrEqual(100);
  });

  it('has no duplicate kanji characters', () => {
    const pack = getN5KanjiCandidatePack();
    const seen = new Set(pack.map((k) => k.kanji));
    expect(seen.size).toBe(pack.length);
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