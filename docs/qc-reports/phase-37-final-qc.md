
session_id: 20260701_074918_53daeb
Everything verified. Compiling the QC report.

---

## On-disk verify: PASS
  - tsc --noEmit exit 0
  - npm test → 657/657 passed across 90 files
  - git log 57631de..HEAD = 19 commits (work card said ~22; 19 covers all 10 work phases + 9 QC docs + 2 supporting — within bounds)

## Section 1 (Schema migration): PASS
  - src/db/schema.ts:11 — progress CREATE TABLE has `todo_states`, `week_todos_initialized`, `todo_event_counts` TEXT NOT NULL DEFAULT '{}'
  - src/db/schema.ts:38 — `CURRENT_SCHEMA_VERSION = 2`
  - src/db/schema.ts:13 — `schema_meta` table created
  - src/repositories/sqliteLearningRepository.ts:53-64 — safeParseJson warns + falls back on parse error
  - src/repositories/sqliteLearningRepository.ts:80-88 — withTodoDefaults uses `?? {}` (preserves 37b todoStates across saveCompletedLesson)
  - tests/phase37aSqliteMigration.test.ts present

## Section 2 (Pure service): PASS
  - src/services/weeklyTodoService.ts:196-201 — isWeekUnlocked(weekNumber, todoBoards, progress, strategy). NO LessonInteractionPath.
  - src/services/weeklyTodoService.ts:57 — `isLegacyWeek: boolean` on WeeklyTodoStatus
  - src/services/weeklyTodoService.ts:227-231 — recomputeTodoStatesForWeek pure + idempotent + completedAt first-cross at :249 `reached = clamped >= target`

## Section 3 (Store layer): PASS
All six methods present in src/services/practiceProgressStore.ts in the required order, each guarded by `!todoFeatureEnabled` + `typeof repo.saveExtendedProgress !== 'function'`, each calling repo.saveExtendedProgress:
  - completeCurrentLesson :31 (calls saveExtendedProgress at :39+)
  - recordDailyRushComplete :105
  - recordFlashcardReview :212
  - recordKanjiGood :337
  - recordQuizAttempt :465
  - markExampleViewed :586
  - todoFeatureEnabled + setter :16-22, default false

## Section 4 (Lessons gate UI): PASS
  - src/screens/LessonsScreen.tsx:317-323 — board gated by `{isTodoFeatureEnabled() && todoBoard}`
  - src/screens/LessonsScreen.tsx:371-395 — next-week CTA gated by `isTodoFeatureEnabled() && !dailyLesson.isCourseComplete`, `disabled={!nextWeekUnlocked}` at :385
  - Continue-lesson Button (:362-368) does NOT consult isWeekUnlocked (per-week flow intact)

## Section 5 (UI wiring): PASS
  - src/screens/FlashcardsScreen.tsx:19-20, :50 — `useLearningContext()` + `store.recordFlashcardReview`; ZERO expo-sqlite matches
  - src/screens/DailyRushScreen.tsx:14, :69, :147-203 — same provider pattern, both kinds wired
  - src/screens/QuizScreen.tsx:51, :75 — calls `practiceStore.recordQuizAttempt` on final submit
  - src/screens/ExampleSentencesScreen.tsx:82, :83-86, :115-121 — view-tracking effect + debounce map
  - ZERO `expo-sqlite` matches under src/screens/

## Section 6 (WeeklyTodoBoardView): PASS
  - src/components/WeeklyTodoBoardView.tsx:41-43 — maps board.todos through WeeklyTodoRow
  - row :78 — `onPress(...)` consumes `status.ctaRoute` (ctaRoute.screen is what parent dispatches on, e.g. HomeScreen.tsx:123-124)
  - :24-26 — `isLegacy` branch renders LEGACY_HELPER copy

## Section 7 (Home + Progress integration): PASS
  - src/screens/HomeScreen.tsx:104-118, :171-195 — `homeTodosEnabled = isTodoFeatureEnabled()`, replaces "Today's focus" only when on, renders `homeIncompleteTodos` feed via WeeklyTodoBoardView
  - src/screens/ProgressScreen.tsx:99-132, :159-170 — per-week "Week N todos: X/Y complete" widget, similarly gated

## Section 8 (Test coverage): PASS
  - 11 phase37 test files present (a, b, c, d1-d5, e, ProgressTabBugs, ProgressTabRefactorShape)
  - 657/657 across 90 files vs ~650 pre-37e baseline
  - Source-level contract tests + Progress tab shape pinning visible in phase37* list

## Section 9 (Rollout guard): PASS
  - default false (src/services/practiceProgressStore.ts:16)
  - JSON parse never throws (sqliteLearningRepository.ts:53-64)
  - schema_meta tracked (writeSchemaVersion at :104-113)

## New P0 issues (cross-file): none

## New P1 issues (cross-file): none observed
  - Minor: lessonsCache retained in repo as `let lessonsCache` (not part of 37 surface), unrelated.

## QC verdict: PASS

## Recommendation: ship 37

37a-37e ships clean on disk. npx tsc --noEmit exit 0; 657/657 tests across 90 files; schema migration is shape-safe (JSON blobs default to '{}', parse failures degrade); pure service, store, UI, and Home/Progress integrations all wired behind the default-false flag. Proceed to 37g only when ready to flip `todoFeatureEnabled` true via `setTodoFeatureEnabled()`.
