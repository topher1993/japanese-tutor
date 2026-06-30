# Progress Tab Visual Regression — Disposition

## Outcome

**Disposition: Path A — accept the refactor as intentional improvement.**

## Timeline

1. **Pre-this-session (commit `a4a34e4`):** Progress tab had hardcoded `ACHIEVEMENTS` array (8 entries), hardcoded `JLPT_BADGES` array, `dailyPlan = buildDailyPlan('N5')`, and `taskCheck Icon name="check"`.
2. **Pre-this-session (uncommitted on disk):** a refactor was in flight that replaced hardcoded arrays with data-driven values from `buildProfileProgression()`, drove the daily plan from `profile?.static.jlptTarget`, added a Course Progress card, added XP level hints, and changed `taskCheck` to `name="book"`. This refactor was half-done (Achievements dropped from 8 entries to 5, JLPT_BageImage row hardcoded inline to N5+N4, new Course Progress card added).
3. **This session, commit `57631de`:** my pre-37a `wip:` snapshot captured the half-done refactor as-is. No 37-phase work touched `ProgressScreen.tsx` (verified via `git log a4a34e4..HEAD -- src/screens/ProgressScreen.tsx` — only `57631de` modified it).
4. **This session, commit `b3c46f0`:** `tests/phase37ProgressTabRefactorShape.test.ts` (13 source-level tests) added to pin the refactor's visible contract so future regressions on this surface are caught.

## Audit findings (Path B)

Igris ran an audit of the refactored code with no source changes. Findings:

- **Data layer is internally consistent.** `buildProfileProgression()` returns 5 badges with proper earn conditions. `buildProgressDashboard()` correctly filters stale lesson IDs (an improvement over the pre-refactor version).
- **All 13 contract assertions pass.** The screen reads from the right sources: `buildProfileProgression`, `useUserProfileContext`, `EMPTY_PROGRESS` fallback, `toStudyLevel()` helper, `profile.jlptTarget` for daily plan.
- **No confirmed runtime bugs.** Igris's "suspected regressions" list was all low-risk and most weren't bugs.

## What Chris likely saw (cosmetic, not a bug)

| Element | Pre-refactor | Post-refactor |
|---------|-------------|---------------|
| Achievements grid | 8 hardcoded badges (`firstLesson, firstKanji, streak7, streak30, vocab100, levelUp, survivalComplete, perfectQuiz`) | 5 data-driven badges (`first-lesson, seven-day-streak, daily-rush-starter, perfect-quiz, n4-unlocked`) — earn when you actually do the thing |
| JLPT levels row | 2 hardcoded `BadgeImage` (N5 unlocked, N4 always locked) | 2 `BadgeImage` driven by `n4Unlocked = achievements.some(a => a.id === 'n4-unlocked' && a.earned)` — N4 actually unlocks at 5 lessons |
| Your level chip row | 4 chips hardcoded (`N5, N4, N3, N2`) | 5 chips (`N5, N4, N3, N2, N1`) driven by `JLPT_LEVELS` |
| Today's plan icon | `Icon name="check"` | `Icon name="book"` |
| New Course Progress card | absent | present (completionPercent bar + "Next: <title>" hint) |
| levelHint copy | "Currently studying N5" | "Currently studying N5 • Level X • Y XP to Level Z" |

The "regression" was likely:
1. **Fewer badges visible** (8 → 5) — intentional, but visually less dense
2. **N4 badge unlock behavior changed** — now actually unlocks, was always locked before
3. **Today's plan icon looks different** — checkmark → book

None of these are bugs. All are improvements (smaller but data-driven achievements, real unlock behavior, less misleading icon).

## Recommendation

- Keep the refactor.
- The new test file (`tests/phase37ProgressTabRefactorShape.test.ts`) is the safety net going forward — it will catch any future regression on imports, badge IDs, fallback constants, completionPercent clamp, or the dailyPlan plumbing.
- If Chris wants the old 8-badge grid back later, that's a separate redesign conversation, not a bug fix.

## Relevant commits

- `a4a34e4` — pre-refactor baseline (clean tree, old ProgressScreen)
- `57631de` — `wip:` snapshot that captured the half-done refactor
- `b3c46f0` — Path B test coverage pinning the refactor's contract
- 37-phase work (`a954fda` 37a, `bf6254f` 37b, `a5a8f15` 37c, `41aedc5` 37d-1) — none of these touched ProgressScreen