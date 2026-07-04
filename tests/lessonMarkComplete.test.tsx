// Phase 39 (Igris mark-complete fix) — regression tests pinning the
// LessonsScreen mark-complete handler + CompletionToast error channel.
//
// Pattern mirrors tests/phaseDeadButtons.test.ts and
// tests/phase37cLessonsScreenGate.test.ts: the project does not ship
// @testing-library/react-native, so the four scenarios from the brief
// are validated as a SOURCE CONTRACT — read the screen + hook + toast
// source files as strings and assert the structural pieces are in place.
//
// The four scenarios (from the brief):
//
//   (a) Incomplete state — incomplete branch renders
//       <Button label="Mark this lesson complete"> with onPress wired to
//       handleMarkComplete.
//
//   (b) Store unavailable path — handleMarkComplete synchronously
//       checks `if (!store) { notifyLessonError({...}) }`. Also: the
//       button has `disabled={!store || markInFlight}`.
//
//   (c) Tap calls store + reads back progress + setSelected — the
//       handler body awaits completeCurrentLesson + getProgress and
//       calls setProgress + setSelected(next.id|undefined).
//
//   (d) Error surfacing — the catch (err) branch emits
//       notifyLessonError({ kind: 'completion-failed', ...}), NOT a
//       silent empty catch.
//
// ALSO: assert the COMPLETION-TOAST module exposes the error channel
// (notifyLessonError + LessonErrorToast) so the runtime above has
// somewhere to publish to.
//
// Phase 43 — handleMarkComplete moved from LessonsScreen.tsx to
// src/screens/lessons/useMarkComplete.ts. Tests now scan both files:
//   - LessonsScreen.tsx owns the <Button onPress={handleMarkComplete}>
//     JSX wiring and the useMarkComplete() invocation.
//   - useMarkComplete.ts owns the React.useCallback body, the catch (err)
//     clause, and the markInFlight state machine.
// Regression guards assert LessonsScreen.tsx must NOT re-inline these.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const APP_PATH = join(ROOT, 'App.tsx');
const SCREEN_PATH = join(ROOT, 'src', 'screens', 'LessonsScreen.tsx');
const HOOK_PATH = join(ROOT, 'src', 'screens', 'lessons', 'useMarkComplete.ts');
const TOAST_PATH = join(ROOT, 'src', 'components', 'CompletionToast.tsx');

function loadAppSource(): string {
  return readFileSync(APP_PATH, 'utf8');
}
function loadScreenSource(): string {
  return readFileSync(SCREEN_PATH, 'utf8');
}
function loadHookSource(): string {
  return readFileSync(HOOK_PATH, 'utf8');
}
function loadToastSource(): string {
  return readFileSync(TOAST_PATH, 'utf8');
}

