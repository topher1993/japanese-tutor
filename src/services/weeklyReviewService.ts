// Phase 46 — pure helper service for the JLPT N3 weekly-review 4-week-streak
// badge. This module owns ISO-8601 week math and is intentionally side-effect
// free: no React, no async, no SQLite. Persistence is the caller's
// responsibility (use sqliteLearningRepository.saveExtendedProgress). The
// N3 badge is gated on `consecutiveIsoWeeks(...) >= 4`; that predicate is
// defined in profileProgressionService.ts and reads the counter this module
// produces. See JT-CARRY-FORWARD.md §2.1.

import type { LearnerProgress, WeeklyReviewCompletion } from '../types/progress';

/**
 * Returns the ISO-8601 week number of `d` as `YYYY-Www`. Weeks start Monday;
 * week 01 is the first week of the year that contains the year's first
 * Thursday (so early-January and late-December dates can fall into a
 * neighbouring calendar year's ISO week — e.g. 2026-01-01 is ISO week 1 of
 * 2026, but 2025-12-29 is ISO week 1 of 2026 in some years).
 *
 * Algorithm: derive the Thursday of the same ISO week, then read that
 * Thursday's year + week-number. This is the standard
 * "Thursday-of-this-week" trick; it is correct for all dates including the
 * year-boundary edge cases because Thursday always belongs to the same ISO
 * week as any other day in that week.
 *
 * Uses UTC throughout so the result is stable across timezones (the ISO
 * calendar week is a calendar concept, not a local-time concept).
 *
 * @example
 *   getIsoWeek(new Date('2026-07-08T00:00:00Z'));  // '2026-W28'
 */
export function getIsoWeek(d: Date = new Date()): string {
  // Step 1: shift `d` to the Thursday of its ISO week. Day-of-week numbers
  // we use: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6. JS getUTCDay
  // returns 0=Sun..6=Sat, so convert with (getUTCDay + 6) % 7.
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + (3 - dayOfWeek));

  const isoYear = thursday.getUTCFullYear();

  // Step 2: compute ISO week-number from Thursday. Jan 4 is always in
  // week 01 (by definition). Find the Monday of week 01 (= Jan 4 - its
  // day-of-week offset), then number the weeks from there.
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayOfWeek = (jan4.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayOfWeek);

  const msPerWeek = 7 * 86_400_000;
  const weekNumber = Math.floor((thursday.getTime() - week1Monday.getTime()) / msPerWeek) + 1;

  // Step 3: format. Week numbers 1..9 are zero-padded to width 2 so the
  // string sorts lexicographically (e.g. '2026-W09' < '2026-W10').
  const ww = weekNumber < 10 ? `0${weekNumber}` : String(weekNumber);
  return `${isoYear}-W${ww}`;
}

/**
 * Pure appender: returns a new LearnerProgress with a WeeklyReviewCompletion
 * for the current ISO week appended IF not already recorded. Idempotent —
 * calling twice on the same calendar day does not double-record.
 *
 * This is a pure function. Persisting the new progress is the caller's
 * responsibility (use the existing sqliteLearningRepository.saveExtendedProgress
 * path).
 */
export function recordWeeklyReviewCompletion(
  progress: LearnerProgress,
  d: Date = new Date(),
): LearnerProgress {
  const weekIso = getIsoWeek(d);
  const prior = progress.weeklyReviewCompletions ?? [];
  if (prior.some(stamp => stamp.weekIso === weekIso)) {
    // Already recorded for this ISO week — return unchanged so the
    // caller's reference equality check sees no mutation and the SQLite
    // blob save is naturally idempotent.
    return progress;
  }
  return {
    ...progress,
    weeklyReviewCompletions: [...prior, { weekIso }],
  };
}

/**
 * Given a list of recorded WeeklyReviewCompletion weeks (in any order),
 * returns the current trailing streak of consecutive ISO weeks.
 *
 * Examples:
 *   consecutiveIsoWeeks([]) => 0
 *   consecutiveIsoWeeks([{ weekIso: '2026-W28' }]) => 1
 *   consecutiveIsoWeeks([{ weekIso: '2026-W27' }, { weekIso: '2026-W28' }]) => 2
 *   consecutiveIsoWeeks([{ weekIso: '2026-W26' }, { weekIso: '2026-W28' }]) => 1 (gap breaks)
 *   consecutiveIsoWeeks([{ weekIso: '2026-W27' }, { weekIso: '2026-W28' }, { weekIso: '2026-W29' }, { weekIso: '2026-W30' }]) => 4
 *   consecutiveIsoWeeks([{ weekIso: '2026-W52' }, { weekIso: '2027-W01' }]) => 2 (year-boundary)
 *
 * Implementation note: a pure `YYYY*100+ww` numeric sort fails at year
 * boundaries (2026-W53 → 2027-W01 would not be adjacent under that
 * encoding because some years have 52 ISO weeks). Instead we convert each
 * `weekIso` to the UTC ordinal day of its Monday and sort + dedupe on
 * that monotonic integer. The trailing consecutive run then walks back
 * one week-at-a-time from the maximum ordinal.
 */
export function consecutiveIsoWeeks(weeks: WeeklyReviewCompletion[]): number {
  if (weeks.length === 0) return 0;

  // Convert each weekIso → UTC ordinal day of its Monday (Mon of ISO week
  // is day 1 of that week; week 01 of isoYear contains Jan 4).
  const mondayOrdinals = new Set<number>();
  for (const stamp of weeks) {
    const monday = mondayOfIsoWeek(stamp.weekIso);
    if (monday !== null) mondayOrdinals.add(monday);
  }
  if (mondayOrdinals.size === 0) return 0;

  const msPerDay = 86_400_000;
  const sortedDesc = [...mondayOrdinals].sort((a, b) => b - a);
  const top = sortedDesc[0];
  let streak = 1;
  for (let i = 1; i < sortedDesc.length; i++) {
    const expected = top - i * 7 * msPerDay;
    if (sortedDesc[i] === expected) streak++;
    else break;
  }
  return streak;
}

/**
 * Parse `weekIso` (e.g. `'2026-W28'`) and return the UTC ordinal day (ms
 * since epoch) of that ISO week's Monday. Returns null on a malformed
 * string so callers can skip bad rows instead of throwing.
 */
function mondayOfIsoWeek(weekIso: string): number | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekIso);
  if (!match) return null;
  const isoYear = Number.parseInt(match[1], 10);
  const weekNumber = Number.parseInt(match[2], 10);
  if (!Number.isFinite(isoYear) || !Number.isFinite(weekNumber)) return null;
  if (weekNumber < 1 || weekNumber > 53) return null;

  // Monday of week 01 = Jan 4 minus Jan 4's day-of-week offset (Mon=0).
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayOfWeek = (jan4.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayOfWeek);

  // Advance `weekNumber - 1` weeks.
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (weekNumber - 1) * 7);
  return target.getTime();
}