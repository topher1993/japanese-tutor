# Phase 37g — QC Report (Tusk / GPT-5.5)

**Repo:** `C:/Users/tophe/japanese-tutor-mobile-app`
**Commit under review:** `75e11de Phase 37g — flip the weekly-todo gate ON by default + cold-start hydration`
**Prior QC-approved baseline:** `85c02ae Phase 37h — fix lesson-mark-complete from todo so the weekly todo board updates live`
**QC date:** 2026-07-01

---

## Step 1 — Model confirmation

```
$ hermes -m gpt-5.5 -z "REACHABLE"
GPT-5.5 is reachable and operational for QC.
```

✅ Running on GPT-5.5 (openai-codex) per audit rule. No fallback used.

---

## 1. Verdict

**NEEDS WORK** — one P2 typecheck issue in test scaffolding only; all three 37g implementation pieces and all four 37g cold-start hydration tests are green. A trivial non-null assertion or local type narrowing fix on two lines (116, 160) of `tests/phase37gColdStartHydration.test.ts` unblocks `npm run typecheck`. Recommended action: ship a 1-line patch in the same commit **or** an immediate follow-up; merge otherwise safe.

---

## 2. Findings by severity

### P0 — none

No production-blocking defects. The three implementation pieces listed in the proposal §37g are all in place and exercised by passing tests. No data-loss risk, no clobber regression, no migration regression.

### P1 — none

No high-severity issues. Eager hydration is guarded (`hydrationPromise` cached singleton, retry-safe, mutators `await ensureHydrated()`), the synthetic `todo-snapshot` placeholder is correctly skipped, and the `reset()` invariant is honored (does not re-hydrate after delete).

### P2 — `npm run typecheck` fails on 4 sites inside `tests/phase37gColdStartHydration.test.ts`

```
tests/phase37gColdStartHydration.test.ts(116,5): error TS18048: 'db2.tables' is possibly 'undefined'.
tests/phase37gColdStartHydration.test.ts(116,32): error TS18048: 'db1.tables' is possibly 'undefined'.
tests/phase37gColdStartHydration.test.ts(160,5): error TS18048: 'db2.tables' is possibly 'undefined'.
tests/phase37gColdStartHydration.test.ts(160,32): error TS18048: 'db1.tables' is possibly 'undefined'.
```

**Evidence:** `src/repositories/sqliteLearningRepository.ts:6-11` declares `tables?: Map<string, unknown[]>` (optional). `createInMemoryDb()` always returns an object whose `.tables` is a defined `Map`, but TypeScript's control-flow analysis cannot prove the property is non-undefined across the `db1`/`db2` boundaries set up at lines 114–116 and 159–160.

**Why P2 not P1:** The errors live exclusively in test scaffolding; runtime behavior is correct (4/4 cold-start hydration tests pass, vitest types `tsc --noEmit` optional `tables`). Production code (`practiceProgressStore.ts`, `sqliteLearningRepository.ts`) is type-clean.

**Suggested fix (one line, your choice of idiom):**
```ts
// option A — non-null assertion at sites of use
db2.tables!.set('progress', db1.tables!.get('progress') ?? []);

// option B — destructure out the Map at the top of each test
const tables2 = db2.tables!; // createInMemoryDb guarantees this is defined
const tables1 = db1.tables!;
tables2.set('progress', tables1.get('progress') ?? []);

// option C — strengthen createInMemoryDb's return with a satisfies clause
function createInMemoryDb(): SqliteLikeDatabase & { tables: Map<string, unknown[]> } { ... }
```
Option C is cleanest because it fixes the contract at the test-helper boundary without scattering `!` through every call site.

### P3 — none (style, optional)

The two sites are stylistically inconsistent with the rest of the test file (which already uses `tables.get('progress') ?? []` inside `runAsync` and `getAllAsync` because those helpers narrow `tables` via closure). Aligning the new sites to that pattern via option C above would also remove the inconsistency.

---

## 3. Verdict on each implementation piece

### (a) Default-on flag — `src/services/practiceProgressStore.ts:19` — **PASS**

```
19: export let todoFeatureEnabled = true;
```
Confirmed. Named-binding export so `createPracticeProgressStore` and `LessonsScreen` both observe the flip via the same constant. Mutator (`setTodoFeatureEnabled`) exists for the dev-menu toggle. Test 4 (`'4. default-on: todoFeatureEnabled is true on a fresh module load…'`) at `tests/phase37gColdStartHydration.test.ts:177-194` asserts this live and passes.

### (b) Eager disk-hydration — `src/services/practiceProgressStore.ts` — **PASS**

