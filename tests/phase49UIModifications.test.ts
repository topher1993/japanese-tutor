/**
 * Phase 49 — UI/UX modifications locked in by Sensei + Beru reviews.
 *
 * Two changes from the original review:
 *
 * 1. `RatingButtons.tsx` — `Easy` haptic bumped from `'soft'` (selectionAsync,
 *    too subtle on some devices) to `'light'` (impactAsync Light). Beru's
 *    pedagogy review: "Easy's soft haptic is so subtle some devices miss
 *    it — consider impactAsync(Light) so the button always confirms."
 *
 * 2. `FlashcardsScreen.tsx` — dev-only fields in the "Card info" disclosure
 *    (`Card id`, `Category`, raw SM-2 numbers, `Storage` line) gated behind
 *    `__DEV__` so they only appear in dev builds. Sensei's Japanese
 *    correctness review + Beru's pedagogy review both flagged: "raw SM-2
 *    numbers (interval, reps, ease) read as grindy/gamified and pull
 *    focus from the language content." The learner-facing line is now
 *    `Next review in N day(s)` — non-numeric, no ease/reps exposure.
 *
 * These tests are source-contract assertions (per the project's
 * `japanese-tutor-feature-development` SKILL.md §"Source-contract test
 * pattern"). No DOM render required.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO = resolve(__dirname, '..');
const RATING_BUTTONS_PATH = resolve(REPO, 'src/components/RatingButtons.tsx');
const FLASHCARDS_SCREEN_PATH = resolve(REPO, 'src/screens/FlashcardsScreen.tsx');

const ratingSrc = readFileSync(RATING_BUTTONS_PATH, 'utf8');
const flashSrc = readFileSync(FLASHCARDS_SCREEN_PATH, 'utf8');

describe('Phase 49 — UI/UX modifications from Sensei + Beru reviews', () => {
  describe('A. RatingButtons.tsx — Easy haptic bumped from soft to light', () => {
    it('1. RATING_META declares easy.haptic === "light" (not "soft")', () => {
      // The literal mapping must be present, multiline-tolerant regex.
      expect(ratingSrc).toMatch(
        /easy\s*:\s*\{[\s\S]*?haptic\s*:\s*['"]light['"]/,
      );
    });

    it('2. The old "easy: ... haptic: soft" mapping is GONE', () => {
      expect(ratingSrc).not.toMatch(
        /easy\s*:\s*\{[\s\S]*?haptic\s*:\s*['"]soft['"]/,
      );
    });

    it('3. The fireHaptic function still maps "light" to impactAsync Light', () => {
      expect(ratingSrc).toMatch(
        /case\s+['"]light['"]\s*:\s*Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/,
      );
    });
  });

  describe('B. FlashcardsScreen.tsx — dev-only fields gated behind __DEV__', () => {
    it('4. "Card id" line is inside a __DEV__ guard, not at the top level', () => {
      // The literal "Card id: {card.id}" should appear inside an
      // __DEV__-guarded fragment, not as a direct child of the infoList.
      expect(flashSrc).toMatch(
        /typeof\s+__DEV__\s*!==\s*['"]undefined['"]\s*&&\s*__DEV__\s*\?\s*\([\s\S]*?Card\s+id\s*:\s*\{card\.id\}[\s\S]*?\)\s*:\s*null/,
      );
    });

    it('5. "Category" line is inside the __DEV__ guard', () => {
      expect(flashSrc).toMatch(
        /typeof\s+__DEV__\s*!==\s*['"]undefined['"]\s*&&\s*__DEV__\s*\?\s*\([\s\S]*?Category\s*:\s*\{card\.category\}[\s\S]*?\)\s*:\s*null/,
      );
    });

    it('6. The raw SM-2 numbers line is inside the __DEV__ guard', () => {
      // The original "Review: interval {n}d, ... reps, ease {x}" was
      // moved inside the __DEV__ block. The new learner-facing line
      // "Next review in {n} day(s)" is OUTSIDE the guard.
      expect(flashSrc).toMatch(
        /typeof\s+__DEV__\s*!==\s*['"]undefined['"]\s*&&\s*__DEV__\s*\?\s*\([\s\S]*?ease\s*\{srCard\.easeFactor\.toFixed\(2\)\}[\s\S]*?\)\s*:\s*null/,
      );
    });

    it('7. The "Storage" line is inside the __DEV__ guard', () => {
      expect(flashSrc).toMatch(
        /typeof\s+__DEV__\s*!==\s*['"]undefined['"]\s*&&\s*__DEV__\s*\?\s*\([\s\S]*?Storage\s*:\s*\{srs\s*\?\s*['"]persistent[\s\S]*?\)\s*:\s*null/,
      );
    });

    it('8. The learner-facing "Next review in N day(s)" line is OUTSIDE the __DEV__ guard', () => {
      // The "Next review in" line should appear in the infoList BEFORE
      // the __DEV__ guard, not inside it. Verifies that the learner
      // always sees their next review interval in plain language.
      const nextReviewIdx = flashSrc.indexOf('Next review in');
      const devGuardIdx = flashSrc.indexOf('typeof __DEV__');
      expect(nextReviewIdx).toBeGreaterThan(-1);
      expect(devGuardIdx).toBeGreaterThan(-1);
      expect(nextReviewIdx).toBeLessThan(devGuardIdx);
    });
  });

  describe('C. Sensei + Beru review invariants (negative)', () => {
    it('9. The original "Review: interval {n}d, {n} reps, ease {x}" copy is GONE from the learner path', () => {
      // The old learner-facing SM-2 line must not appear as a direct
      // child of the infoList. (It now lives only inside __DEV__.)
      // Match the literal pattern with the original phrasing.
      expect(flashSrc).not.toMatch(
        /Review:\s*interval\s*\{srCard\.intervalDays\}d,\s*\{srCard\.repetitions\}\s*reps,\s*ease\s*\{srCard\.easeFactor\.toFixed\(2\)\}/,
      );
    });

    it('10. JishoLink anchor is still present (Phase 38 helper-language pattern preserved)', () => {
      expect(flashSrc).toContain(
        '<JishoLink japanese={card.japanese} variant="full" testID={`flashcard-jisho-info-${card.id}`} />',
      );
    });
  });
});
