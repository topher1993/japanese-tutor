/**
 * Phase 25 / P3-1 — Audit log rendering helpers.
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) flagged an audit-rendering bug
 * where template-string interpolation (`${entry}`) silently coerced an
 * AuditEntry to its `toString()` form, which for plain objects is the
 * literal string `"[object Object]"`. This module is the single canonical
 * path for turning an AuditEntry into display text — every consumer
 * (UI components, the dependency audit script, QA reports) MUST go
 * through `formatAuditEntry` so the rendering rule lives in one place.
 *
 * The companion helper `stringifyVia` is shared with
 * `scripts/audit-report.mjs` so the npm-audit `via` field never produces
 * "[object Object]" either, even when it's an unexpected object shape.
 */
import type { AuditEntry } from '../types/audit';

/**
 * Sentinel value used in place of empty / missing fields. Stable so that
 * downstream parsers (logs, Markdown report readers) can rely on the
 * `part | part | part | part` shape.
 */
const MISSING = '-';

/**
 * Format an AuditEntry as a single line of stable, machine-parseable text.
 *
 * Format: `${timestamp} | ${actor} | ${capability} | ${action}`
 *
 * Order is intentional: chronological first (timestamp), then actor,
 * then capability, then action. Empty fields render as `-` so the line
 * always has exactly 4 parts.
 */
export function formatAuditEntry(entry: AuditEntry): string {
  return [
    entry.timestamp || MISSING,
    entry.actor || MISSING,
    entry.capability || MISSING,
    entry.action || MISSING,
  ].join(' | ');
}

/**
 * Format multiple AuditEntry values, one per line.
 *
 * Empty input returns an empty string (no trailing newline) so callers
 * can concatenate the result into larger markdown reports without
 * worrying about extra whitespace.
 */
export function formatAuditEntries(entries: ReadonlyArray<AuditEntry>): string {
  return entries.map(formatAuditEntry).join('\n');
}

/**
 * Stringify an npm-audit `via` field without ever rendering
 * "[object Object]".
 *
 * npm-audit's `via` field can be:
 *   - an array of strings (advisory IDs / GHSA references)
 *   - an array of objects (`{ title, url, severity, ... }`)
 *   - a plain string (rare, but observed)
 *   - an object without `title` (rare, but observed)
 *   - null / undefined (when a vulnerability has no upstream advice)
 *
 * All shapes are mapped to a stable string. Unknown objects fall back to
 * `-` rather than `[object Object]` so the markdown report never
 * surfaces the literal coercion text.
 */
export function stringifyVia(via: unknown): string {
  if (via == null) return MISSING;
  if (typeof via === 'string') return via || MISSING;
  if (Array.isArray(via)) {
    if (via.length === 0) return MISSING;
    return via
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'title' in item) {
          const title = (item as { title: unknown }).title;
          if (typeof title === 'string') return title;
        }
        return null;
      })
      .filter((s): s is string => s !== null && s.length > 0)
      .join(', ') || MISSING;
  }
  if (typeof via === 'object') {
    const obj = via as { title?: unknown };
    if (typeof obj.title === 'string') return obj.title;
  }
  return MISSING;
}