All six contract elements present:
- `createPracticeProgressStore` calls `void ensureHydrated();` at line **101** (fire-and-forget so the factory stays synchronous).
- `ensureHydrated()` defined at line **79**, cached in `hydrationPromise` so concurrent callers await a single read.
- All 6 mutating methods `await ensureHydrated()` before reading the cache:
  - `completeCurrentLesson` — line **104**
  - `recordDailyRushComplete` — line **203**
  - `recordFlashcardReview` — line **311**
  - `recordKanjiGood` — line **437**
  - `recordQuizAttempt` — line **566**
  - `markExampleViewed` — line **688**
- `ready(): Promise<void>` exists at line **186** and awaits `ensureHydrated()` (test 2 pins idempotency — `'ready() is idempotent — calling twice resolves on the same hydration'`).
- `reset()` at line **792** clears `extendedCache`, nulls `hydrationPromise`, calls `repo.deleteAllProgress()`, and the explicit comment at lines **797-802** explains why it intentionally does NOT re-hydrate:
  > "The SQLite repo's getProgress() reads the last progress row from the in-memory mirror map, which deleteAllProgress doesn't clear, so re-hydrating here would resurrect stale todoStates from before the reset."

Test coverage (4 tests, all pass):
1. Cold-start reads back persisted lesson-todo state
2. `ready()` idempotent
3. Mutation after cold-start preserves hydrated state (no clobber) — proves the `await ensureHydrated()` ordering
4. Default-on flag — proves the 37g flip

### (c) SQLite cold-start hydration — `src/repositories/sqliteLearningRepository.ts` `getProgress()` — **PASS**

All three contract elements present (lines 162–216):
- `memoryTables.get('progress')` walked at line 167; loop at lines 180-187 rebuilds `completedLessonIds` from rows with `Number(row.completed ?? 0) === 1`, deduped via `includes` check.
- Synthetic placeholder (`id = 'todo-snapshot'`, `completed = 0`) is skipped: the `completedLessonIds` loop only adds rows where `isCompleted && lessonId` (line 184), and `lastRealRow` walk (lines 191-197) explicitly looks for `Number(rows[i].completed ?? 0) === 1`, so any `todo-snapshot` row is naturally skipped.
- `progressCache = newProgressCache` only assigned when `lastRealRow !== null || completedLessonIds.length > 0` (line 210) — pure placeholder snapshots cannot overwrite in-memory state.

JSON parsing is tolerance-first via `safeParseJson<TodoStateMap>(row.todo_states, {}, '…')` etc. (lines 202-204), which falls back to `{}` and warns rather than throwing.

---

## 4. Test command results

| Command | Exit code | Result |
|---|---|---|
| `npm run typecheck` | **2** | 4 errors — all in `tests/phase37gColdStartHydration.test.ts` lines 116 & 160 (P2, see above) |
| `npm test 2>&1 \| tail -10` | **0** | `Test Files 92 passed (92) / Tests 669 passed (669) / Duration 5.89s` |
| `npm test -- --run tests/phase37gColdStartHydration.test.ts 2>&1 \| tail -10` | **0** | `Test Files 1 passed (1) / Tests 4 passed (4) / Duration 361ms` |

The full suite (669 tests across 92 files) is green. The targeted cold-start hydration test file (4 tests) is green. Only typecheck is red, exclusively on test scaffolding.

---

## 5. Scope adherence

Confirmed: the diff under `75e11de` is strictly the 37g flip (default-on flag, eager hydration, SQLite cold-start `completedLessonIds` rebuild, `ready()` addition, `reset()` invariant). Did NOT touch unrelated code. The note in the QC prompt about 37h (already approved at `85c02ae`) is honored — I did not re-review 37h files.

---

## 6. Final recommendation

**Accept with one P2 follow-up.** The three 37g implementation pieces are correct, complete, and covered by passing tests. The full 669-test suite is green. The only blocker is `npm run typecheck`, and the four errors are all in test-helper code that TypeScript cannot narrow — a 1-line patch (option C recommended: strengthen `createInMemoryDb`'s return type).

**Two options for closing out:**

1. **Ship as-is, patch in same PR** — append the type fix to `75e11de` and re-run `npm run typecheck` to confirm exit 0. Lowest-friction and keeps the 37g flip atomic with its test-helper types.
2. **Ship now, fix in follow-up** — merge `75e11de` since runtime + tests are green; the typecheck regression is test-only and cannot affect production. Land the test-helper type narrowing in 37i. Acceptable because no production code path is type-unsafe and the fix is mechanical.

I recommend **option 1** because (a) the fix is one line, (b) `npm run typecheck` is presumably enforced in CI, and (c) it keeps the commit history honest: the 37g flip lands at the same commit its test types are correctly declared.

Either way, the 37g flip itself — default-on gate + eager hydration + cold-start SQLite read of `completedLessonIds` — is **technically correct** and ready for production.
