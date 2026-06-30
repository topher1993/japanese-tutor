/**
 * Phase 37d-5 — view-tracking debounce + per-sentence selector for the
 * ExampleSentencesScreen. Lives in a dedicated module (rather than inline
 * in the screen component) so the pure helper can be unit-tested without
 * pulling in the React Native module graph — importing the .tsx screen
 * directly from a vitest test triggers a rolldown parse failure on
 * react-native's Flow-typed `index.js`.
 */

/**
 * View-tracking debounce window (ms). The store already de-dupes
 * identical sentence ids, but we still throttle per-sentence at the
 * call site so flurries (filter change → scroll re-renders the same
 * sentence card 20× in 100ms) don't queue up redundant async work
 * against the SQLite handle.
 */
export const EXAMPLE_VIEW_DEBOUNCE_MS = 2000;

/**
 * Pure helper that decides which sentenceIds should be reported to the
 * store on a given render. Inputs are the currently filtered sentence
 * list, the per-sentence "last reported" timestamp map (mutated in
 * place), and `now` (ms). Returns the subset of sentenceIds whose last
 * reported timestamp is missing or older than EXAMPLE_VIEW_DEBOUNCE_MS.
 * Used by ExampleSentencesScreen's view-tracking effect.
 */
export function pickReportableSentenceIds(
  filtered: ReadonlyArray<{ id: string }>,
  lastReportedAt: Map<string, number>,
  now: number,
): string[] {
  const reported: string[] = [];
  for (const sentence of filtered) {
    const last = lastReportedAt.get(sentence.id);
    if (last != null && now - last < EXAMPLE_VIEW_DEBOUNCE_MS) continue;
    lastReportedAt.set(sentence.id, now);
    reported.push(sentence.id);
  }
  return reported;
}