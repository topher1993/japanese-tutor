/**
 * Phase 25 / P0-1 — TSX generic-arrow parse failure guard.
 *
 * GPT-5.5 re-audit (Phase 24, 2026-06-25) flagged that `App.tsx:117`,
 * `App.tsx:176`, and `src/services/learningContext.tsx:72` used
 * inline `<T>(...)` generic arrow functions inside `.tsx` files.
 * `.tsx` parser treats `<T>` as a JSX element-start, so Metro may
 * either fail to parse or silently strip the generic — vitest does
 * not exercise this path because ts-jest uses a separate channel.
 *
 * This test grep-validates that no inline generic-arrow remains in any
 * `.tsx` file. Typed wrappers (function declarations, type aliases,
 * interface methods) are allowed; only the object-literal
 * `{ ... getAllAsync: <T>(...) ... }` shape is forbidden in `.tsx`.
 *
 * Phase 43 — App.tsx split: the SqliteLikeDatabase cast moved out of
 * App.tsx into `src/app/onboardingStorage.ts`. The "must exist somewhere"
 * scan now covers App.tsx + src/app/onboardingStorage.ts. The new
 * "App.tsx must NOT contain" assertion guards against regression.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function findTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      findTsxFiles(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('Phase 25 / P0-1 — TSX generic-arrow guard', () => {
  it('no inline <T>(...) generic-arrow remains in any .tsx file', () => {
    const tsxFiles = findTsxFiles(process.cwd());
    expect(tsxFiles.length).toBeGreaterThan(0);

    const offenders: Array<{ file: string; line: number; text: string }> = [];
    // The forbidden shape: a property/variable followed by ": <T>(..." inside a .tsx.
    // We allow <T> in function declarations (e.g. `function f<T>(...)`) and in
    // type-parameter lists (`<T,>`) and in casts (`as <T>`) — only flag the
    // arrow-after-colon pattern that the Metro .tsx parser chokes on.
    const pattern = /:\s*<[A-Z][A-Za-z0-9_]*>\s*\(/;

    for (const file of tsxFiles) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip line if it's a type/interface body declaration (not a value).
        // The risky shape is property-shorthand or destructuring with a generic
        // arrow immediately after a colon — that's what Metro mis-parses.
        if (pattern.test(line)) {
          offenders.push({ file, line: i + 1, text: line.trim() });
        }
      }
    }

    if (offenders.length > 0) {
      const msg = offenders
        .map(o => `  ${o.file}:${o.line} → ${o.text}`)
        .join('\n');
      throw new Error(
        `Found ${offenders.length} TSX generic-arrow offenders:\n${msg}\n` +
          `Fix: replace the inline generic-arrow with a typed wrapper or a SqliteLikeDatabase['getAllAsync'] cast.`
      );
    }
  });

  it('App shell uses SqliteLikeDatabase cast for getAllAsync (now in src/app/onboardingStorage.ts)', () => {
    // Phase 43: App.tsx no longer contains the cast (it's in onboardingStorage.ts).
    // Scan covers App.tsx + src/app/onboardingStorage.ts. ≥1 occurrence
    // (the refactor deduplicated the loader + saver cast sites into one
    // helper, so we no longer need 2 — see PR description).
    const app = readFileSync('App.tsx', 'utf8');
    const storage = readFileSync('src/app/onboardingStorage.ts', 'utf8');
    const all = app + '\n\n' + storage;
    const matches = all.match(/as SqliteLikeDatabase\['getAllAsync'\]/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(1);
    // App.tsx must NOT contain the cast (regression guard).
    expect(app).not.toMatch(/as SqliteLikeDatabase\['getAllAsync'\]/);
  });

  it('learningContext.tsx uses SqliteLikeDatabase cast for getAllAsync', () => {
    const lc = readFileSync('src/services/learningContext.tsx', 'utf8');
    expect(lc).toMatch(/as SqliteLikeDatabase\['getAllAsync'\]/);
  });

  it('App shell imports SqliteLikeDatabase type (now in src/app/onboardingStorage.ts)', () => {
    // Phase 43: App.tsx no longer imports SqliteLikeDatabase.
    // Scan covers App.tsx + src/app/onboardingStorage.ts.
    const app = readFileSync('App.tsx', 'utf8');
    const storage = readFileSync('src/app/onboardingStorage.ts', 'utf8');
    const all = app + '\n\n' + storage;
    expect(all).toMatch(
      /import\s+type\s+\{\s*SqliteLikeDatabase\s*\}\s+from\s+['"][^'"]*repositories\/sqliteLearningRepository['"]/
    );
    // App.tsx must NOT import the type (regression guard).
    expect(app).not.toMatch(
      /import\s+type\s+\{\s*SqliteLikeDatabase\s*\}/
    );
  });

  it('typecheck no longer fails on App shell + learningContext.tsx (no inline <T> getAllAsync anywhere)', () => {
    // Phase 43: App.tsx is checked, but the actual cast site is in
    // src/app/onboardingStorage.ts. Both must NOT have the inline shape.
    const app = readFileSync('App.tsx', 'utf8');
    const storage = readFileSync('src/app/onboardingStorage.ts', 'utf8');
    const lc = readFileSync('src/services/learningContext.tsx', 'utf8');
    expect(app).not.toMatch(/getAllAsync:\s*<T>\(/);
    expect(storage).not.toMatch(/getAllAsync:\s*<T>\(/);
    expect(lc).not.toMatch(/getAllAsync:\s*<T>\(/);
  });
});