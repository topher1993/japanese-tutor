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
 *   3. App shell owns the `onReviewDue` callback that sets tab to Flashcards
 *      and flips `dueReviewMode` to true. (Phase 43: ownership moved from
 *      App.tsx into `src/app/useAppNavigation.ts`; the App.tsx "must NOT
 *      contain" assertion below guards against regression.)
 *   4. App shell owns the `dueReviewMode` state and clears it when the user
 *      leaves the Flashcards tab. (Phase 43: same — moved to hook.)
 *   5. App shell passes `dueReviewMode` to FlashcardsScreen via renderTab.
 *   6. FlashcardsScreen accepts the `dueReviewMode` prop.
 *   7. FlashcardsScreen, when `dueReviewMode=true`, filters the deck to only
 *      cards whose SRS row is due (via `dueOn <= today`).
 *   8. The subtitle reflects the active review mode.
 *
 * Phase 43 — App.tsx split: the App shell is now App.tsx + src/app/**.
 * Tests scan both and assert App.tsx itself does NOT re-inline these
 * patterns.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const HOME = 'src/screens/HomeScreen.tsx';
const APP = 'App.tsx';
const NAV_HOOK = 'src/app/useAppNavigation.ts';
const RENDER_TAB = 'src/app/renderTab.tsx';
const SCREEN = 'src/screens/FlashcardsScreen.tsx';

function readAppShell(): string {
  const app = readFileSync(APP, 'utf8');
  const hook = readFileSync(NAV_HOOK, 'utf8');
  const tab = readFileSync(RENDER_TAB, 'utf8');
  return [app, hook, tab].join('\n\n');
}

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

  it('App shell owns the onReviewDue callback (now in src/app/useAppNavigation)', () => {
    const all = readAppShell();
    expect(all).toMatch(/setDueReviewMode\(true\)/);
    expect(all).toMatch(/setTab\(['"]Flashcards['"]\)/);
    // App.tsx itself must NOT contain the inline callback (regression guard).
    const app = readFileSync(APP, 'utf8');
    expect(app).not.toMatch(/setDueReviewMode\(true\)/);
  });

  it('App shell clears dueReviewMode when leaving the Flashcards tab (now in useAppNavigation)', () => {
    const all = readAppShell();
    expect(all).toMatch(/if\s*\(\s*next\s*!==\s*['"]Flashcards['"]\s*\)\s*setDueReviewMode\(false\)/);
    // App.tsx itself must NOT contain the clear logic (regression guard).
    const app = readFileSync(APP, 'utf8');
    expect(app).not.toMatch(/if\s*\(\s*next\s*!==\s*['"]Flashcards['"]\s*\)\s*setDueReviewMode\(false\)/);
  });

  it('App shell passes dueReviewMode to FlashcardsScreen (via renderTab)', () => {
    const all = readAppShell();
    expect(all).toMatch(/dueReviewMode=\{dueReviewMode\}/);
    expect(all).toMatch(/<FlashcardsScreen[^>]*dueReviewMode=\{/);
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
