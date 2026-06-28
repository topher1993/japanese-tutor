/**
 * Phase 25 / P1-1 — Real "Review N due cards now" CTA on Home.
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) found that the Home due-card panel
 * was text-only ("Open Flashcards to review them now") — not a real CTA that
 * navigates to Flashcards and pre-filters the deck.
 *
 * This test grep-validates the fix:
 *   1. HomeScreen accepts an `onReviewDue` prop.
 *   2. HomeScreen renders a real `<Button>` with `testID="home-review-due-cta"`.
 *   3. App.tsx owns the `onReviewDue` callback that sets tab to Flashcards and
 *      flips `dueReviewMode` to true.
 *   4. App.tsx owns the `dueReviewMode` state and clears it when the user
 *      leaves the Flashcards tab.
 *   5. App.tsx passes `dueReviewMode` to FlashcardsScreen.
 *   6. FlashcardsScreen accepts the `dueReviewMode` prop.
 *   7. FlashcardsScreen, when `dueReviewMode=true`, filters the deck to only
 *      cards whose SRS row is due (via `dueOn <= today`).
 *   8. The subtitle reflects the active review mode.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const HOME = 'src/screens/HomeScreen.tsx';
const APP = 'App.tsx';
const SCREEN = 'src/screens/FlashcardsScreen.tsx';

describe('Phase 25 / P1-1 — Real "Review N due cards now" CTA on Home', () => {
  it('HomeScreen accepts onReviewDue prop', () => {
    const src = readFileSync(HOME, 'utf8');
    expect(src).toMatch(/onReviewDue\??:\s*\(\)\s*=>\s*void/);
  });

  it('HomeScreen renders a real Button (not just text) for the review CTA', () => {
    const src = readFileSync(HOME, 'utf8');
    expect(src).toMatch(/<Button\b/);
    expect(src).toMatch(/testID="home-review-due-cta"/);
    expect(src).toMatch(/onPress=\{onReviewDue\}/);
    // And the legacy misleading text is gone.
    expect(src).not.toMatch(/Open Flashcards to review them now/);
  });

  it('App.tsx owns the onReviewDue callback that flips to Flashcards + sets dueReviewMode', () => {
    const src = readFileSync(APP, 'utf8');
    expect(src).toMatch(/setDueReviewMode\(true\)/);
    expect(src).toMatch(/setTab\(['"]Flashcards['"]\)/);
  });

  it('App.tsx clears dueReviewMode when leaving the Flashcards tab', () => {
    const src = readFileSync(APP, 'utf8');
    expect(src).toMatch(/if\s*\(\s*next\s*!==\s*['"]Flashcards['"]\s*\)\s*setDueReviewMode\(false\)/);
  });

  it('App.tsx passes dueReviewMode to FlashcardsScreen', () => {
    const src = readFileSync(APP, 'utf8');
    expect(src).toMatch(/<FlashcardsScreen[^>]*dueReviewMode=\{dueReviewMode\}/);
  });

  it('FlashcardsScreen accepts the dueReviewMode prop', () => {
    const src = readFileSync(SCREEN, 'utf8');
    expect(src).toMatch(/dueReviewMode\??:\s*boolean/);
  });

  it('FlashcardsScreen pre-filters the deck when dueReviewMode is true', () => {
    const src = readFileSync(SCREEN, 'utf8');
    expect(src).toMatch(/dueOn\s*<=\s*today/);
    expect(src).toMatch(/dueRefIds\.has\(c\.id\)/);
    expect(src).toMatch(/setActiveDeck\(/);
  });

  it('FlashcardsScreen subtitle reflects the active review mode', () => {
    const src = readFileSync(SCREEN, 'utf8');
    expect(src).toMatch(/Review due now/);
  });
});
