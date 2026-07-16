/**
 * Phase 51 — card recall baseline (per-kind latency thresholds).
 *
 * Validates the seed values used by Daily Rush to decide
 * `recognized` vs `memorized`:
 *   kanji:    3000 ms
 *   vocab:    2000 ms
 *   sentences: 8000 ms
 *
 * Phase 52 is expected to recompute the seeded baselines from real
 * telemetry (Beru Q2 watch-item). When that lands, bump
 * BASELINE_SEED_VERSION and update the assertions in B1.
 *
 * Style: a mix of source-contract and runtime tests. Runtime tests
 * import the actual module to confirm the export shape.
 *
 * See skill: devops/jt-interactional-card-stages/SKILL.md §Recall
 * baselines; Beru Q2.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const BASELINES = 'src/services/cardRecallBaseline.ts';

describe('Phase 51 — card recall baseline seed values', () => {
  it('A1 — kanji baseline = 3000 ms (3s)', async () => {
    const { kanjiByKind } = await import('../src/services/cardRecallBaseline');
    expect(kanjiByKind.kanji).toBe(3000);
  });

  it('A2 — vocab baseline = 2000 ms (2s)', async () => {
    const { kanjiByKind } = await import('../src/services/cardRecallBaseline');
    expect(kanjiByKind.vocab).toBe(2000);
  });

  it('A3 — sentences baseline = 8000 ms (8s)', async () => {
    const { kanjiByKind } = await import('../src/services/cardRecallBaseline');
    expect(kanjiByKind.sentences).toBe(8000);
  });

  it('A4 — BASELINE_SEED_VERSION is 1', async () => {
    const { BASELINE_SEED_VERSION } = await import('../src/services/cardRecallBaseline');
    expect(BASELINE_SEED_VERSION).toBe(1);
  });
});

describe('Phase 51 — getRecallBaseline() returns the per-kind threshold', () => {
  it('B1 — "kanji" → 3000 ms', async () => {
    const { getRecallBaseline } = await import('../src/services/cardRecallBaseline');
    expect(getRecallBaseline('kanji')).toBe(3000);
  });

  it('B2 — "vocab" → 2000 ms', async () => {
    const { getRecallBaseline } = await import('../src/services/cardRecallBaseline');
    expect(getRecallBaseline('vocab')).toBe(2000);
  });

  it('B3 — "sentences" → 8000 ms', async () => {
    const { getRecallBaseline } = await import('../src/services/cardRecallBaseline');
    expect(getRecallBaseline('sentences')).toBe(8000);
  });

  it('B4 — unknown kind falls back to vocab (2000 ms) — never crashes on new kinds', async () => {
    const { getRecallBaseline } = await import('../src/services/cardRecallBaseline');
    expect(getRecallBaseline('grammar')).toBe(2000);
    expect(getRecallBaseline('')).toBe(2000);
    expect(getRecallBaseline('UNKNOWN_FUTURE_KIND')).toBe(2000);
  });
});

describe('Phase 51 — source-contract JSDoc', () => {
  it('C1 — source file mentions "Phase 51" and "Phase 52" re-seed workflow', () => {
    const text = readFileSync(BASELINES, 'utf8');
    expect(text).toMatch(/Phase 51/);
    expect(text).toMatch(/Phase 52/);
    expect(text).toMatch(/re-seed/i);
  });

  it('C2 — source file documents the per-kind baseline table in a comment block', () => {
    const text = readFileSync(BASELINES, 'utf8');
    // Each kind documented with its millisecond value.
    expect(text).toMatch(/kanji:[\s\S]*?3000/i);
    expect(text).toMatch(/vocab:[\s\S]*?2000/i);
    expect(text).toMatch(/sentences:[\s\S]*?8000/i);
  });
});
