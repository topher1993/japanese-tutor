// Phase 37c — Source-level contract assertions for the LessonsScreen gate.
// No React rendering here: we read the screen source as a string and pin
// the UI contract so a future edit cannot silently remove the gate from
// the next-week CTA or accidentally wire it into the Continue-lesson CTA.
//
// Per docs/phase-37-todo-gated-progression-proposal.md §8 phase-37c the
// five required assertions are:
//   1. Next-week CTA contains `isWeekUnlocked(` (gate is checked)
//   2. Continue-lesson CTA does NOT contain `isWeekUnlocked(` (per-week
//      flow unaffected)
//   3. Board renders legacy copy when isLegacyWeek is true (string
//      "Completed before weekly todos were introduced" must be in
//      LessonsScreen.tsx or WeeklyTodoBoardView.tsx)
//   4. Board imports/uses WeeklyTodoBoard (the import must be present
//      in LessonsScreen.tsx)
//   5. Default behavior unchanged: gate only renders when
//      `isTodoFeatureEnabled()` — the gating pattern must be present
//      in the screen source.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SCREEN_PATH = join(__dirname, '..', 'src', 'screens', 'LessonsScreen.tsx');
const VIEW_PATH = join(__dirname, '..', 'src', 'components', 'WeeklyTodoBoardView.tsx');

function loadScreenSource(): string {
  return readFileSync(SCREEN_PATH, 'utf8');
}

function loadViewSource(): string {
  return readFileSync(VIEW_PATH, 'utf8');
}

describe('phase 37c — LessonsScreen todo-gate UI contract', () => {
  it('renders WeeklyTodoBoard by importing the component', () => {
    const source = loadScreenSource();
    expect(source).toMatch(/from\s+['"]\.\.\/components\/WeeklyTodoBoardView['"]/);
    // The component name must also be referenced as a JSX element so the
    // import is not dead code (guards against an unused-import cleanup
    // sneaking the board out of the render).
    expect(source).toMatch(/<WeeklyTodoBoardView\b/);
  });

  it('next-week CTA calls isWeekUnlocked to gate the button', () => {
    const source = loadScreenSource();
    // The call to isWeekUnlocked must be present. We don't pin the exact
    // arg shape because the screen may pass weekNumber + 1 in any form.
    expect(source).toMatch(/isWeekUnlocked\s*\(/);
    // The next-week CTA copy must mention unlocking to teach the learner
    // what is blocking them — proposal §11.1.
    expect(source).toMatch(/Finish Week .*'s todos to unlock Week /);
    // The CTA must wire `disabled={...}` so the gate actually disables.
    expect(source).toMatch(/disabled=\{!nextWeekUnlocked\}/);
  });

  it('Continue-lesson CTA does NOT depend on isWeekUnlocked (per-week flow unaffected)', () => {
    const source = loadScreenSource();
    // Extract just the Continue-lesson Button block (testID="learn-continue-button")
    // and assert it does not mention isWeekUnlocked. The Button component
    // already short-circuits onPress when disabled, but the gate should
    // never reach into the per-lesson path.
    const continueMatch = source.match(/<Button[\s\S]*?testID="learn-continue-button"[\s\S]*?\/>/);
    expect(continueMatch, 'Continue-lesson Button block not found').toBeTruthy();
    expect(continueMatch![0]).not.toMatch(/isWeekUnlocked/);
    expect(continueMatch![0]).not.toMatch(/nextWeekUnlocked/);
  });

  it('renders the legacy-week copy when isLegacyWeek is true', () => {
    // The legacy string lives in WeeklyTodoBoardView (the presentational
    // component that handles the isLegacyWeek branch). Both files are
    // part of the 37c surface so we check the union.
    const screen = loadScreenSource();
    const view = loadViewSource();
    const LEGACY_COPY = 'Completed before weekly todos were introduced';
    expect(view).toContain(LEGACY_COPY);
    // LessonsScreen must reference the legacy branch through the board
    // surface (either via the component or via a string literal). At a
    // minimum it must render WeeklyTodoBoardView — already covered above.
    // We add this redundant assertion so a future editor who deletes the
    // board entirely fails this test loudly.
    expect(screen).toContain('WeeklyTodoBoardView');
  });

  it('gate UI only renders when isTodoFeatureEnabled() is true (default unchanged)', () => {
    const source = loadScreenSource();
    // The gating pattern: both the WeeklyTodoBoard block AND the
    // next-week CTA must be wrapped in `isTodoFeatureEnabled() && ...`
    // so the default learner experience (flag=false) is unchanged.
    expect(source).toMatch(/isTodoFeatureEnabled\(\)/);
    // We expect at least two `isTodoFeatureEnabled()` references (one
    // for the board, one for the CTA). Loosely assert >=2 to catch a
    // regression that removes one of the guards.
    const matches = source.match(/isTodoFeatureEnabled\(\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // Each guard must use a JSX short-circuit (&&) so nothing renders
    // when the flag is false.
    expect(source).toMatch(/isTodoFeatureEnabled\(\)\s*&&\s*[^&]/);
  });
});