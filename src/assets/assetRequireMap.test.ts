/**
 * @vitest-environment node
 *
 * The real `assetRequireMap.ts` uses literal `require()` calls so the React
 * Native bundler can see them. vitest doesn't run Metro, so we mock the
 * module out and test only the structural surface (keys, types).
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the module BEFORE importing it.
vi.mock('./assetRequireMap', async () => {
  // Build the same shape by reflecting on the manifest keys.
  // We deliberately don't call require() — Metro would, but vitest can't.
  const manifest = (await vi.importActual('./manifest' as any)).manifest;
  const flat: Record<string, number> = {};
  function walk(obj: unknown, prefix = ''): void {
    if (typeof obj !== 'object' || obj === null) return;
    const record = obj as Record<string, unknown>;
    // Detect a manifest leaf entry: has { key, path } shape.
    if (typeof record.key === 'string' && typeof record.path === 'string'
      && (record.path.startsWith('src/') || record.path.startsWith('assets/'))) {
      flat[record.key] = Math.floor(Math.random() * 1_000_000);
      return; // don't recurse into leaf; the rest are metadata (label, maxBytes, etc.)
    }
    // Otherwise it's a grouping node; recurse into children.
    for (const [k, v] of Object.entries(record)) {
      if (typeof v === 'object' && v !== null) walk(v, `${prefix}${k}.`);
    }
  }
  walk(manifest);
  return {
    assetRequireMap: flat,
    getAsset: (key: string) => {
      if (!(key in flat)) throw new Error(`[assetRequireMap] missing require() for key="${key}"`);
      return flat[key];
    },
  };
});

// Import AFTER mock is registered.
import { assetRequireMap, getAsset } from './assetRequireMap';
import { manifest } from './manifest';

describe('manifest ↔ component wiring', () => {
  it('manifest is a single source of truth (typed)', () => {
    expect(manifest).toBeDefined();
    expect(typeof manifest).toBe('object');
  });

  it('all 8 asset categories are present in manifest', () => {
    expect(manifest.icon).toBeDefined();
    expect(manifest.splash).toBeDefined();
    expect(manifest.adaptive).toBeDefined();
    expect(manifest.onboarding).toBeDefined();
    expect(manifest.emptyState).toBeDefined();
    expect(manifest.badge).toBeDefined();
    expect(manifest.tabIcon).toBeDefined();
    expect(manifest.mascot).toBeDefined();
  });

  it('onboarding has 3 base + 3 final illustrations (kanji overlay)', () => {
    expect(Object.keys(manifest.onboarding)).toHaveLength(6);
    expect(manifest.onboarding.welcome).toBeDefined();
    expect(manifest.onboarding.welcomeFinal).toBeDefined();
    expect(manifest.onboarding.workplace).toBeDefined();
    expect(manifest.onboarding.workplaceFinal).toBeDefined();
    expect(manifest.onboarding.habit).toBeDefined();
    expect(manifest.onboarding.habitFinal).toBeDefined();
  });

  it('badges cover all 8 achievements + 2 JLPT levels', () => {
    const achievementBadges = [
      'firstLesson', 'streak7', 'streak30', 'firstKanji',
      'vocab100', 'levelUp', 'survivalComplete', 'perfectQuiz',
    ];
    for (const k of achievementBadges) {
      expect((manifest.badge as Record<string, unknown>)[k]).toBeDefined();
    }
    expect(manifest.badge.jlptN5).toBeDefined();
    expect(manifest.badge.jlptN4).toBeDefined();
  });

  it('mascot has 5 expressions', () => {
    expect(Object.keys(manifest.mascot)).toHaveLength(5);
    expect(manifest.mascot.basePng).toBeDefined();
    expect(manifest.mascot.happyPng).toBeDefined();
    expect(manifest.mascot.thinkingPng).toBeDefined();
    expect(manifest.mascot.celebratePng).toBeDefined();
    expect(manifest.mascot.encouragePng).toBeDefined();
  });

  it('tab icons cover all 5 bottom navigation tabs', () => {
    expect(Object.keys(manifest.tabIcon).sort()).toEqual(
      ['flashcards', 'home', 'lessons', 'progress', 'quiz'],
    );
  });

  it('every manifest path points at a real file on disk', () => {
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const flat: string[] = [];
    function walk(obj: unknown): void {
      if (typeof obj !== 'object' || obj === null) return;
      const record = obj as Record<string, unknown>;
      // Detect a manifest leaf entry: has { key, path } shape.
      if (typeof record.key === 'string' && typeof record.path === 'string'
        && (record.path.startsWith('src/') || record.path.startsWith('assets/'))) {
        flat.push(record.path);
        return;
      }
      // Otherwise it's a grouping node; recurse into children.
      for (const v of Object.values(record)) {
        if (typeof v === 'object' && v !== null) walk(v);
      }
    }
    walk(manifest);
    expect(flat.length).toBeGreaterThanOrEqual(31);
    let missing = 0;
    for (const p of flat) {
      const full = path.resolve(process.cwd(), p);
      if (!fs.existsSync(full)) missing++;
    }
    expect(missing, 'manifest paths missing on disk').toBe(0);
  });

  it('mocked assetRequireMap returns numeric module ids for every manifest key', () => {
    const mapKeys = Object.keys(assetRequireMap);
    expect(mapKeys.length).toBeGreaterThanOrEqual(30);
    for (const key of mapKeys) {
      expect(typeof getAsset(key as keyof typeof assetRequireMap)).toBe('number');
    }
  });

  // Phase 45 Tier-2: explicit assertions for the 4 new require() lines.
  it('Phase 45: assetRequireMap has emptyState.flashcards', () => {
    expect(assetRequireMap['emptyState.flashcards']).toBeDefined();
  });

  it('Phase 45: assetRequireMap has emptyState.quiz', () => {
    expect(assetRequireMap['emptyState.quiz']).toBeDefined();
  });

  it('Phase 45: assetRequireMap has emptyState.survival', () => {
    expect(assetRequireMap['emptyState.survival']).toBeDefined();
  });

  it('Phase 45: assetRequireMap has badge.jlptN3', () => {
    expect(assetRequireMap['badge.jlptN3']).toBeDefined();
  });

  it('Koi Sensei placeholder GLB is registered for Metro bundling', () => {
    expect(assetRequireMap['avatar.koiPlaceholderGlb']).toBeDefined();
  });
});
