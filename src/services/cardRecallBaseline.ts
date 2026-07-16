// Phase 51 — Card recall baseline thresholds.
//
// **Phase 51 seeded values.** Different card kinds have different
// expected answer latencies in Daily Rush, so the "memorized" cutoff
// (time ≤ baseline → srs.review q=5) is per-kind rather than a single
// number across the deck.
//
// These values are seed values — chosen from Beru's Q2 guidance:
//   kanji:    3000 ms  (3s — recognition is fast for a single glyph)
//   vocab:    2000 ms  (2s — single reading/meaning lookup is the fastest)
//   sentences: 8000 ms (8s — multi-token parse takes longer)
//
// **Phase 52 telemetry re-seed expected within 4 weeks.** Beru flagged
// this as a Q2 watch-item: once Phase 52 ships real Daily Rush
// telemetry, recompute p50/p75 per kind. If observed p50 diverges
// from the seed by >30%, bump `BASELINE_SEED_VERSION` and replace
// these values. Beru is the owner of the re-seed decision.

/**
 * Phase 51 seed: per-card-kind answer-latency baseline in milliseconds.
 * Used by Daily Rush to decide `recognized` (correct, time > baseline)
 * vs `memorized` (correct, time ≤ baseline).
 *
 * Phase 52 re-seed will overwrite these values; bump
 * `BASELINE_SEED_VERSION` whenever this map changes so downstream
 * telemetry can detect schema-version drift.
 */
export const kanjiByKind: { kanji: number; vocab: number; sentences: number } = {
  kanji: 3000,
  vocab: 2000,
  sentences: 8000,
};

/**
 * Look up the recall baseline (ms) for a given card kind.
 *
 * @param cardKind - The card kind identifier. Recognised values are
 *   `'kanji' | 'vocab' | 'sentences'`. Any other value falls back to
 *   the `vocab` baseline (2s) so unknown card kinds still get a
 *   reasonable cutoff rather than crashing.
 *
 * @returns The baseline in milliseconds.
 */
export function getRecallBaseline(cardKind: 'kanji' | 'vocab' | 'sentences' | string): number {
  if (cardKind === 'kanji') return kanjiByKind.kanji;
  if (cardKind === 'sentences') return kanjiByKind.sentences;
  // Default to the vocab baseline (2s) for both 'vocab' and any
  // unrecognised kind. This keeps new card kinds working without a
  // forced edit here, and keeps the math safe if a future kind
  // arrives ahead of a baseline seed.
  return kanjiByKind.vocab;
}

/**
 * Schema version of the recall-baseline seed table. Bump this whenever
 * `kanjiByKind` values change (e.g. on the Phase 52 telemetry
 * re-seed). Telemetry events carry this so Beru can correlate
 * stage-transition rates with the seed generation in effect.
 */
export const BASELINE_SEED_VERSION = 1;
