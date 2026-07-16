/**
 * Phase 51 — telemetry event source-contract tests.
 *
 * Verifies the 4 new AnalyticsEvent variants that ship with the
 * interactional-card-stages feature:
 *   card_flipped_back
 *   card_stage_advanced
 *   card_skipped
 *   card_session_capped
 *
 * Style: source-contract grep. Phase 50 lesson — these tests should
 * validate the SHAPE of the change, not re-implement SM-2.
 *
 * See skill: devops/jt-interactional-card-stages/SKILL.md §Telemetry
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ANALYTICS = 'src/services/analyticsService.ts';
const FLASHCARDS = 'src/screens/FlashcardsScreen.tsx';
const RUSH = 'src/screens/DailyRushScreen.tsx';
const NEW_EVENTS = ['card_flipped_back', 'card_stage_advanced', 'card_skipped', 'card_session_capped'];

describe('Phase 51 — AnalyticsEvent union has the 4 new variants', () => {
  for (const event of NEW_EVENTS) {
    it(`union member "${event}"`, () => {
      const text = readFileSync(ANALYTICS, 'utf8');
      // The event name appears inside a single-quoted union literal — either
      // as a type-arm or as an event-emitter match key.
      const pattern = new RegExp(`['"\`]${event}['"\`]`);
      expect(text).toMatch(pattern);
    });
  }
});

describe('Phase 51 — AnalyticsEvent union type annotation', () => {
  it('the AnalyticsEvent type includes "card_flipped_back" alongside "srs_session_summary"', () => {
    const text = readFileSync(ANALYTICS, 'utf8');
    // Both srs_session_summary (Phase 50) and card_flipped_back (Phase 51) live in the same union.
    expect(text).toMatch(/['"`]srs_session_summary['"`]/);
    expect(text).toMatch(/['"`]card_flipped_back['"`]/);
  });
});

describe('Phase 51 — FlashcardsScreen source usage', () => {
  it('imports track from analyticsService', () => {
    const text = readFileSync(FLASHCARDS, 'utf8');
    expect(text).toMatch(/import\s+\{\s*track\s*\}\s+from\s+['"`]\.\.\/services\/analyticsService['"`]/);
  });

  it('emits at least one of the new card events (card_flipped_back or card_skipped)', () => {
    const text = readFileSync(FLASHCARDS, 'utf8');
    const flippedBack = /track\(\s*['"`]card_flipped_back['"`]/.test(text);
    const skipped = /track\(\s*['"`]card_skipped['"`]/.test(text);
    expect(flippedBack || skipped).toBe(true);
  });

  it('exposes an explicit not-yet action for the lapse handler', () => {
    const text = readFileSync(FLASHCARDS, 'utf8');
    expect(text).toMatch(/function\s+markDidNotKnow/);
    expect(text).toMatch(/label="Not yet"[^>]+onPress=\{markDidNotKnow\}/);
    expect(text).toMatch(/srs\.review\([^)]*['"]again['"]/);
    expect(text).toMatch(/answerFlashcard\(currentDeck!, card\.id, ['"]again['"]/);
    expect(text).toContain('await store.recordFlashcardReview(weekNumber, card.id)');
    expect(text).toContain('resolveActivePhraseWeek(progress, placementLevel)');
    expect(text).toContain('finishRatedAction(pendingWrites)');
    expect(text).toContain('ratingAdvanceTimerRef.current = setTimeout');
  });
});

describe('Phase 51 — DailyRushScreen source usage', () => {
  it('imports track from analyticsService', () => {
    const text = readFileSync(RUSH, 'utf8');
    expect(text).toMatch(/import\s+\{\s*track\s*\}\s+from\s+['"`]\.\.\/services\/analyticsService['"`]/);
  });

  it('emits card_stage_advanced', () => {
    const text = readFileSync(RUSH, 'utf8');
    expect(text).toMatch(/track\(\s*['"`]card_stage_advanced['"`]/);
  });

  it('emits card_session_capped (Beru Q6 mod)', () => {
    const text = readFileSync(RUSH, 'utf8');
    expect(text).toMatch(/track\(\s*['"`]card_session_capped['"`]/);
  });

  it('defines the 20-card seen-pool cap constant', () => {
    const text = readFileSync(RUSH, 'utf8');
    expect(text).toMatch(/DAILY_RUSH_SEEN_POOL_CAP/);
  });

  it('imports getRecallBaseline from the baselines service', () => {
    const text = readFileSync(RUSH, 'utf8');
    expect(text).toMatch(/getRecallBaseline/);
  });
});
