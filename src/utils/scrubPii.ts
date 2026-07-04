/**
 * Phase 44.2 — scrubPii helper.
 *
 * The analytics service (`src/services/analyticsService.ts`) accepts a
 * property bag of `Record<string, unknown>` for each event. We MUST scrub
 * PII out of that bag before it leaves the device, because the event
 * taxonomy includes user-driven fields like lesson titles and onboarding
 * language choices that may one day contain free-form text.
 *
 * What this function scrubs:
 *   - Email addresses (`x@y.z`) → "[email]"
 *   - Long digit runs (≥7 consecutive digits) → "[number]"
 *     — these are phone-number-shaped, ID-shaped, or card-number-shaped
 *     — short numbers (week indexes, counts) pass through unchanged
 *
 * What this function does NOT scrub:
 *   - Whitelisted short identifiers: lessonId, tab, kind, error, week, lang
 *     These are safe by construction (typed enums or our own IDs).
 *   - The KEYS themselves — only values are scrubbed, so call sites can
 *     safely attach a `lessonTitle: "Call 5551234567"` and we replace
 *     the digits inside the value, not the key.
 *
 * What this function DOES to the result:
 *   - Returns a deep-copied object so mutating the scrubbed result does
 *     not affect the original props bag.
 *   - Recurses into nested objects + arrays of strings.
 *   - Leaves numbers / booleans / null / undefined untouched.
 *
 * This is intentionally conservative. When in doubt, scrub. The goal is
 * "no PII leaves the device" — and false positives (over-scrubbing a
 * count) cost us a dashboard chart, while false negatives (leaking an
 * email) cost us a privacy incident.
 */

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const LONG_DIGITS_PATTERN = /\d{7,}/g;

const SCRUB_PLACEHOLDER_EMAIL = '[email]';
const SCRUB_PLACEHOLDER_NUMBER = '[number]';

/**
 * Scrub a single string value. Returns the (possibly-modified) string,
 * or the original value if it's not a string.
 */
function scrubString(input: unknown): unknown {
  if (typeof input !== 'string') return input;
  return input
    .replace(EMAIL_PATTERN, SCRUB_PLACEHOLDER_EMAIL)
    .replace(LONG_DIGITS_PATTERN, SCRUB_PLACEHOLDER_NUMBER);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function scrubPii<T = Record<string, unknown>>(props: T): T {
  if (!isPlainObject(props)) {
    // Defensive: callers should always pass a plain object. If they
    // hand us a primitive, return it untouched. Returning a copy of a
    // non-object would lose type fidelity.
    return props;
  }
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const value = props[key];
    if (Array.isArray(value)) {
      out[key] = value.map(scrubString);
    } else if (isPlainObject(value)) {
      out[key] = scrubPii(value);
    } else {
      out[key] = scrubString(value);
    }
  }
  return out as T;
}