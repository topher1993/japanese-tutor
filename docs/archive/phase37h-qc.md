# Phase 37h — QC Report: lesson-mark-complete from todo

**QC Division:** Tusk
**Model:** GPT-5.5 (openai-codex) — reachable, `hermes -m gpt-5.5 -z "REACHABLE"` responded "Hello! Yes, I am reachable and ready. How can I help you today?"
**Repo:** `C:/Users/tophe/japanese-tutor-mobile-app`
**Commit under review:** `85c02ae Phase 37h — fix lesson-mark-complete from todo so the weekly todo board updates live`
**Scope:** strictly the lesson-mark-complete path (no preemptive review)

---

## 1. Verdict

**PASS**

The two-bug fix is correctly wired, the cache update is now unconditional across all six mutating methods, the screen-side memos read the freshly-updated `extendedCache`, and the regression tests prove the fix end-to-end on both the SQLite and in-memory code paths. `npm run typecheck` and the full `npm test` suite (91 files / 665 tests) are green. The Expo JS bundle already contains the fix.

---

## 2. Findings by severity

No blocking findings. Minor observations below.

### P0
None.

### P1
None.

### P2
None.

### P3 (nits — out of scope for lesson-mark-complete, listed only because I read the diff)

- `src/components/WeeklyTodoBoardView.tsx:32-33,100` — cosmetic `numberOfLines`/`flexShrink`/`maxWidth: '60%'` tweaks land alongside this fix but are unrelated to the bug. They were not asked to be reviewed.
- The prompt notes test 7 as "added 1 test for the in-memory-repo path" and the suite went 664 → 665. That arithmetic checks out (we are at 91 files, 665 tests).

---

## 3. Per-item verdicts (the 6 verification items from the prompt)

### 3.1 current-week rule for per-todo helper text in `weeklyTodoService.ts` — **PASS**

The rule is applied in three branches:

```ts
// src/services/weeklyTodoService.ts:108  (per-row helper, the one the user sees)
const isLegacyWeek = !isInitialized && weekNumber < currentWeek;

// src/services/weeklyTodoService.ts:141  (no-plan branch)
const isLegacyWeek = !isInitialized && weekNumber < currentWeek;

// src/services/weeklyTodoService.ts:159  (plan branch with statuses)
if (!isInitialized && weekNumber < currentWeek) { … isLegacyWeek: true … }
```

`helperTextForTodo` (line 87) gates on the row-level `isLegacyWeek`, so a current week that is uninitialized never renders "Completed before weekly todos were introduced"; it falls through to `${progress} / ${target}` (line 90).

The default `currentWeek = Number.POSITIVE_INFINITY` (lines 98, 135) preserves backwards-compat for callers that omit the argument — only an explicit `weekNumber < currentWeek` can downgrade a row to legacy.

Tests `phase37hLessonMarkCompleteTodoFlow.test.ts:118-135` pin both halves of the rule (current-week no-legacy-text, prior-week legacy-text).

### 3.2 cache update in `completeCurrentLesson` is unconditional and idempotent — **PASS**

```ts
// src/services/practiceProgressStore.ts:112-127
extendedCache = {
  todoStates: nextTodoStates,
  weekTodosInitialized: payload.weekTodosInitialized,
  todoEventCounts: payload.todoEventCounts,
};
// Cast through unknown so the two slightly-different TodoEventCounts
// shapes (one keyed by string index in the repo's ExtendedLearnerProgress
// view, one with named keys here) can converge for the persistence call.
if (typeof repo.saveExtendedProgress === 'function') {
  await repo.saveExtendedProgress({ … } … );
}
```

- The cache write is bare-assignment, no gate. Only the disk persistence call is gated on `typeof repo.saveExtendedProgress === 'function'`. That matches the fix description.
- Idempotency: `recomputeTodoStatesForWeek` (weeklyTodoService.ts:243-277) derives every todo from `{ todoStates, weekTodosInitialized, todoEventCounts, completedLessonIds }`; nothing accumulates across calls. `nextTodoStates = { ...seed, ...recomputed }` plus the always-fresh `payload.weekTodosInitialized[lessonWeek] = true` guarantees two calls converge.
- Test 7 (line 243-270) is the explicit regression for this: it uses `createInMemoryLearningRepository` (which intentionally omits `saveExtendedProgress`) and proves `store.getExtendedProgress()` still shows `progress: 1` after `completeCurrentLesson`.

### 3.3 same pattern applied to all 5 `record*` methods — **PASS**

All six mutating methods follow the identical shape: build `seed` → recompute → assign `extendedCache` unconditionally → `if (typeof repo.saveExtendedProgress === 'function')` persistence.

| Method | Cache update (unconditional) | Persistence (gated) |
| --- | --- | --- |
| `completeCurrentLesson` | `practiceProgressStore.ts:112-116` | `120` |
| `recordDailyRushComplete` | `237-241` | `244-251` |
| `recordFlashcardReview` | `365-369` | `372-379` |
| `recordKanjiGood` | `501-505` | `508-515` |
| `recordQuizAttempt` | `631-635` | `638-645` |
| `markExampleViewed` | `766-770` | `773-780` |

`reset()` (line 791-794) also wipes the cache (`extendedCache = emptyExtendedProgressCache()`), which prevents stale cache state when the learner wipes their progress mid-session. Test 6 (line 217-234) pins this.

