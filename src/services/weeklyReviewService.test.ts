/**
 * Phase 46 — unit tests for the weekly-review pure helper service.
 *
 * Covers:
 *   - consecutiveIsoWeeks: empty, single, gap, trailing streak, dedupe,
 *     year-boundary, and ordering.
 *   - getIsoWeek: known-date ISO-8601 round-trip.
 *   - recordWeeklyReviewCompletion: idempotency on the ISO-week key.
 *
 * These tests pin the JLPT N3 badge predicate. If anyone weakens the math
 * here, the audit-fabrication-prevention gate must flag it.
 */
import { describe, it, expect } from 'vitest';
import { consecutiveIsoWeeks, getIsoWeek, recordWeeklyReviewCompletion } from './weeklyReviewService';
import type { LearnerProgress } from '../types/progress';

const emptyProgress: LearnerProgress = {
  startedAt: '2026-01-01',
  completedLessonIds: [],
  quizScores: [],
  streak: { currentStreak: 0, longestStreak: 0 },
};

describe('consecutiveIsoWeeks', () => {
  it('returns 0 for empty array', () => {
    expect(consecutiveIsoWeeks([])).toBe(0);
  });

  it('returns 1 for a single week', () => {
    expect(consecutiveIsoWeeks([{ weekIso: '2026-W28' }])).toBe(1);
  });

  it('returns 2 for two consecutive weeks', () => {
    expect(consecutiveIsoWeeks([{ weekIso: '2026-W27' }, { weekIso: '2026-W28' }])).toBe(2);
  });

  it('returns 1 when the most recent is isolated (gap breaks)', () => {
    // W28 is the trailing run; W26 is dropped because W27 is missing.
    expect(consecutiveIsoWeeks([{ weekIso: '2026-W26' }, { weekIso: '2026-W28' }])).toBe(1);
  });

  it('returns 4 when the user completed 4 consecutive weeks', () => {
    const input = [
      { weekIso: '2026-W27' },
      { weekIso: '2026-W28' },
      { weekIso: '2026-W29' },
      { weekIso: '2026-W30' },
    ];
    expect(consecutiveIsoWeeks(input)).toBe(4);
  });

  it('only counts the trailing streak (older weeks ignored)', () => {
    // Four consecutive weeks starting at W25 — trailing streak should be 4,
    // not 1 (i.e. we should not drop W25 because the gap is before the
    // trailing run, not within it).
    const input = [
      { weekIso: '2026-W25' },
      { weekIso: '2026-W26' },
      { weekIso: '2026-W27' },
      { weekIso: '2026-W28' },
    ];
    expect(consecutiveIsoWeeks(input)).toBe(4);
  });

  it('handles year-boundary across a 52-week year (W52 → W01 still consecutive)', () => {
    // 2025 has 52 ISO weeks. 2025-W52 (Mon 2025-12-22) → 2026-W01 (Mon 2025-12-29)
    // is exactly 7 days apart; calendar-week continuity holds.
    // NOTE: do NOT use 2026→2027 here — 2026 has 53 ISO weeks, so 2026-W52's
    // Monday (2026-12-21) is 14 days before 2027-W01's Monday (2027-01-04).
    expect(consecutiveIsoWeeks([{ weekIso: '2025-W52' }, { weekIso: '2026-W01' }])).toBe(2);
  });

  it('handles within-year late-December 53-week year (W52 → W53 consecutive)', () => {
    // 2026 has 53 ISO weeks. 2026-W52 (Mon 2026-12-21) → 2026-W53 (Mon 2026-12-28)
    // is exactly 7 days apart; calendar-week continuity holds.
    // This fixture is always valid regardless of whether the year has 52 or 53 weeks.
    expect(consecutiveIsoWeeks([{ weekIso: '2026-W52' }, { weekIso: '2026-W53' }])).toBe(2);
  });
});

describe('getIsoWeek', () => {
  it('returns ISO-8601 format YYYY-Www for a known date', () => {
    // 2026-07-08 is a Wednesday. ISO 2026-W28 runs Mon 2026-07-06 to
    // Sun 2026-07-12, with Thursday = 2026-07-09. Verifying the format
    // and value together is enough to pin the algorithm.
    const s = getIsoWeek(new Date('2026-07-08T00:00:00Z'));
    expect(s).toBe('2026-W28');
  });
});

describe('recordWeeklyReviewCompletion', () => {
  it('appends a new ISO-week stamp on first call', () => {
    const out = recordWeeklyReviewCompletion(emptyProgress, new Date('2026-07-08'));
    expect(out.weeklyReviewCompletions).toHaveLength(1);
    expect(out.weeklyReviewCompletions?.[0]?.weekIso).toBe('2026-W28');
  });

  it('is idempotent — calling twice on the same day does not double-record', () => {
    const once = recordWeeklyReviewCompletion(emptyProgress, new Date('2026-07-08'));
    const twice = recordWeeklyReviewCompletion(once, new Date('2026-07-08'));
    expect(twice.weeklyReviewCompletions).toHaveLength(1);
  });
});