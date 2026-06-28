/**
 * Phase 25 / P0-3 — FlashcardsScreen uses persistent SRS from context.
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) found that FlashcardsScreen.tsx
 * instantiates a fresh in-memory `createSpacedRepetitionScheduler()` per render
 * (via `useMemo`). `rateCard()` writes only to that in-memory scheduler, so
 * every review the learner makes is lost on cold start — same shape as
 * Phase 22's P0-02 but narrower.
 *
 * This test grep-validates the fix:
 *   1. FlashcardsScreen no longer imports `createSpacedRepetitionScheduler`.
 *   2. FlashcardsScreen no longer uses `useMemo`.
 *   3. FlashcardsScreen reads `srs` from `useLearningContext()`.
 *   4. FlashcardsScreen calls `srs.createCard(...)` for first-rating paths.
 *   5. FlashcardsScreen calls `srs.review(...)` when the user rates a card.
 *   6. FlashcardsScreen uses `srs.dueCount()` (NOT a sync `scheduler.dueCards().length`).
 *   7. FlashcardsScreen re-hydrates the SRS state from durable storage on mount.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const SCREEN = 'src/screens/FlashcardsScreen.tsx';

describe('Phase 25 / P0-3 — FlashcardsScreen persistent SRS', () => {
  const src = readFileSync(SCREEN, 'utf8');

  it('does not import createSpacedRepetitionScheduler', () => {
    // Allow mentions in comments — but the actual `import` line must be gone.
    const importLines = src
      .split('\n')
      .filter((l) => /^\s*import\b/.test(l));
    const offending = importLines.filter((l) =>
      /createSpacedRepetitionScheduler/.test(l),
    );
    expect(offending, `Expected no import of createSpacedRepetitionScheduler; found: ${offending.join(' | ')}`).toHaveLength(0);
  });

  it('does not use useMemo', () => {
    expect(src).not.toMatch(/\buseMemo\b/);
  });

  it('reads srs from useLearningContext()', () => {
    expect(src).toMatch(/const\s*\{\s*[^}]*\bsrs\b[^}]*\}\s*=\s*useLearningContext\(\)/);
  });

  it('calls srs.createCard(refId) for first-rating paths', () => {
    // The exact shape we use: `srs.createCard(card.id)`.
    expect(src).toMatch(/srs\.createCard\(\s*card\.id\s*\)/);
  });

  it('calls srs.review(cardId, rating) when the user rates a card', () => {
    expect(src).toMatch(/srs\.review\(\s*cardId\s*,\s*rating\s*\)/);
  });

  it('reads dueCount from srs.dueCount() (NOT scheduler.dueCards().length)', () => {
    expect(src).toMatch(/srs\.dueCount\(\)/);
    expect(src).not.toMatch(/scheduler\.dueCards\(\)/);
  });

  it('re-hydrates SRS state from durable storage on mount', () => {
    // Specifically: a useEffect that calls `srs.listCards()` (durable SELECT)
    // and sets local state from the result.
    expect(src).toMatch(/srs\.listCards\(\)/);
    // The hydration effect must depend on `srs` so it re-runs when the
    // context value updates from null → ready.
    expect(src).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[^}]*srs\.listCards/m);
  });

  it('does not define a local scheduler anywhere in the file', () => {
    // Catch any leftover `const scheduler = ...` from the old implementation.
    expect(src).not.toMatch(/const\s+scheduler\s*=\s*/);
    // And no `useMemo(() => createSpacedRepetitionScheduler(...))`.
    expect(src).not.toMatch(/useMemo\(\s*\(\)\s*=>\s*createSpacedRepetitionScheduler/);
  });
});