No "silent fallback to a weaker model" detected — every record* method runs the same pure function path.

### 3.4 screen-side memoization reads `store.getExtendedProgress()` correctly — **PASS**

**LessonsScreen** (`src/screens/LessonsScreen.tsx:65-81`):

```ts
const todoPayload = React.useMemo<TodoPayload>(() => {
  const extended = store?.getExtendedProgress() ?? {
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: emptyTodoEventCounts(),
  };
  return {
    todoStates: extended.todoStates,
    weekTodosInitialized: extended.weekTodosInitialized,
    todoEventCounts: extended.todoEventCounts,
    completedLessonIds: progress?.completedLessonIds ?? [],
  };
}, [progress?.completedLessonIds, store]);
const todoBoards = React.useMemo(
  () => buildAllTodoBoards(getAllWeekPlans(), todoPayload, 'all', weekProgress.index),
  [todoPayload, weekProgress.index],
);
```

`setProgress(refreshed)` at line 231 (after `store.completeCurrentLesson` at 223) changes `progress.completedLessonIds`, which invalidates `todoPayload`. The memo body then reads `store.getExtendedProgress()` (already updated by the gate inside `completeCurrentLesson`), so `todoBoards` picks up the fresh `todoStates` next render.

**HomeScreen** (`src/screens/HomeScreen.tsx:104-120`): identical pattern with `homeProgress.completedLessonIds` as the trigger.

The `store` dep is correct because the store instance comes from `useLearningContext()` (LessonsScreen line 41 / HomeScreen line 45); React treats it as a stable ref for memo purposes. The fallback shape (empty `TodoPayload`) prevents a `Cannot read property 'todoStates' of undefined` crash if the store has not initialized yet, while still letting `completedLessonIds` flow from `progress` if any lessons have completed before the cache is populated (e.g. cold start).

### 3.5 regression tests at `tests/phase37hLessonMarkCompleteTodoFlow.test.ts` (7 tests) — **PASS**

File: 270 lines. Seven `it()` blocks at lines 118, 126, 137, 157, 199, 217, 243 — call them tests 1–7.

| # | Topic | Source line |
| --- | --- | --- |
| 1 | current week, uninitialized → no legacy helper text | 118-124 |
| 2 | prior week, uninitialized → legacy helper text | 126-135 |
| 3 | after marking the lesson todo completed → "Done — N/N" | 137-155 |
| 4 | completeCurrentLesson updates `store.getExtendedProgress()` so the UI sees fresh todoStates | 157-197 |
| 5 | completeCurrentLesson no-op while the gate flag is off (default-learner path) | 199-215 |
| 6 | reset() wipes the in-memory extended cache (P0-2 regression) | 217-234 |
| 7 | in-memory-repo path still updates the cache (web runtime shape) | 243-270 |

Evidence-quality check: no `it.skip`, no `it.todo`, no `expect(true).toBe(true)` placeholders. Every assertion is concrete (`expect(lessonState.progress).toBe(1)`, `expect(after.weekTodosInitialized[1]).toBe(true)`, etc.). `setTodoFeatureEnabled(true|false)` is toggled in `beforeEach`/`afterEach` with a default `false` reset, so cross-test state is contained. No fabricated data — all exercise real `getWeekPlan(1)`, real `createInMemoryLearningRepository`, and real SQLite mocking via the hand-rolled `SqliteLikeDatabase` mock.

`phase37bLessonKind.test.ts` was updated (test 2 split into 2 and 2b) to match the current-week rule; that is consistent and expected.

### 3.6 typecheck + full test suite + live bundle evidence — **PASS**

| Step | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run typecheck` | exit 0, no output errors. |
| Full suite | `npm test 2>&1 \| tail -10` | exit 0, **91 files / 665 tests** all green (was 664, +1 test 7). |
| Targeted | `npm test -- tests/phase37hLessonMarkCompleteTodoFlow.test.ts` | exit 0, **7/7** green. |
| Live bundle | `grep -c 'getExtendedProgress' /tmp/japanese-tutor-fix2.js` | `3`. |
| Bundle detail | `grep -nE 'getExtendedProgress' /tmp/japanese-tutor-fix2.js` | lines 6072 (screen consumer A), 12284 (`getExtendedProgress(){…}` method in the store), 16423 (screen consumer B). Matches the source — both screens and the store method shipped in the bundle. |

---

## 4. Final recommendation

**SHIP.** Phase 37h fixes the reported bug end-to-end:

1. The current-week rule in `weeklyTodoService.statusForTodo` (line 108) and its peers (141, 159) makes sure the current week is never painted with "Completed before weekly todos were introduced".
2. The store now mirrors every recomputed `extendedCache` into the in-memory cache unconditionally; persistence is best-effort only. `reset()` also wipes the cache.
3. `LessonsScreen` and `HomeScreen` memos read `store.getExtendedProgress()` so the on-screen todo board picks up the recomputed counts on the next render after `setProgress(refreshed)`.
4. Seven targeted regression tests pin both halves of the fix, including the in-memory-repo path that mirrors the web runtime.

No findings block shipping. Recommend merge + deploy.

— Tusk (QC Division, GPT-5.5)
