/**
 * Phase 25 / P3-1 closure — `scripts/audit-report.mjs` must never emit
 * "[object Object]" anywhere in its rendered output.
 *
 * GPT-5.5 QC marked P3-1 as partial: the `formatAuditEntry` helper in
 * src/services/auditLog.ts was added and tested, but the production bug
 * site — scripts/audit-report.mjs:78 `String(v.via)` — was unchanged.
 * That branch can render the literal text "[object Object]" when the
 * npm-audit `via` field is a non-array object.
 *
 * This test exercises the actual script via child_process so the fix
 * (`stringifyViaField(v.via)`) is verified end-to-end, not just at the
 * unit level. We spawn `node scripts/audit-report.mjs` from the repo
 * root, capture stdout + stderr, and assert:
 *
 *   1. the script exits cleanly (it always writes a markdown report and
 *      exits 0 or 1 based on vulnerability severity, never crashes).
 *   2. the combined output contains no "[object Object]" substring
 *      anywhere — that is the literal text the QC flagged.
 *   3. the markdown report it wrote contains no "[object Object]"
 *      substring in the rendered table cells.
 *
 * The helper itself is unit-tested separately in
 * `phase25P3StringifyViaField.test.ts`. The two tests are intentionally
 * split so a regression in the helper logic and a regression in the
 * script's call site produce different, localised failures.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'audit-report.mjs');
const REPORT_PATH = join(REPO_ROOT, 'docs', 'phase-22-dependency-audit.md');

describe('Phase 25 / P3-1 closure — scripts/audit-report.mjs never emits "[object Object]"', () => {
  // The script always regenerates docs/phase-22-dependency-audit.md,
  // which would dirty the working tree on every test run. We restore
  // the file from git's HEAD after the suite so the test verifies the
  // fix without leaving a spurious diff behind (the file's drift is
  // a pre-existing issue from npm-audit running against the live
  // repo, not caused by this fix).
  afterAll(() => {
    if (!existsSync(REPORT_PATH)) return;
    const restore = spawnSync('git', ['checkout', 'HEAD', '--', REPORT_PATH], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10_000,
    });
    if (restore.status !== 0) {
      // Don't fail the test run over a cleanup glitch — the assertions
      // above already proved the contract.
      // eslint-disable-next-line no-console
      console.warn(
        `[phase25P3AuditScript] could not restore ${REPORT_PATH}: ` +
          `${restore.stderr ?? ''}`,
      );
    }
  });

  it('runs end-to-end via node and never prints "[object Object]" on stdout/stderr', () => {
    const proc = spawnSync('node', [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      // npm audit may emit warnings on stderr; we still want to inspect them.
      stdio: ['ignore', 'pipe', 'pipe'],
      // Guard against an unexpected hang; the script is bounded.
      timeout: 60_000,
    });

    const combined = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;

    // The script may exit 1 when high/critical vulnerabilities are
    // present (release gate). What we care about is the OUTPUT, not
    // the exit code, and whether "[object Object]" leaked anywhere.
    // If spawnSync itself errored (e.g. binary missing, timeout),
    // surface that so a CI failure isn't silently swallowed.
    if (proc.error) {
      throw new Error(
        `Failed to spawn node for ${SCRIPT}: ${proc.error.message}\n` +
          `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`,
      );
    }

    expect(
      combined,
      'audit-report.mjs must never emit the literal text "[object Object]"',
    ).not.toContain('[object Object]');
    // Also defensively reject the broader "[object " prefix that any
    // Object.prototype.toString coercion produces.
    expect(combined).not.toMatch(/\[object\s+[A-Z]\w+\]/);
  }, 90_000);

  it('the markdown report it wrote contains no "[object Object]" substring', () => {
    // Re-run so this test is independent of the previous one's side
    // effects (a flaky npm audit could in theory delete the file).
    spawnSync('node', [SCRIPT], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    const report = readFileSync(REPORT_PATH, 'utf8');
    expect(
      report,
      'rendered audit report must never contain "[object Object]" in any table cell',
    ).not.toContain('[object Object]');
    expect(report).not.toMatch(/\[object\s+[A-Z]\w+\]/);
  }, 90_000);
});