describe('phase 39 — LessonsScreen mark-complete button (source contract)', () => {
  describe('(a) Incomplete state', () => {
    it('renders <Button label="Mark this lesson complete"> with onPress wired to handleMarkComplete', () => {
      const src = loadScreenSource();
      // Pin the button label text in source — guarantees the incomplete
      // branch is still being rendered (as opposed to being swapped for
      // a "Lesson complete ✓" terminal state).
      expect(src).toContain('"Mark this lesson complete"');
      // Locate the Button block and assert its onPress routes to the
      // phase-39 named handler. Using a non-greedy match anchored on
      // the testID so we don't accidentally match a different button
      // (the lessons list CTA also has its own onPress).
      const buttonBlock = src.match(
        /<Button\b[\s\S]*?testID="lesson-mark-complete-button"[\s\S]*?\/>/,
      );
      expect(buttonBlock, 'mark-complete Button block missing').not.toBeNull();
      expect(buttonBlock![0]).toContain('onPress={handleMarkComplete}');
    });
  });

  describe('(b) Store unavailable path', () => {
    it('handler synchronously guards against !store with notifyLessonError', () => {
      // Phase 43: !store guard now lives in src/screens/lessons/useMarkComplete.ts
      const hookSrc = loadHookSource();
      // The defensive runtime guard must read `if (!store)` and call
      // notifyLessonError('store-unavailable') before returning.
      expect(hookSrc).toMatch(/if\s*\(\s*!store\s*\)/);
      expect(hookSrc).toContain("notifyLessonError({ kind: 'store-unavailable'");
      // And the button must NOT be disabled only because !store. If the
      // store is unavailable, the tap must reach handleMarkComplete so
      // notifyLessonError can tell the user what happened instead of the
      // CTA looking dead.
      const screenSrc = loadScreenSource();
      const buttonBlock = screenSrc.match(
        /<Button\b[\s\S]*?testID="lesson-mark-complete-button"[\s\S]*?\/>/,
      );
      expect(buttonBlock, 'mark-complete Button block missing').not.toBeNull();
      expect(buttonBlock![0]).toMatch(/disabled=\{markInFlight\}/);
      expect(buttonBlock![0]).not.toMatch(/disabled=\{!store\s*\|\|\s*markInFlight\}/);
      // Regression guard: !store guard must NOT be re-inlined in LessonsScreen.tsx
      expect(screenSrc).not.toMatch(/if\s*\(\s*!store\s*\)/);
    });

    it('does not show a green check icon on the incomplete-state CTA', () => {
      const src = loadScreenSource();
      const buttonBlock = src.match(
        /<Button\b[\s\S]*?testID="lesson-mark-complete-button"[\s\S]*?\/>/,
      );
      expect(buttonBlock, 'mark-complete Button block missing').not.toBeNull();
      expect(buttonBlock![0]).not.toContain('iconRight="check"');
      expect(buttonBlock![0]).not.toContain('iconRight={markInFlight ? undefined : "check"}');
      expect(buttonBlock![0]).toContain('Saving lesson...');
    });
  });

  describe('(c) Tap → store + read-back progress + setSelected', () => {
    it('handler awaits completeCurrentLesson and reads back progress', () => {
      // Phase 43: handler body now in src/screens/lessons/useMarkComplete.ts
      const hookSrc = loadHookSource();
      // The handler body must contain the four expected calls (in this
      // order):
      //
      //   await store.completeCurrentLesson(lesson.id, 100, <ISO>)
      //   const refreshed = await store.getProgress()
      //   setProgress(refreshed)
      //   setSelected(next.id)  OR  setSelected(undefined)
      //
      // These are the structural pieces of the mark-complete contract;
      // if any of them go missing the visible symptom (silent freeze,
      // stale completion count) reappears.
      //
      // The hook's markComplete is wrapped in useCallback (deps may differ
      // slightly from the original — we accept either [selectedLesson, store]
      // or the expanded [selectedLesson, store, lessons, setProgress, setSelected]
      // dependency set).
      const handler = hookSrc.match(
        /markComplete\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[selectedLesson\s*,\s*store[\s\S]*?\]\)/,
      );
      expect(handler, 'markComplete useCallback body not found').not.toBeNull();
      const body = handler![0];
      expect(body).toMatch(/await\s+store\.completeCurrentLesson\(/);
      // The completion must pass at least lesson.id + 100 (score) +
      // an ISO date string. Use a generous regex on the three args.
      expect(body).toMatch(/completeCurrentLesson\(\s*lesson\.id\s*,\s*100\s*,\s*new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/);
      expect(body).toMatch(/const\s+refreshed\s*=\s*await\s+store\.getProgress\(\)/);
      expect(body).toMatch(/setProgress\(\s*refreshed\s*\)/);
      // setSelected must be called with EITHER next.id OR undefined.
      // Both branches are legitimate (advance to next lesson or bounce
      // back to the list on course completion).
      const hasNextBranch = /setSelected\(\s*next\.id\s*\)/.test(body);
      const hasCourseCompleteBranch = /setSelected\(\s*undefined\s*\)/.test(body);
      expect(
        hasNextBranch || hasCourseCompleteBranch,
        'setSelected never called with next.id or undefined',
      ).toBe(true);
    });

    it('handler toggles markInFlight true at start + false in finally', () => {
      // Phase 43: markInFlight state lives in useMarkComplete.ts (no longer
      // a LessonsScreen local useState). Tests scan the hook file.
      const hookSrc = loadHookSource();
      // The in-flight flag must be flipped on at the start of the
      // happy path and unconditionally released in a finally block
      // (so an error path can never leave the button stuck disabled).
      const handler = hookSrc.match(
        /markComplete\s*=\s*useCallback\([\s\S]*?\}\s*,\s*\[selectedLesson\s*,\s*store[\s\S]*?\]\)/,
      );
      expect(handler).not.toBeNull();
      const body = handler![0];
      expect(body).toMatch(/setMarkInFlight\(\s*true\s*\)/);
      expect(body).toMatch(/finally\s*\{[\s\S]*?setMarkInFlight\(\s*false\s*\)/);
      // Regression guard: markInFlight state must NOT be declared in LessonsScreen.tsx
      const screenSrc = loadScreenSource();
      expect(screenSrc).not.toMatch(/const\s+\[markInFlight\s*,\s*setMarkInFlight\]\s*=\s*useState/);
    });
  });

  describe('(d) Error surfacing — silent catch removed', () => {
    it('catch block emits notifyLessonError(completion-failed) and never swallows', () => {
      // Phase 43: catch clause now lives in useMarkComplete.ts
      const hookSrc = loadHookSource();
      // (i) the catch clause must be `catch (err)` (or `catch (_err)`
      // etc. — anything with a captured binding is acceptable; the key
      // is that there IS a binding so the error is observable).
      const catchClause = hookSrc.match(/catch\s*\(\s*err\s*\)/);
      expect(catchClause, 'no `catch (err)` clause in useMarkComplete').not.toBeNull();
      // (ii) inside the catch the handler must call notifyLessonError
      // with kind: 'completion-failed'. A swallowed empty catch is
      // not acceptable.
      expect(hookSrc).toMatch(/catch\s*\(\s*err\s*\)\s*\{[\s\S]*?notifyLessonError\(\s*\{\s*kind:\s*['"]completion-failed['"]/);
      // (iii) the catch must include the lessonId + error from the
      // caught binding so the toast is actionable.
      expect(hookSrc).toMatch(/lessonId:\s*lesson\.id/);
      expect(hookSrc).toMatch(/error:\s*err\s+instanceof\s+Error\s*\?/);
      // (iv) the silent `catch {}` shape that the previous commit
      // (85c02ae) introduced is GUARDED AGAINST — there must be no
      // empty `catch { /* best-effort */ }` or `catch {}` in the
      // mark-complete handler region.
      const startIdx = hookSrc.indexOf('markComplete');
      const handlerRegion = hookSrc.slice(startIdx, startIdx + 4000);
      expect(handlerRegion).not.toMatch(/catch\s*\{\s*\/\*\s*best-effort\s*\*\/\s*\}/);
      expect(handlerRegion).not.toMatch(/catch\s*\{\s*\}/);
      // Regression guard: the catch (err) clause must NOT exist in LessonsScreen.tsx
      const screenSrc = loadScreenSource();
      expect(screenSrc).not.toMatch(/catch\s*\(\s*err\s*\)/);
    });
  });
});

describe('phase 39 — CompletionToast error channel', () => {
  it('exports notifyLessonError + LessonErrorPayload + LessonErrorToast', () => {
    const src = loadToastSource();
    // Mirror-style: the error channel must use the same listener-set
    // pattern as notifyLessonCompleted. We don't pin the literal
    // implementation, but the symbols must exist on the module's
    // public surface.
    expect(src).toContain('export type LessonErrorPayload');
    expect(src).toContain('export function notifyLessonError(');
    expect(src).toContain('export function LessonErrorToast()');
    // The bus must accept both error kinds — defensive against a
    // future refactor that only handles store-unavailable.
    expect(src).toMatch(/kind:\s*['"]store-unavailable['"]/);
    expect(src).toMatch(/kind:\s*['"]completion-failed['"]/);
  });

  it('mounts LessonErrorToast in App so notifyLessonError reaches the user', () => {
    const src = loadAppSource();
    expect(src).toContain("import { CompletionToast, LessonErrorToast } from './src/components/CompletionToast';");
    expect(src).toContain('<CompletionToast />');
    expect(src).toContain('<LessonErrorToast />');
  });
});