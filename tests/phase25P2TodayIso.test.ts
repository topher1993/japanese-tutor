/**
 * Phase 25 / P2-1 — Hardcoded flashcard due dates → todayIso().
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) found that the flashcard data layer
 * hardcoded `'2026-06-18'` and `'2026-06-24'` for `nextReviewDate`. Every
 * fresh-install card was either due or not-due on a fixed past date relative
 * to wall-clock time, which made SRS math meaningless.
 *
 * This test grep-validates the fix:
 *   1. flashcardService.ts has no hardcoded `2026-06-XX` nextReviewDate literals.
 *   2. flashcardService.ts computes todayIso() and uses it for nextReviewDate.
 *   3. candidateFlashcardAdapter.ts has no hardcoded `2026-06-XX` nextReviewDate literals.
 *   4. candidateFlashcardAdapter.ts uses the computed today for nextReviewDate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FLASH = 'src/services/flashcardService.ts';
const CAND = 'src/services/candidateFlashcardAdapter.ts';

describe('Phase 25 / P2-1 — Hardcoded flashcard due dates removed', () => {
  it('flashcardService.ts has no hardcoded 2026-06-XX nextReviewDate literal', () => {
    const src = readFileSync(FLASH, 'utf8');
    expect(src).not.toMatch(/nextReviewDate:\s*['"]2026-06-\d{2}['"]/);
  });

  it('flashcardService.ts defines and uses todayIso()', () => {
    const src = readFileSync(FLASH, 'utf8');
    expect(src).toMatch(/function\s+todayIso\s*\(\s*\)/);
    expect(src).toMatch(/nextReviewDate:\s*today\b/);
  });

  it('candidateFlashcardAdapter.ts has no hardcoded 2026-06-XX nextReviewDate literal', () => {
    const src = readFileSync(CAND, 'utf8');
    expect(src).not.toMatch(/nextReviewDate:\s*['"]2026-06-\d{2}['"]/);
  });

  it('candidateFlashcardAdapter.ts uses the computed today for nextReviewDate', () => {
    const src = readFileSync(CAND, 'utf8');
    expect(src).toMatch(/function\s+todayIso\s*\(\s*\)/);
    expect(src).toMatch(/nextReviewDate:\s*today\b/);
  });
});
