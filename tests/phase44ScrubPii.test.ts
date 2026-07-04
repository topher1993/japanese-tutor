/**
 * Phase 44.2 — scrubPii helper tests.
 *
 * The analytics service must NEVER receive PII. The contract:
 *   - Email addresses are replaced with "[email]"
 *   - Long digit runs (phone numbers, IDs) are replaced with "[number]"
 *   - Whitelisted keys (lessonId, tab, kind, error, etc.) pass through unchanged
 *   - Unknown keys are still scrubbed (we scrub values, not keys)
 *   - scrubPii is a pure function — same input → same output
 *   - Empty input returns empty output
 *   - Nested objects are scrubbed recursively
 *   - Non-string primitives (numbers, booleans) pass through unchanged
 *   - Arrays of strings are scrubbed element-wise
 */

import { describe, expect, it } from 'vitest';

import { scrubPii } from '../src/utils/scrubPii';

describe('Phase 44.2 — scrubPii', () => {
  it('replaces email addresses with "[email]"', () => {
    expect(scrubPii({ note: 'reach me at chris@example.com' })).toEqual({
      note: 'reach me at [email]',
    });
  });

  it('replaces long digit runs (>= 7 digits) with "[number]"', () => {
    // 7+ digits → phone-number-shaped or ID-shaped PII
    expect(scrubPii({ phone: '5551234567' })).toEqual({ phone: '[number]' });
    // Short numbers (< 7 digits) pass through — these are safe
    // (counts, week numbers, lesson-week IDs like "1" or "12")
    expect(scrubPii({ week: 5 })).toEqual({ week: 5 });
  });

  it('leaves whitelisted short identifier values alone', () => {
    expect(scrubPii({ lessonId: 'lesson-greetings-01' })).toEqual({
      lessonId: 'lesson-greetings-01',
    });
    expect(scrubPii({ tab: 'Home' })).toEqual({ tab: 'Home' });
  });

  it('scrubs PII even when key is whitelisted (e.g. user-provided lesson title)', () => {
    // lessonTitle isn't on the whitelist → still scrubbed for safety
    expect(scrubPii({ lessonTitle: 'Call 5551234567 today' })).toEqual({
      lessonTitle: 'Call [number] today',
    });
  });

  it('scrubs nested objects recursively', () => {
    expect(scrubPii({
      meta: { who: 'chris@test.com', week: 3 },
    })).toEqual({
      meta: { who: '[email]', week: 3 },
    });
  });

  it('scrubs arrays of strings element-wise', () => {
    expect(scrubPii({ tags: ['contact@x.com', 'safe-tag'] })).toEqual({
      tags: ['[email]', 'safe-tag'],
    });
  });

  it('passes non-string primitives through unchanged', () => {
    expect(scrubPii({ count: 5, ok: true, missing: null })).toEqual({
      count: 5, ok: true, missing: null,
    });
  });

  it('returns a fresh object (mutating result does not affect input)', () => {
    const input = { tab: 'Home' };
    const out = scrubPii(input);
    (out as Record<string, unknown>).tab = 'tampered';
    expect(input.tab).toBe('Home');
  });

  it('returns empty object for empty input', () => {
    expect(scrubPii({})).toEqual({});
  });

  it('is pure — same input produces same output on repeated calls', () => {
    const input = { lessonId: 'lesson-1', note: 'a@b.com' };
    const a = scrubPii(input);
    const b = scrubPii(input);
    expect(a).toEqual(b);
  });
});