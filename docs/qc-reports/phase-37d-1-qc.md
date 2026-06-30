# Phase 37d-1 — QC Report (Tusk / GPT-5.5)

Scope: `git diff a5a8f15..HEAD` (commit `41aedc5`).
Proposal: `docs/phase-37-todo-gated-progression-proposal.md` §5 + §8 phase-37d-1.

## On-disk verify: PASS
- `npx tsc --noEmit` → exit 0.
- Focused: `npx vitest run tests/phase37d1DailyRushKind.test.ts tests/phase37bLessonKind.test.ts tests/phase32DailyRushProfileKanji.test.ts` → 6 + 14 + 10 = **30 / 30 pass**.
- Full: `npm test` → **611 / 611 pass** across 84 files.
- `grep -nE "expo-sqlite|createSqliteLearningRepository|createTablesSql|openDatabaseAsync" src/screens/DailyRushScreen.tsx` → 0 matches.

## Belion-fix verified: PASS
- DailyRushScreen.tsx consumes `useLearningContext()` (line 69: `const { store: practiceStore } = useLearningContext();`) — same pattern as LessonsScreen.
- No lazy `expo-sqlite` / `createTablesSql` / `createSqliteLearningRepository` / `openDatabaseAsync` import anywhere in the screen.
- `weekNumber` is derived via `deriveDailyRushWeekNumber(progress)` (DailyRushScreen.tsx:171) reading `practiceStore.getProgress()` then running `buildLessonInteractionPath` — no hardcoded null.
- Existing `void updateProfile(profilePatch);` at DailyRushScreen.tsx:154 is preserved unchanged; the new store call is appended alongside it inside the same completion effect.
- Gate guard at DailyRushScreen.tsx:161: `if (isTodoFeatureEnabled() && practiceStore)` — short-circuits on null `practiceStore` at boot, no crash.

## Daily-rush kind wiring: PASS
- **De-dup**: practiceProgressStore.ts:119-120 — `priorDates.includes(date) ? priorDates : [...priorDates, date]` — proven by tests e (same-date repeat) and d (clamp at 1 across distinct dates).
- **Persist**: practiceProgressStore.ts:184-189 calls `repo.saveExtendedProgress({...updated, todoStates, weekTodosInitialized, todoEventCounts})` — proven by test b (saveSpy called, re-read after cold start contains the date).
- **Recompute against 2-todo shape**: practiceProgressStore.ts:153-169 seeds/clamps the `daily-rush` todo locally before the lesson-only `recomputeTodoStatesForWeek` runs; the rush todo gets `progress = 1` once any date is in `dailyRushDates[weekNumber]`. Both todos appear on the board; under strategy `all` the lesson todo remains the gate — the rush todo adds coverage without changing unlock semantics (weeklyPlans.ts:33-42, gated inactive until 37g flip).
- **Gate guard**: same effect checks `isTodoFeatureEnabled() && practiceStore` before invocation; if either fails, the legacy behavior is preserved (test a: gate-off is no-op, saveSpy not called).

## 37b test shape updates: PASS
- Test 3 (line 79): `expect(board.totalCount).toBe(2)` — explicitly reflects the 2-todo plan and asserts `allDone=false` / `canAdvance=false` under partial state with only the lesson todo seeded.
- Test 4 (line 102): seeds **both** todos complete (`lessonTodo` + `rushTodo`), asserts `completedCount=2` and `totalCount=2`, `allDone=true`, `canAdvance=true`. Both kinds are exercised.
- Test 7 (line 173): under `weekTodosInitialized: {1: true}` + both todos seeded complete → `isWeekUnlocked(2,...) === true`. The `plan.todos.find(t => t.kind === 'daily-rush')` lookup at line 212-220 is defensive against the kind not existing yet, but it does fire here.

## New P0/P1 issues
None.

## Notes (non-blocking)
- `deriveDailyRushWeekNumber` reads `practiceStore.getProgress()` once per rush completion. Fine; rush completion is rare (≤ 1/day) and the read is async without blocking the UX. If 37d-2 surfaces a hot path, consider caching the week number in a ref or `userProfileContext`.
- `practiceProgressStore.ts:188` uses `as unknown as Record<string, unknown>` for `todoEventCounts` — matches the 37b pattern at line 84, consistent codebase-wide.

## QC verdict: PASS

## Recommendation: ship 37d-1; proceed to 37d-2