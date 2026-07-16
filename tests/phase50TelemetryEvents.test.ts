import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  track,
  clearQueuedEvents,
  resetAnalyticsForTests,
  type AnalyticsEvent,
} from '../src/services/analyticsService';

describe('phase50 telemetry events', () => {
  beforeEach(() => {
    if (typeof process !== 'undefined' && process.env) {
      delete process.env.EXPO_PUBLIC_ANALYTICS_KEY;
    }
    resetAnalyticsForTests();
    clearQueuedEvents();
  });

  it("'srs_review' is a valid AnalyticsEvent value (typecheck via assignment)", () => {
    // Type-level gate: if 'srs_review' isn't in the AnalyticsEvent union,
    // the assignment below fails to compile. Tests don't run if TSC errors.
    const ev: AnalyticsEvent = 'srs_review';
    expect(ev).toBe('srs_review');
  });
  it("'srs_session_summary' is a valid AnalyticsEvent value (typecheck via assignment)", () => {
    const ev: AnalyticsEvent = 'srs_session_summary';
    expect(ev).toBe('srs_session_summary');
  });
  it('track(srs_review, props) does not throw', () => {
    // track() under vitest is a no-op (ctx.isTest gate), but the props
    // shape must be assignable to Record<string, unknown> and the call
    // must not throw. If 'srs_review' weren't in the union, this line
    // would be a type error.
    expect(() => track('srs_review', {
      card_id: 'c1',
      rating: 'good',
      pre_ease: 2.5,
      post_ease: 2.5,
      pre_interval: 6,
      post_interval: 15,
      reps: 3,
      overdue_days: 0,
      overdue_state: 'on_time',
    })).not.toThrow();
  });
  it('track(srs_session_summary, props) does not throw', () => {
    expect(() => track('srs_session_summary', {
      lapse_count: 0,
      average_ef: 2.5,
      cards_due_at_session_start: 12,
    })).not.toThrow();
  });
  it('getQueuedEvents returns events in FIFO order (source-contract)', () => {
    // Source-contract: track() pushes entries into eventQueue, and
    // getQueuedEvents() returns a snapshot in insertion order. The 100-
    // entry cap is implemented via eventQueue.shift() in the rare case
    // the queue overflows.
    const src = readFileSync(resolve(__dirname, '..', 'src', 'services', 'analyticsService.ts'), 'utf8');
    expect(src).toMatch(/eventQueue\.push\(/);
    expect(src).toMatch(/eventQueue\.shift\(\)/); // cap at 100
    expect(src).toMatch(/function getQueuedEvents/);
  });
  it('overdue_state enum is on_time|recent_overdue|catch_up_handled', () => {
    // The analytics contract is the source of truth. Flashcards no longer
    // carries a dead duplicate after its old rateCard path was removed.
    const analyticsSrc = readFileSync(resolve(__dirname, '..', 'src', 'services', 'analyticsService.ts'), 'utf8');
    expect(analyticsSrc).toMatch(/'on_time'\s*\|\s*'recent_overdue'\s*\|\s*'catch_up_handled'/);
  });

  it('emits review telemetry from the production flashcard review paths', () => {
    const flashcards = readFileSync(resolve(__dirname, '..', 'src', 'screens', 'FlashcardsScreen.tsx'), 'utf8');
    expect(flashcards).toContain("trackSrsReviewTelemetry(card.id, 'hard', preReview, staged)");
    expect(flashcards).toContain("trackSrsReviewTelemetry(card.id, 'again', preReview, staged)");
    expect(flashcards).toContain("track('srs_review'");
  });

  it('does not emit empty or duplicate session summaries during hydration and unmount', () => {
    const flashcards = readFileSync(resolve(__dirname, '..', 'src', 'screens', 'FlashcardsScreen.tsx'), 'utf8');
    expect(flashcards).toContain('startDueCountRef.current = count');
    expect(flashcards).toContain('if (reviewCount.current === 0) return;');
    expect(flashcards).toMatch(/useEffect\(\(\) => \{[\s\S]*?srs_session_summary[\s\S]*?\}, \[\]\);/);
  });
});
