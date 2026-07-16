/**
 * Phase 25 / P3-1 closure: the production audit-report script must never
 * render Object.prototype's "[object Object]" fallback. The script writes
 * to a temporary report so this test never changes committed documentation.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..');
const SCRIPT = join(REPO_ROOT, 'scripts', 'audit-report.mjs');
const TEMP_DIR = mkdtempSync(join(tmpdir(), 'japanese-tutor-audit-'));
const REPORT_PATH = join(TEMP_DIR, 'dependency-audit.md');
const AUDIT_JSON_PATH = join(TEMP_DIR, 'npm-audit.json');

describe('Phase 25 / P3-1 closure: scripts/audit-report.mjs output', () => {
  afterAll(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  });

  it('never emits "[object Object]" to the process or generated report', () => {
    writeFileSync(AUDIT_JSON_PATH, JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: {
        example: {
          severity: 'moderate',
          via: [{ title: 'Example advisory' }],
          range: '<1.0.0',
        },
      },
      metadata: {
        vulnerabilities: { info: 0, low: 0, moderate: 1, high: 0, critical: 0, total: 1 },
        dependencies: { prod: 694, dev: 125, optional: 71, peer: 0, peerOptional: 0, total: 830 },
      },
    }), 'utf8');

    const proc = spawnSync('node', [
      SCRIPT,
      '--audit-json', AUDIT_JSON_PATH,
      '--output', REPORT_PATH,
    ], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });

    if (proc.error) {
      throw new Error(
        `Failed to spawn node for ${SCRIPT}: ${proc.error.message}\n` +
          `stdout: ${proc.stdout}\nstderr: ${proc.stderr}`,
      );
    }

    const combined = `${proc.stdout ?? ''}${proc.stderr ?? ''}`;
    const report = readFileSync(REPORT_PATH, 'utf8');

    expect(combined).not.toContain('[object Object]');
    expect(combined).not.toMatch(/\[object\s+[A-Z]\w+\]/);
    expect(report).not.toContain('[object Object]');
    expect(report).not.toMatch(/\[object\s+[A-Z]\w+\]/);
    expect(report).toContain('Total dependencies scanned: 830.');
    expect(report).toContain('Example advisory');
  }, 90_000);
});
