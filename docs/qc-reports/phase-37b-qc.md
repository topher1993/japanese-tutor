
session_id: 20260701_061044_a5b454
## On-disk verify: PASS
- typecheck: 0
- phase37bLessonKind.test.ts: 14 passed / 14
- npm test: 600 passed / 600 across 82 files (5.26s)

## File scope: PASS
Exactly 8 files in bf6254f (5 new + 1 test + 2 modified), matching proposal §3+§4+§5:
- NEW: src/types/weeklyTodo.ts, src/data/weeklyPlans.ts, src/services/weeklyPlansService.ts, src/services/weeklyTodoService.ts, src/services/weeklyCardPoolService.ts
- NEW: tests/phase37bLessonKind.test.ts (387 lines, 14 it() blocks confirmed)
- MOD: src/repositories/sqliteLearningRepository.ts, src/services/practiceProgressStore.ts
- No extra files. graphify-out/cache/*.json noise in working tree is untracked cache, not committed.

## Design contracts honored: PASS
1. weeklyTodoService.ts PURE — no async/React/SQLite imports; only imports types from ../types/weeklyTodo and ../types/progress. weeklyTodoService.ts:14-20.
2. isWeekUnlocked decoupled from LessonInteractionPath — signature `(weekNumber, todoBoards, progress, strategy)` weeklyTodoService.ts:196-201; rule uses prior board's canAdvance.
3. WeeklyTodoBoard.isLegacyWeek present — field at weeklyTodoService.ts:57; surfaced at 138, 153, 161.
4. weeklyCardPoolService uses createFlashcardDeck — imports at weeklyCardPoolService.ts:11; called at 43 and 52; no getLessonCategoryCards reference (only a comment at :4 and a test assertion at tests/phase37bLessonKind.test.ts:232 confirming absence).
5. saveExtendedProgress writes 8-tuple + updates progressCache — progressCache mutated at sqliteLearningRepository.ts:205; UPDATE-by-MAX-rowid at :238; INSERT synthetic fallback at :246-256; 8-tuple shape matches the INSERT OR REPLACE in saveCompletedLesson at :150-160.
6. completeCurrentLesson gated on todoFeatureEnabled AND weekPlan — practiceProgressStore.ts:38 (`todoFeatureEnabled && typeof repo.saveExtendedProgress === 'function'`) + :42 (`weekPlan && weekPlan.todos.length > 0`); saveExtendedProgress called at :80.
7. recomputeTodoStatesForWeek idempotent — pure derivation from completedLessonIds + todoEventCounts (weeklyTodoService.ts:227-261); no mutating I/O; preserves prior?.progress / completedAt for non-lesson kinds.
8. Default unchanged — todoFeatureEnabled = false at practiceProgressStore.ts:15; all gated paths early-return when false; no learner-visible change without flag flip.

## New P0/P1 issues
None. Round-3 staging-buffer regression is fixed: completeCurrentLesson now persists the recomputed snapshot through saveExtendedProgress (practiceProgressStore.ts:80) and the round-trip is pinned by tests 13+14.

Nit (P3, not blocking): the cast at practiceProgressStore.ts:84 (`payload.todoEventCounts as unknown as Record<string, unknown>`) is necessary because TodoEventCounts uses named keys while the repo's ExtendedLearnerProgress view uses Record<string, unknown>; documented in inline comment. Acceptable for 37b.

## QC verdict: PASS

## Recommendation: ship 37b
All prior-round P0/P1 findings (P1-1 card source, P1-1 isLegacyWeek, P1-4 decoupled isWeekUnlocked, round-3 staging buffer) are resolved. proceed to 37c when ready.
