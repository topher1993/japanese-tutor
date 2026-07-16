/**
 * Asset manifest tests — verify every entry resolves, exists, and is under its size cap.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'fs';
import { join } from 'path';
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

  // Phase 45 Tier-2: explicit assertions for the 4 new entries.
  it('Phase 45: emptyState.flashcards is registered', () => {
    expect(manifest.emptyState.flashcards).toBeDefined();
    expect(manifest.emptyState.flashcards.path).toBe('src/assets/source/illustrations/empty-state/empty-no-flashcards.png');
    expect(manifest.emptyState.flashcards.maxBytes).toBe(1_500_000);
  });

  it('Phase 45: emptyState.quiz is registered', () => {
    expect(manifest.emptyState.quiz).toBeDefined();
    expect(manifest.emptyState.quiz.path).toBe('src/assets/source/illustrations/empty-state/empty-no-quiz.png');
    expect(manifest.emptyState.quiz.maxBytes).toBe(1_500_000);
  });

  it('Phase 45: emptyState.survival is registered', () => {
    expect(manifest.emptyState.survival).toBeDefined();
    expect(manifest.emptyState.survival.path).toBe('src/assets/source/illustrations/empty-state/empty-no-survival.png');
    expect(manifest.emptyState.survival.maxBytes).toBe(1_500_000);
  });

  it('Phase 45: badge.jlptN3 is registered', () => {
    expect(manifest.badge.jlptN3).toBeDefined();
    expect(manifest.badge.jlptN3.path).toBe('src/assets/source/badges/badge-jlpt-n3.png');
    expect(manifest.badge.jlptN3.maxBytes).toBe(200_000);
  });
});
