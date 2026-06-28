/**
 * Asset manifest tests — verify every entry resolves, exists, and is under its size cap.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { manifest } from './manifest';

// In vitest, process.cwd() resolves to the project root where tests run.
const ROOT = process.cwd();

function flatten(obj: any, prefix = ''): Array<{ key: string; path: string; maxBytes?: number }> {
  const out: any[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === 'object' && 'path' in v && 'key' in v) {
      out.push(v);
    } else if (v && typeof v === 'object') {
      out.push(...flatten(v, prefix + k + '.'));
    }
  }
  return out;
}

describe('asset manifest', () => {
  const entries = flatten(manifest);
  it('has at least one entry', () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  for (const entry of entries) {
    it(`${entry.key} resolves to an existing file`, () => {
      const absPath = join(ROOT, entry.path);
      expect(existsSync(absPath), `missing file: ${absPath}`).toBe(true);
    });

    if (entry.maxBytes !== undefined) {
      it(`${entry.key} is under ${entry.maxBytes} bytes`, () => {
        const absPath = join(ROOT, entry.path);
        const size = statSync(absPath).size;
        expect(size).toBeLessThanOrEqual(entry.maxBytes!);
      });
    }
  }

  it('no orphan entries (every path is unique)', () => {
    const paths = entries.map((e) => e.path);
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });
});