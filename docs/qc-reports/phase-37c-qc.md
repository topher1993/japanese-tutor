# Phase 37c — Lessons tab gate UI — QC review

Scope: `git diff bf6254f..a5a8f15` (4 files, +369/-33). On-disk verify run 2026-07-01.

## On-disk verify: PASS

- `npx tsc --noEmit` → exit 0, no errors.
- `npx vitest run tests/phase37cLessonsScreenGate.test.ts` → 5/5 pass in 217ms.
- `npm test` → 605/605 pass in 5.21s, 83 files. No regressions on phase20a, phase30, phase38LessonsInteractionPath, phaseDeadButtons.

## Contract invariants

1. Continue-lesson `Button` (`testID="learn-continue-button"` at `src/screens/LessonsScreen.tsx:354-368`) has zero references to `isWeekUnlocked` or `nextWeekUnlocked` — per-week flow untouched. **PASS**.
2. Next-week CTA (`LessonsScreen.tsx:377-393`) gates via `disabled={!nextWeekUnlocked}` and the call `isWeekUnlocked(nextWeekNumber, todoBoards, todoPayload)` at L77. **PASS**.
3. Both gate blocks wrapped in `isTodoFeatureEnabled() && …` (L323 board, L377 CTA). Verified by source-level test #5 + `grep` returns 2 matches. Default learner sees no change. **PASS**.
4. `WeeklyTodoBoardView` imported at L27 and rendered as JSX at L326 (`<WeeklyTodoBoardView …/>`). Pinned by source-level test #1. **PASS**.
5. Legacy string `'Completed before weekly todos were introduced'` lives in `WeeklyTodoBoardView.tsx:21` and renders when `board.isLegacyWeek` is true. Pinned by source-level test #4. **PASS**.

## 5 source-level tests: well-designed

Pins real invariants, not noise. Asserts the call shape (`isWeekUnlocked\s*\(`), the disabled prop (`disabled={!nextWeekUnlocked}`), the legacy copy token, the JSX usage (not just import), and `>=2` flag references so a guard-strip is caught. Negative assertion (`<Button …testID="learn-continue-button" …/>` block must NOT match `isWeekUnlocked|nextWeekUnlocked`) is the strongest defense against the §1 regression. **PASS**.

## LessonsScreen structural checks

- Hooks order: `useMemo` (L65, L71) and the `useEffect` at L82 run at L82/L89 BEFORE the early-return `if (showExamples)` / `if (showKanji)` / `if (selectedCategory === 'workplace')` / `if (selectedCategory)` blocks at L100/L109/L118/L127. Rules of Hooks satisfied. **PASS**.
- Continue-lesson label formula at L355-360 unchanged from pre-37c: `dailyLesson.isCourseComplete ? 'Review lessons 🎉' : dailyLesson.isWeekPreview ? \`Start Week ${weekProgress.index}\` : \`Continue ${dailyLesson.lesson.title}\``. `onPress` is still `setSelected(dailyLesson.lesson.id)` at L362-364. **PASS**.
- `WeeklyTodoBoardView` row pressable has `accessibilityRole="button"` + `accessibilityState={{ disabled: !enabled }}` and `disabled={!enabled}`. **NO `testID` or `hitSlop`** — minor (see N1). Accessible but not test-targetable at row level; gate is only testIDed at screen level.

## Lessons-screen regression risk: NONE

The two new JSX blocks are both fully gated by `isTodoFeatureEnabled()` (default false in 37c, flipped only by 37g). Continue-lesson path is byte-identical to bf6254f except for surrounding indentation. Five existing Lessons-tab test files all green. The new CTA consumes `lessons.find(l => l.week === nextWeekNumber)` which falls back to undefined → onPress is a safe no-op (the `if (nextWeekFirstLesson)` guard at L387 makes that explicit).

## New P0/P1 issues

None. Two non-blocking N2s:

- N1: `WeeklyTodoBoardView` Pressable has no `testID` / `hitSlop`. Acceptable because (a) per-row interaction is gated UI not yet featured and (b) row reactivity is covered at the component import level. Add `testID={\`todo-row-\${status.todo.id}\`}` opportunistically when 37d-1 wires the next kind.
- N2: `WeeklyTodoBoardView.tsx` is missing trailing newline (`No newline at end of file` on the diff). Trivial.

## QC verdict: PASS-WITH-NITS

## Recommendation: ship 37c

37g (the flag flip) is the next real surface; 37d-1..5 will then wire the `flashcards / daily-rush / quiz / kanji / example-sentences` todo kinds into this same board — the `'Coming soon'` row copy and `disabled` state already model that correctly. Trusting prior 37a/37b QC; this is the on-disk gating check.
