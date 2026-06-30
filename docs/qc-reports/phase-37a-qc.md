
session_id: 20260701_054911_6dd0a0
## On-disk verify: PASS
- Typecheck: PASS (`npx tsc --noEmit` exit 0)
- Focused test: 4/4 PASS (`tests/phase37aSqliteMigration.test.ts`)
- Full test: 585/585 PASS (`npm test`, 81 files)

## Checklist trace
1. v1→v2 read path: PASS. Test `a` inserts a 5-tuple via raw SQL (`tests/phase37aSqliteMigration.test.ts:135-141`); the fake `runAsync` mirror sets the 3 new columns to `'{}'` (lines 67-69), real `CREATE TABLE` defaults to `'{}'` (`src/db/schema.ts:11`). `getProgress` rehydrates via `safeParseJson` returning `{}` for all three.
2. JSON-parse-failure: PASS. `safeParseJson` (`src/repositories/sqliteLearningRepository.ts:44-55`) returns fallback on null/non-string/throw and emits `console.warn` with `[phase37a]` + field name. Test `b` confirms corrupted `todo_states` → `{}`, siblings survive, warn matches regex.
3. schema_meta written on initialize: PASS (`sqliteLearningRepository.ts:101-104`). schema_meta is *read* inside `initialize()` (via `readSchemaVersion`, line 71-78), not inside `getProgress()` — this is the correct design (meta drives migration timing, not row hydration). Test `c` asserts the row is `{key:'progress', value:'2'}` after a v1 seed + re-init.
4. todoFeatureEnabled default false: PASS (`src/services/practiceProgressStore.ts:12`). Both `isTodoFeatureEnabled()` and the mutable `todoFeatureEnabled` binding are exported — future `LessonsScreen` consumer has both read API (`isTodoFeatureEnabled()`) and toggle API (`setTodoFeatureEnabled`). P1-4 contract satisfied.
5. Stubs additive: PASS. Existing `completeCurrentLesson`/`getDashboard`/`getProgress`/`reset` untouched (lines 27-36). Three new stubs below short-circuit on flag=false.
6. Test fixtures use `db.tables`: PASS (`tests/phase37aSqliteMigration.test.ts:32-50`). No `expo-sqlite` import.
7. `withTodoDefaults`: **FAIL semantic** — see P1 below.

## P0 issues
None.

## P1 issues
1. **`withTodoDefaults` overwrites instead of merging** (`src/repositories/sqliteLearningRepository.ts:57-64`). Function named "defaults" but unconditionally writes `{}` to all three fields, discarding any existing values. Called from `saveCompletedLesson:118` after every lesson completion. Phase 37a is safe (nothing computes todo state yet). Phase 37b will silently lose accumulated `todoStates` on every `completeCurrentLesson`. Either rename to reflect destructive semantics or merge: `{ ...progress, todoStates: progress.todoStates ?? {}, ... }`.

2. **Test selection picks `rows[rows.length - 1]`** (`sqliteLearningRepository.ts:146`). Pre-existing, but with v1+v2 row coexistence, only the latest row is rehydrated. Acceptable for 37a since the flag is off; flag for 37b test design.

## QC verdict: PASS-WITH-NITS

## Recommendation
Approve and merge phase 37a. P1-1 must be fixed (rename or merge semantics) before phase 37b wires real todo computation, otherwise lesson-complete events will wipe accumulated todo state.
