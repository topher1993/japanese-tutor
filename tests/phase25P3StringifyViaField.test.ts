/**
 * Phase 25 / P3-1 closure — `stringifyViaField` helper contract.
 *
 * `scripts/audit-report.mjs` defines `stringifyViaField(via)` as an
 * internal helper (it's a .mjs script — not a TypeScript module — and
 * isn't exported). It guards the `via` field of an npm-audit advisory
 * so the rendered markdown report can never contain the literal text
 * "[object Object]".
 *
 * We test the helper by **replicating its logic inline** in this file.
 * This is the standard pattern for script-only helpers: the script
 * can't be imported from a TypeScript test file without a build step,
 * and converting the script to a TS module would change its public
 * surface for no benefit (it's run with `node scripts/audit-report.mjs`
 * in CI, not imported by the app).
 *
 * IMPORTANT: if you change `stringifyViaField` in
 * `scripts/audit-report.mjs`, mirror that change here. The two MUST
 * stay in sync. The companion integration test
 * `phase25P3AuditScript.test.ts` spawns the actual script end-to-end
 * as the ultimate guard against drift.
 *
 * Contract under test (matches the script):
 *   - undefined / null          → 'unknown'
 *   - array of strings          → joined with ', '
 *   - array of objects          → joined titles (objects without a
 *                                 string `title` field are dropped)
 *   - string                    → unchanged
 *   - plain object with title   → that title
 *   - plain object without title → JSON.stringify (never String(...))
 *   - number                    → String(num)
 */
import { describe, expect, it } from 'vitest';

/**
 * Replicated from scripts/audit-report.mjs. Keep in sync.
 */
function stringifyViaField(via: unknown): string {
  if (via == null) return 'unknown';
  if (typeof via === 'string') return via;
  if (Array.isArray(via)) {
    return (
      via
        .map((x) =>
          typeof x === 'string'
            ? x
            : x && typeof x === 'object' && typeof (x as { title?: unknown }).title === 'string'
              ? ((x as { title: string }).title)
              : null,
        )
        .filter((s): s is string => s !== null && s.length > 0)
        .join(', ') || 'unknown'
    );
  }
  if (typeof via === 'object') {
    const obj = via as {
      title?: unknown;
      name?: unknown;
      url?: unknown;
      severity?: unknown;
    };
    if (typeof obj.title === 'string') return obj.title;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.url === 'string') return obj.url;
    if (typeof obj.severity === 'string') return obj.severity;
    try {
      return JSON.stringify(via);
    } catch {
      return 'unknown';
    }
  }
  if (typeof via === 'number' || typeof via === 'boolean' || typeof via === 'bigint') {
    return String(via);
  }
  return 'unknown';
}

describe('Phase 25 / P3-1 closure — stringifyViaField helper contract', () => {
  it('undefined → "unknown"', () => {
    expect(stringifyViaField(undefined)).toBe('unknown');
  });

  it('null → "unknown"', () => {
    expect(stringifyViaField(null)).toBe('unknown');
  });

  it('array of strings joins with ", "', () => {
    expect(stringifyViaField(['GHSA-xxxx', 'GHSA-yyyy'])).toBe(
      'GHSA-xxxx, GHSA-yyyy',
    );
  });

  it('array of objects joins their title fields', () => {
    expect(
      stringifyViaField([
        { title: 'Prototype Pollution' },
        { title: 'ReDoS' },
      ]),
    ).toBe('Prototype Pollution, ReDoS');
  });

  it('array with mixed strings and title-objects joins both', () => {
    expect(
      stringifyViaField(['GHSA-a', { title: 'CSRF' }, 'GHSA-b']),
    ).toBe('GHSA-a, CSRF, GHSA-b');
  });

  it('array of objects without title drops them and falls back to "unknown"', () => {
    expect(stringifyViaField([{ random: 'x' }, { also: 'y' }])).toBe('unknown');
  });

  it('string passes through unchanged', () => {
    expect(stringifyViaField('GHSA-direct')).toBe('GHSA-direct');
  });

  it('empty string passes through (caller decides whether to treat it as missing)', () => {
    // Documenting the behaviour: the script does NOT coerce empty
    // strings to 'unknown'; the array path's filter drops them.
    expect(stringifyViaField('')).toBe('');
  });

  it('plain object with title renders as that title', () => {
    expect(stringifyViaField({ title: 'CSRF in dependency' })).toBe(
      'CSRF in dependency',
    );
  });

  it('plain object without title/name/url/severity falls back to JSON.stringify', () => {
    const got = stringifyViaField({ random: 'object', n: 42 });
    // JSON.stringify of a plain object — never the literal "[object Object]".
    expect(got).not.toContain('[object Object]');
    expect(got).toBe('{"random":"object","n":42}');
  });

  it('plain object with name (no title) renders the name', () => {
    expect(stringifyViaField({ name: 'fallback-name' })).toBe('fallback-name');
  });

  it('plain object with url (no title/name) renders the url', () => {
    expect(stringifyViaField({ url: 'https://example.com/advisory' })).toBe(
      'https://example.com/advisory',
    );
  });

  it('plain object with severity (no title/name/url) renders the severity', () => {
    expect(stringifyViaField({ severity: 'high' })).toBe('high');
  });

  it('number renders as String(num), never "[object Object]"', () => {
    expect(stringifyViaField(42)).toBe('42');
    expect(stringifyViaField(42)).not.toContain('[object Object]');
  });

  it('boolean renders as String(bool)', () => {
    expect(stringifyViaField(true)).toBe('true');
    expect(stringifyViaField(false)).toBe('false');
  });

  it('NEVER produces "[object Object]" for ANY input shape', () => {
    const wildInputs: unknown[] = [
      undefined,
      null,
      '',
      'string',
      0,
      1,
      true,
      false,
      [],
      ['a', 'b'],
      [{}, {}],
      [{ title: 't' }, { random: 1 }],
      {},
      { random: 'x' },
      { title: 42 }, // non-string title → falls through
      { name: 'n' },
      { url: 'u' },
      { severity: 's' },
      { title: 't', name: 'n' }, // title wins
    ];
    for (const input of wildInputs) {
      const out = stringifyViaField(input);
      expect(
        out,
        `stringifyViaField(${JSON.stringify(input)}) must not contain "[object Object]"`,
      ).not.toContain('[object Object]');
    }
  });
});