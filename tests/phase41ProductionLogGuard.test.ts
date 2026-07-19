import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Regression test for Phase 41 — Tusk P1-3 / Batch I Task 1.
 *
 * Verifies that every unguarded `console.warn(...)` call in `src/` has been
 * wrapped in an `if (__DEV__)` guard. Production release bundles will
 * tree-shake the warn calls out, preventing internal state from leaking
 * to logcat / console.app.
 */

const SRC_DIR = path.resolve(__dirname, '..', 'src');

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(p);
    } else if (/\.tsx?$/.test(entry.name)) {
      return [p];
    }
    return [];
  }));
  for (const files of nested) out.push(...files);
  return out;
}

async function findUnguardedWarns(): Promise<{ file: string; line: number; text: string }[]> {
  const files = await walk(SRC_DIR);
  const unguarded: { file: string; line: number; text: string }[] = [];
  const sourceFiles = await Promise.all(files.map(async file => ({
    file,
    text: await fs.readFile(file, 'utf-8'),
  })));
  for (const { file, text } of sourceFiles) {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match lines that have a console.warn call but no __DEV__ guard on the same line.
      // We look for `console.warn(` without `__DEV__` anywhere on that line.
      // The guard pattern is `if (__DEV__) console.warn(...)` which counts as guarded
      // because both tokens appear on the same line.
      const hasWarn = /console\.warn\s*\(/.test(line);
      const hasGuard = /__DEV__/.test(line);
      if (hasWarn && !hasGuard) {
        unguarded.push({ file: path.relative(SRC_DIR, file), line: i + 1, text: line.trim() });
      }
    }
  }
  return unguarded;
}

describe('Phase 41 — production log guard', () => {
  it('every console.warn in src/ is wrapped in if (__DEV__) guard', async () => {
    const unguarded = await findUnguardedWarns();
    if (unguarded.length > 0) {
      const summary = unguarded
        .map(u => `  ${u.file}:${u.line}  ${u.text}`)
        .join('\n');
      throw new Error(
        `Found ${unguarded.length} unguarded console.warn call(s) in src/.\n` +
        `Wrap each in an if (__DEV__) guard so release bundles tree-shake the log.\n\n${summary}`
      );
    }
    expect(unguarded).toEqual([]);
  });

  it('all 13 originally-flagged callsites are now guarded', async () => {
    // The audit identified these 13 specific callsites. If any of them is
    // missing the guard again, this test names the file + line directly.
    const expectedPatterns: Array<{ file: string; needle: string }> = [
      { file: 'src/services/learningContext.tsx', needle: "[learning] repo open failed" },
      { file: 'src/services/userProfileContext.tsx', needle: "[profile] open failed" },
      { file: 'src/services/practiceProgressStore.ts', needle: "[practiceProgressStore] failed to hydrate" },
      { file: 'src/services/onboardingPreferenceService.ts', needle: "[onboarding] failed to load preference" },
      { file: 'src/services/onboardingPreferenceService.ts', needle: "[onboarding] failed to save preference" },
      { file: 'src/screens/DailyRushScreen.tsx', needle: "[daily-rush] failed to record flashcard review" },
      { file: 'src/screens/DailyRushScreen.tsx', needle: "[daily-rush] failed to record todo completion" },
      { file: 'src/screens/ExampleSentencesScreen.tsx', needle: "[example-sentences] failed to record study" },
            { file: 'src/screens/FlashcardsScreen.tsx', needle: "[FlashcardsScreen] failed to record flashcard review" },
            { file: 'src/screens/FlashcardsScreen.tsx', needle: "[FlashcardsScreen] markGoodAndAdvance srs.review failed" },
            // Phase 51: long-press "didn't know it" path warns under a different needle.
            { file: 'src/screens/FlashcardsScreen.tsx', needle: "[FlashcardsScreen] card_skipped srs.review failed" },
      { file: 'src/screens/QuizScreen.tsx', needle: "[quiz] failed to record todo completion" },
    ];
    for (const { file, needle } of expectedPatterns) {
      const text = await fs.readFile(path.join(SRC_DIR, '..', file), 'utf-8');
      // Find lines containing the warn message; assert each has __DEV__ on the same line.
      const matches = text.split(/\r?\n/).filter(l => l.includes(needle));
      expect(matches.length).toBeGreaterThan(0);
      for (const m of matches) {
        expect(m).toMatch(/__DEV__/);
      }
    }
  });
});
