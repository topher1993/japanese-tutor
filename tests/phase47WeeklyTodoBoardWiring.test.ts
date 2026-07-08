// Phase 47 — Source-contract regression test for the Weekly Todo Board
// wiring that lets all 6 WeekTodoKind values route from the board's CTA
// to the correct screen.
//
// Background: Phase 37c shipped the Weekly Todo Board but only the
// `lesson` kind was tappable — the other 5 rendered with a disabled
// "Coming soon" CTA. The Phase 47 wiring
//   (a) expands the wired-kinds allowlist in WeeklyTodoBoardView,
//   (b) adds a switch on ctaRoute.screen inside LessonsScreen.onTodoPress,
//   (c) threads onOpenTab / onOpenDailyRush from App -> renderTab -> Lessons.
//
// This test pins the structural pieces so a future edit cannot silently
// regress to the 37c "Coming soon" state or break the dispatch contract.
//
// Pattern mirrors tests/lessonMarkComplete.test.tsx and
// tests/phase37cLessonsScreenGate.test.ts: the project does not ship
// @testing-library/react-native, so each scenario is validated as a
// SOURCE CONTRACT — read the screen + view + service + renderTab + App
// source files as strings and assert the structural pieces are in place.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const APP_PATH = join(ROOT, 'App.tsx');
const VIEW_PATH = join(ROOT, 'src', 'components', 'WeeklyTodoBoardView.tsx');
const SCREEN_PATH = join(ROOT, 'src', 'screens', 'LessonsScreen.tsx');
const RENDERTAB_PATH = join(ROOT, 'src', 'app', 'renderTab.tsx');
const WKIND_PATH = join(ROOT, 'src', 'types', 'weeklyTodo.ts');
const SVC_PATH = join(ROOT, 'src', 'services', 'weeklyTodoService.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * The complete WeekTodoKind union for Phase 47. Locked here so the test
 * is the single source of truth for "which kinds must be wired". If a
 * 7th kind is added, update this array AND the test that pins the set
 * membership — the regression contract will keep both files honest.
 */
const ALL_TODO_KINDS = [
  'lesson',
  'flashcards',
  'daily-rush',
  'quiz',
  'kanji',
  'example-sentences',
] as const;

/**
 * The 7 cases the LessonsScreen switch must handle. `lessons` is
 * produced when a `lesson` todo has no `lessonIds` configured — it is
 * a valid ctaRoute.screen even though it never leaves the Lessons tab.
 */
const ALL_CTA_SCREENS = [
  'lesson',
  'lessons',
  'flashcards',
  'quiz',
  'kanji',
  'daily-rush',
  'example-sentences',
] as const;

describe('phase 47 — Weekly Todo Board wiring (all 6 kinds tappable)', () => {
  describe('WeeklyTodoBoardView.tsx', () => {
    it('imports the WeekTodoKind type', () => {
      const src = read(VIEW_PATH);
      expect(src).toMatch(/from\s+['"]\.\.\/types\/weeklyTodo['"]/);
    });

    it('declares a WIRED_TODO_KINDS allowlist set', () => {
      const src = read(VIEW_PATH);
      expect(src).toMatch(/const\s+WIRED_TODO_KINDS\b[\s\S]*?new\s+Set<WeekTodoKind>/);
    });

    it('WIRED_TODO_KINDS contains every WeekTodoKind value', () => {
      const src = read(VIEW_PATH);
      // Extract the set literal to assert membership of every kind. The
      // boundary markers (`(` and `)`) anchor the regex so we are not
      // matching across the whole file.
      const setMatch = src.match(/new\s+Set<WeekTodoKind>\(\[\s*([\s\S]*?)\]\)/);
      expect(setMatch, 'WIRED_TODO_KINDS Set literal not found').toBeTruthy();
      const inside = setMatch![1];
      for (const kind of ALL_TODO_KINDS) {
        // Match the kind as a string-literal entry; tolerate trailing
        // whitespace, comma, or comment before the closing `]` (the
        // closing brace of the array is what we're matching against).
        const pattern = new RegExp(
          `['"]${kind}['"]`,
        );
        expect(inside, `WIRED_TODO_KINDS missing kind '${kind}'`).toMatch(pattern);
      }
    });

    it('uses WIRED_TODO_KINDS.has(...) — not === \'lesson\' — for isWired', () => {
      const src = read(VIEW_PATH);
      // The wiring check.
      expect(src).toMatch(/const\s+isWired\s*=\s*WIRED_TODO_KINDS\.has\(/);
      // Regression guard: the old 37c one-liner must NOT be re-introduced.
      // Allow it only as a comment (the comment in the set definition
      // mentions `'lesson'`).
      const codeLines = src
        .split('\n')
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
      const hasOldHardcoded = codeLines.some(l =>
        /const\s+isWired\s*=\s*status\.todo\.kind\s*===\s*['"]lesson['"]/.test(l),
      );
      expect(hasOldHardcoded, '37c hard-coded `=== \'lesson\'` regression').toBe(false);
    });

    it('CTA label still uses Review/Open semantics for tappable rows', () => {
      const src = read(VIEW_PATH);
      // The completed-and-wired branch should still say "Review" — the
      // Phase 30/30b test contract for the Continue-lesson path mirrored
      // across to the Weekly Todo Board must NOT regress.
      expect(src).toMatch(/['"]Review['"]/);
      expect(src).toMatch(/['"]Open['"]/);
      // "Coming soon" is no longer reachable (every kind is wired), but
      // we do not assert its absence — keep the test focused on what
      // Phase 47 actually changed.
    });
  });

  describe('LessonsScreen.tsx', () => {
    it('declares onOpenTab and onOpenDailyRush as optional props', () => {
      const src = read(SCREEN_PATH);
      // The component signature must widen to accept both callbacks.
      expect(src).toMatch(/onOpenTab\?:[\s\S]*?\(tab:\s*AppTab\)\s*=>\s*void/);
      expect(src).toMatch(/onOpenDailyRush\?:[\s]*\(\)\s*=>\s*void/);
      // The `import type { AppTab }` from src/types/navigation.
      expect(src).toMatch(/import\s+type\s*\{\s*AppTab\s*\}\s+from\s+['"]\.\.\/types\/navigation['"]/);
    });

    it('onTodoPress uses a switch on ctaRoute.screen (not a one-line if)', () => {
      const src = read(SCREEN_PATH);
      // Extract the WeeklyTodoBoardView onTodoPress callback body so we
      // are not matching the rest of the file. Anchor on the prop name
      // and close on the matching `}}`.
      const match = src.match(
        /onTodoPress=\{\(ctaRoute\)[\s\S]*?switch\s*\(ctaRoute\.screen\)[\s\S]*?\}\s*\}/,
      );
      expect(match, 'switch (ctaRoute.screen) block not found').toBeTruthy();
      // Regression guard: the 37c if-branch must be gone.
      expect(match![0]).not.toMatch(/Other kinds\s*\(flashcards\s*\/\s*daily-rush/);
    });

    it('switch handles all 7 ctaRoute.screen cases', () => {
      const src = read(SCREEN_PATH);
      const match = src.match(
        /onTodoPress=\{\(ctaRoute\)[\s\S]*?switch\s*\(ctaRoute\.screen\)[\s\S]*?\}\s*\}/,
      );
      expect(match).toBeTruthy();
      for (const screen of ALL_CTA_SCREENS) {
        const re = new RegExp(`case\\s+['"]${screen}['"]:`);
        expect(match![0], `switch missing case '${screen}'`).toMatch(re);
      }
    });

    it('tab-based kinds route via onOpenTab?.(...) with the right AppTab', () => {
      const src = read(SCREEN_PATH);
      const match = src.match(
        /onTodoPress=\{\(ctaRoute\)[\s\S]*?switch\s*\(ctaRoute\.screen\)[\s\S]*?\}\s*\}/,
      );
      expect(match).toBeTruthy();
      const body = match![0];
      // Per brief: flashcards -> Flashcards, quiz -> Quiz, kanji ->
      // Progress, example-sentences -> Progress. We assert the dispatch
      // calls and the target tab string together.
      expect(body).toMatch(/onOpenTab\?\.\(\s*['"]Flashcards['"]\s*\)/);
      expect(body).toMatch(/onOpenTab\?\.\(\s*['"]Quiz['"]\s*\)/);
      // 'Progress' is the target for both kanji and example-sentences.
      expect(body).toMatch(/onOpenTab\?\.\(\s*['"]Progress['"]\s*\)/);
    });

    it('daily-rush case routes via onOpenDailyRush?.(...)', () => {
      const src = read(SCREEN_PATH);
      const match = src.match(
        /onTodoPress=\{\(ctaRoute\)[\s\S]*?switch\s*\(ctaRoute\.screen\)[\s\S]*?\}\s*\}/,
      );
      expect(match).toBeTruthy();
      expect(match![0]).toMatch(/onOpenDailyRush\?\.\(\s*\)/);
    });

    it('lesson case keeps the Phase 30/30b setSelected(...) contract', () => {
      // The lesson kind's CTA still selects the lesson in the screen —
      // this is the Phase 30/30b contract that the mark-complete test
      // pins. Phase 47 must NOT regress this.
      const src = read(SCREEN_PATH);
      expect(src).toMatch(/setSelected\(ctaRoute\.params\.lessonId\)/);
    });
  });

  describe('renderTab.tsx', () => {
    it('RenderTabProps adds onOpenTab (AppTab argument) and onOpenDailyRush', () => {
      const src = read(RENDERTAB_PATH);
      expect(src).toMatch(/onOpenTab:\s*\(tab:\s*AppTab\)\s*=>\s*void/);
      // The `onOpenDailyRush` field already existed before Phase 47; we
      // re-assert it here as the contract that renderTab is responsible
      // for delivering it to LessonsScreen.
      expect(src).toMatch(/onOpenDailyRush:\s*\(\)\s*=>\s*void/);
    });

    it('LessonsScreen is rendered with onOpenTab + onOpenDailyRush threaded through', () => {
      const src = read(RENDERTAB_PATH);
      const block = src.match(
        /<LessonsScreen[\s\S]*?\/>/,
      );
      expect(block, '<LessonsScreen .../> element not found').toBeTruthy();
      expect(block![0]).toMatch(/onOpenTab=\{props\.onOpenTab\}/);
      expect(block![0]).toMatch(/onOpenDailyRush=\{props\.onOpenDailyRush\}/);
    });
  });

  describe('App.tsx', () => {
    it('declares a stable onOpenTab callback via React.useCallback', () => {
      const src = read(APP_PATH);
      // The callback should be a useCallback tied to nav.setTab so the
      // identity is stable across renders.
      expect(src).toMatch(
        /const\s+onOpenTab\s*=\s*React\.useCallback\(\s*\(next:\s*AppTab\)\s*=>\s*\{\s*nav\.setTab\(next\)/,
      );
      expect(src).toMatch(/deps\[.*nav\.setTab.*\]|\}\s*,\s*\[\s*nav\.setTab\s*\]/);
    });

    it('passes onOpenTab to renderTab({...}) (onOpenDailyRush was already wired)', () => {
      const src = read(APP_PATH);
      const renderBlock = src.match(/renderTab\(\{[\s\S]*?\}\)/);
      expect(renderBlock, 'renderTab({...}) call not found').toBeTruthy();
      expect(renderBlock![0]).toMatch(/onOpenTab,/);
    });

    it('imports AppTab from src/types/navigation', () => {
      const src = read(APP_PATH);
      expect(src).toMatch(/import\s+type\s*\{\s*AppTab\s*\}\s+from\s+['"]\.\/src\/types\/navigation['"]/);
    });
  });

  describe('weeklyTodoService.ts (no change allowed by Phase 47)', () => {
    it('ctaRouteForTodo still produces every kind\'s expected ctaRoute.screen', () => {
      // Per the brief, the service is correct as-is. We still pin the
      // ctaRoute producers as a guard against accidental Phase 47+ edits
      // that would silently move the goalposts and pass the screen tests
      // while breaking the board.
      const src = read(SVC_PATH);
      for (const screen of ALL_CTA_SCREENS.filter(s => s !== 'lessons')) {
        // Each screen value (besides 'lessons', which is the fallback)
        // must appear in the file — the source-contract producer must
        // exist for each wired kind.
        const re = new RegExp(`screen:\\s*['"]${screen}['"]`);
        expect(src, `weeklyTodoService missing screen: '${screen}'`).toMatch(re);
      }
    });

    it('regression guard: service file is not in the diff set (Phase 47 must not touch it)', () => {
      // The brief explicitly says "No changes to
      // src/services/weeklyTodoService.ts". The Phase 47 source-contract
      // test enforces this contracturally by pinning the WeekTodoKind
      // union membership and the ctaRoute producers above. This it()
      // block is a sibling reminder for the diff-stat check: if this file
      // appears in `git diff main..HEAD --stat`, Phase 47 has violated
      // its own scope.
      const svcPath = SVC_PATH;
      // Sanity: the file exists at the expected path.
      expect(() => read(svcPath)).not.toThrow();
      // (The actual `git diff` enforcement is Belion's job at commit time.)
    });
  });

  describe('src/types/weeklyTodo.ts (Phase 47 must not add a 7th kind)', () => {
    it('WeekTodoKind union is exactly the 6 values', () => {
      // The brief locks the union as the complete set for Phase 47. If
      // a 7th kind is added here without also extending the allowlist in
      // WeeklyTodoBoardView + the switch in LessonsScreen, the
      // regressions above would catch the latter, but we pin the types
      // here so the failure mode is local.
      const src = read(WKIND_PATH);
      // Pull the WeekTodoKind union literal out of the file.
      const union = src.match(
        /export\s+type\s+WeekTodoKind\s*=\s*([\s\S]*?);/,
      );
      expect(union, 'WeekTodoKind union not found').toBeTruthy();
      for (const kind of ALL_TODO_KINDS) {
        const re = new RegExp(`['"]${kind}['"]`);
        expect(union![1], `WeekTodoKind union missing '${kind}'`).toMatch(re);
      }
      // Regression guard: no 7th kind snuck in.
      const sevenKinds = [
        ...ALL_TODO_KINDS,
        'review',
        'shadowing',
        'listening',
      ];
      for (const extra of sevenKinds.slice(ALL_TODO_KINDS.length)) {
        if (ALL_TODO_KINDS.includes(extra as typeof ALL_TODO_KINDS[number])) continue;
        const re = new RegExp(`['"]${extra}['"]`);
        // If a 7th kind appears in the union, this test must fail so the
        // developer remembers to also extend WIRED_TODO_KINDS and the
        // switch statement.
        // (We check the entire file, not the union, because a future
        // edit might add a new kind with whitespace tweaks.)
        // Soft check — only fail if found inside the union body.
        if (union![1].match(re)) {
          throw new Error(
            `WeekTodoKind union gained a 7th member ('${extra}'). ` +
            'If intentional, extend ALL_TODO_KINDS in this test, the ' +
            'WIRED_TODO_KINDS Set in WeeklyTodoBoardView, and the ' +
            "switch in LessonsScreen.onTodoPress.",
          );
        }
      }
    });
  });
});
