/**
 * Phase 25 / P3-1 — Audit log renderer must not produce "[object Object]".
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) flagged an audit-rendering bug
 * where audit entries were displayed via template-string interpolation
 * (`${entry}`) instead of explicit field selection, so React Native's
 * console output and the markdown audit report both rendered the literal
 * string "[object Object]" when given a structured AuditEntry.
 *
 * This test exercises the contract for the new `formatAuditEntry` helper
 * and `AuditEntry` type:
 *   1. `formatAuditEntry` returns a string containing the explicit fields
 *      (action, capability, actor, timestamp) — NOT "[object Object]".
 *   2. The order is stable: timestamp first, then actor, then capability,
 *      then action (so a sorted log reads chronologically).
 *   3. The format is parseable: each field is delimited by ` | ` and
 *      missing fields render as `-` so the line shape is stable.
 *   4. The AuditEntry type enforces the four fields at compile time.
 *
 * The corresponding source file is src/services/auditLog.ts. The renderer
 * is also used by scripts/audit-report.mjs to defensively format any
 * dependency-audit entries that flow through the same code path.
 */
import { describe, expect, it } from 'vitest';
import { formatAuditEntry, formatAuditEntries } from '../src/services/auditLog';
import type { AuditEntry } from '../src/types/audit';

const sample: AuditEntry = {
  action: 'reviewed_flashcard',
  capability: 'srs.persist',
  actor: 'user:tophe',
  timestamp: '2026-06-28T13:00:00Z',
};

describe('Phase 25 / P3-1 — audit log renders structured fields, not "[object Object]"', () => {
  it('formatAuditEntry includes every explicit field', () => {
    const out = formatAuditEntry(sample);
    expect(out).toContain('reviewed_flashcard');
    expect(out).toContain('srs.persist');
    expect(out).toContain('user:tophe');
    expect(out).toContain('2026-06-28T13:00:00Z');
  });

  it('formatAuditEntry never produces "[object Object]"', () => {
    const out = formatAuditEntry(sample);
    expect(out).not.toContain('[object Object]');
    expect(out).not.toContain('[object ');
  });

  it('field order is stable: timestamp, actor, capability, action', () => {
    const out = formatAuditEntry(sample);
    const tIdx = out.indexOf('2026-06-28T13:00:00Z');
    const aIdx = out.indexOf('user:tophe');
    const cIdx = out.indexOf('srs.persist');
    const xIdx = out.indexOf('reviewed_flashcard');
    expect(tIdx).toBeGreaterThanOrEqual(0);
    expect(aIdx).toBeGreaterThan(tIdx);
    expect(cIdx).toBeGreaterThan(aIdx);
    expect(xIdx).toBeGreaterThan(cIdx);
  });

  it('missing fields render as "-" so each line has a stable shape', () => {
    const partial: AuditEntry = {
      action: 'reset_progress',
      capability: 'settings.reset',
      actor: '',
      timestamp: '2026-06-28T13:05:00Z',
    };
    const out = formatAuditEntry(partial);
    expect(out).not.toContain('[object Object]');
    // The empty actor should be filled with '-'.
    const parts = out.split(' | ');
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe('-');
  });

  it('formatAuditEntries joins multiple entries with newlines, no "[object Object]" anywhere', () => {
    const entries: AuditEntry[] = [
      sample,
      {
        action: 'started_lesson',
        capability: 'lesson.read',
        actor: 'user:tophe',
        timestamp: '2026-06-28T13:01:00Z',
      },
      {
        action: 'completed_quiz',
        capability: 'quiz.submit',
        actor: 'user:tophe',
        timestamp: '2026-06-28T13:02:30Z',
      },
    ];
    const out = formatAuditEntries(entries);
    expect(out).not.toContain('[object Object]');
    const lines = out.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('reviewed_flashcard');
    expect(lines[1]).toContain('started_lesson');
    expect(lines[2]).toContain('completed_quiz');
  });

  it('every entry line follows the same delimiter shape (4 parts)', () => {
    const entries: AuditEntry[] = [
      sample,
      {
        action: 'started_lesson',
        capability: 'lesson.read',
        actor: 'user:tophe',
        timestamp: '2026-06-28T13:01:00Z',
      },
    ];
    const lines = formatAuditEntries(entries).split('\n');
    for (const line of lines) {
      expect(line.split(' | ')).toHaveLength(4);
    }
  });

  it('handles entries with non-ASCII action names without coercion to "[object Object]"', () => {
    const unicode: AuditEntry = {
      action: '進捗を保存', // "save progress" in Japanese
      capability: 'srs.persist',
      actor: 'user:日本語',
      timestamp: '2026-06-28T13:10:00Z',
    };
    const out = formatAuditEntry(unicode);
    expect(out).toContain('進捗を保存');
    expect(out).toContain('user:日本語');
    expect(out).not.toContain('[object Object]');
  });
});

/**
 * Bonus regression: scripts/audit-report.mjs has a latent bug where
 * \`String(via)\` renders "[object Object]" when the npm-audit `via` field
 * is an object instead of an array or string. The fix lives in
 * src/services/auditLog.ts (pure helper) and the script imports from
 * there. We assert the helper handles non-array, non-string `via` shapes.
 */
describe('Phase 25 / P3-1 — npm-audit via field is safely stringified', () => {
  it('array of strings joins with ", "', async () => {
    const { stringifyVia } = await import('../src/services/auditLog');
    expect(stringifyVia(['GHSA-xxxx', 'GHSA-yyyy'])).toBe('GHSA-xxxx, GHSA-yyyy');
  });

  it('array of objects joins with their title fields', async () => {
    const { stringifyVia } = await import('../src/services/auditLog');
    expect(
      stringifyVia([{ title: 'Prototype Pollution' }, { title: 'ReDoS' }]),
    ).toBe('Prototype Pollution, ReDoS');
  });

  it('plain string passes through', async () => {
    const { stringifyVia } = await import('../src/services/auditLog');
    expect(stringifyVia('GHSA-direct')).toBe('GHSA-direct');
  });

  it('object with title is rendered as that title', async () => {
    const { stringifyVia } = await import('../src/services/auditLog');
    expect(stringifyVia({ title: 'CSRF in dependency' })).toBe(
      'CSRF in dependency',
    );
  });

  it('empty / unknown values fall back to "-" without "[object Object]"', async () => {
    const { stringifyVia } = await import('../src/services/auditLog');
    expect(stringifyVia(undefined)).toBe('-');
    expect(stringifyVia(null)).toBe('-');
    expect(stringifyVia({ random: 'object' })).toBe('-');
    expect(stringifyVia({ random: 'object' })).not.toContain('[object Object]');
  });
});