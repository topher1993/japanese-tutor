I have enough. Verified facts:

- `lessonInteractionPathService.previousWeekComplete` exists at `src/services/lessonInteractionPathService.ts:29,50` — yes.
- `LearnerProgress` lives at `src/types/progress.ts:2` — `{startedAt, completedLessonIds, quizScores, streak}`. Persistence: SQLite via `src/repositories/sqliteLearningRepository.ts` (table `progress`); `practiceProgressStore` at `src/services/practiceProgressStore.ts:21` proxies `repo.getProgress()`.
- `FlashcardReviewCard` has NO `kind` field (`src/types/flashcard.ts:3`) → cannot filter `card.kind === 'kanji'`. There is no `kanjiCard` type.
- `flashcardService.answerFlashcard` mutates `deck` but does NOT write to `LearnerProgress` (`src/services/flashcardService.ts:21`). No `flashcardReviews` counter on the progress type.
- `DailyRushScreen` calls `summarizeDailyRush` and `buildDailyRushProfilePatch` but writes to user profile via `updateProfile`, NOT `practiceProgressStore` (`src/screens/DailyRushScreen.tsx:117-122`).
- `recordQuizAttempt` — search returned zero hits in `src/`. Does not exist.
- `markExampleViewed` / `exampleSentenceViewed` — search returned zero hits in `src/`. Does not exist.
- `WeekPlan`/`WeekTodo` — only in proposal (`docs/phase-37-todo-gated-progression-proposal.md`).
- Tests touching weekly progression / week-gate: `phase20aLessonProgression`, `phase30DailyLessonProgress`, `phase30bFinishAllLessons`, `phase38LessonsInteractionPath`, `phaseDeadButtons` (regex over `dailyLesson.*`), plus `phase37ProgressTabBugs` (in status as `M`). 5–6 files, all assertion-only on `lessonsDoneThisWeek`/`isWeekPreview`/`previousWeekComplete`/`previousWeekFullyDone` — none build a `LearnerProgress` with `todoStates`, so adding the field with a default empty shape should not break them.

## Feasibility verdict: GO-WITH-CONDITIONS

The pure-seam proposal (`buildWeeklyTodoBoard`, `isWeekUnlocked`) is clean and fits the existing `buildLessonInteractionPath` pattern. But §5 is misleading: only `lesson` (via `completeCurrentLesson`) and `daily-rush` (only via user-profile patch, not store) have ANY existing hook. **Four of the six todo kinds need brand-new event plumbing** before the §8 plan compiles. Data model is feasible; wiring is not.

## P0 issues

1. **§5 column "Existing hook" is wrong for 4/6 kinds.** `flashcardReviews` does not exist on `LearnerProgress`; `recordQuizAttempt` is not a function anywhere; `markExampleViewed` does not exist; `FlashcardReviewCard.kind === 'kanji'` cannot be filtered because `kind` is not a field. The whole progress-feedback loop in §4–§5 is aspirational. Without these, `practiceProgressStore` has nothing to listen to.
2. **§3.2 `LearnerProgress` extension is a schema migration with no concrete SQLite plan.** Adding `todoStates` / `weekTodosInitialized` to `LearnerProgress` requires a new SQL column (or a JSON-blob column) and an upgrade path. `sqliteLearningRepository.ts:48` shows the current `INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?)` with a 5-tuple — bumping that needs schema versioning + a real migration test, not just "extend `LearnerProgress`".
3. **§5 row "daily-rush" points to "Existing `summarizeDailyRush` hook" — but Daily Rush writes to `userProfile` via `updateProfile` (`DailyRushScreen.tsx:117-122`), not to `practiceProgressStore`.** `practiceProgressStore` cannot "listen" to it without either moving the write target or adding a new repo method. The store has no `notify*` / event-bus surface — the "store listens" model is invented.

## P1 issues

1. **`weekPlan` "ships as static lesson data" but `SenseiLesson` (`src/types/lesson.ts:19-29`) has no such field.** Adding it to one lesson file isn't enough — the proposal never says whether todos live on the lesson or in a sibling weekly data module. Pick one and document the loader.
2. **§6.2 default for `flashcards` (target = week's card-pool size) is undefined** — `pool: 'week' | 'level'` is not implemented anywhere. `getLessonCategoryCards` exists, but no per-week card-pool resolver.
3. **§6.3 (skip mechanism) and §6.4 (mid-week content edits) are undecided.** Both change the data shape (`skipped`, re-seed strategy). Implementation can't start until Chris signs.
4. **`previousWeekComplete` is the wrong predicate for gating.** It's true when week N-1's lessons are 100% done, but the learner may be mid-week N with `previousWeekComplete=false` only on the first lesson of week N — fine for the *path*, but `isWeekUnlocked` for week N must read week N-1's `WeeklyTodoBoard.allDone`, not the path's flag. Proposal §4 conflates the two; rename or guard.
5. **§3.3 migration says "do not retroactively seed prior weeks"** but `weekTodosInitialized` is a `Record<number, boolean>` on the same object as `todoStates` — if a learner upgrades on week 3, weeks 1 and 2 boards will report `totalCount: 0`, which is correct only if 6.1-A is chosen. If 6.1-B (preview-but-locked) is chosen, those boards need to render "completed under old rules". Decide upfront.
6. **§8 phase-37a step 6 "Migration test"** needs an in-memory DB (`db.tables` map in `sqliteLearningRepository.ts:27`) — confirm that path is exercised, otherwise the test will silently hit native SQLite.

## Seams verified (file:line)

- `lessonInteractionPathService.previousWeekComplete` — `src/services/lessonInteractionPathService.ts:29,50`
- `LearnerProgress` type — `src/types/progress.ts:2`
- SQLite-backed persistence — `src/repositories/sqliteLearningRepository.ts:24-63` (table `progress`, `progressCache`, `createInitialProgress` reset)
- `practiceProgressStore` thin wrapper over repo — `src/services/practiceProgressStore.ts:12-25`
- `buildLessonProgression` + per-week summaries — `src/services/lessonService.ts:74-99` (`lessonsDoneThisWeek`, `isWeekPreview`, `previousWeekFullyDone`)
- `completeCurrentLesson` consumer site — `src/screens/DailyLessonScreen.tsx:87`
- Daily Rush `summarizeDailyRush` consumer — `src/screens/DailyRushScreen.tsx:61,117-122`
- Tests already touching weekly progression: `tests/phase20aLessonProgression.test.ts:23-26`, `tests/phase30DailyLessonProgress.test.ts:57-79`, `tests/phase30bFinishAllLessons.test.ts:51-55`, `tests/phase38LessonsInteractionPath.test.ts:48-52`, `tests/phaseDeadButtons.test.ts:59`

## Missing seams (file:line, what to add)

- `src/types/progress.ts:2` — add `todoStates: Record<string, TodoState>` and `weekTodosInitialized: Record<number, boolean>` to `LearnerProgress`; add `TodoState` type; add `flashcardReviews`, `quizAttempts`, `exampleSentenceViewedIds`, `kanjiReviews` (or a single `todoEventLog` shape).
- `src/repositories/sqliteLearningRepository.ts:32,37,46-49` — new columns/tables for the above; bump schema in `db/schema.ts`; `createInitialProgress` and `completeLesson` need updates; `deleteAllProgress` must wipe todo fields (already happens if added to `createInitialProgress`).
- `src/services/practiceProgressStore.ts:12-25` — add methods `recordFlashcardReview(cardId)`, `recordQuizAttempt(week, score)`, `markExampleViewed(id)`, `recordKanjiGood(id)`, `recordDailyRushComplete(date)`, plus todo-progress upsert that clamps at target and stamps `completedAt`.
- `src/services/flashcardService.ts:21` — `answerFlashcard` does NOT persist. Either pipe through `practiceProgressStore` here, or add a subscriber pattern. Today no event bus exists.
- `src/types/flashcard.ts:3` — add `kind?: 'kanji' | 'vocab'` to `FlashcardReviewCard`; backfill in `createFlashcardDeck` and `supplementalFlashcards`.
- `src/types/lesson.ts:19-29` and lesson data files (`src/data/mockSenseiLessons.ts`, etc.) — add optional `weekPlan?: WeekPlan` to `SenseiLesson`, OR introduce a sibling `src/data/weeklyPlans.ts` loader. Proposal never decides.
- `src/services/weeklyTodoService.ts` — does not exist; create per §4.
- No `WeekTodo`, `WeekPlan`, `WeeklyTodoStatus`, `WeeklyTodoBoard` types anywhere except the proposal.
- `src/screens/LessonsScreen.tsx:40` — only one `useEffect`/consumer of `lessonPath`; the "next-week CTA disabled" copy needs a new component, and the file currently lacks any `isWeekUnlocked` call site.
- No deep-link router exists. `ctaRoute` is invented; needs a registry from todo-kind → existing screen (Flashcards screen, DailyRushScreen, Quiz screen — quiz screen not searched yet but no `recordQuizAttempt` is suspicious).

## Recommendation

Ship is feasible, but only after Chris answers §6.1–6.4 and §5's "existing hooks" claims are rewritten — four of six kinds have no event today. Igris should sequence as: data-model + SQLite migration + one end-to-end kind (`lesson`, since it already works) → green test → then add the four new event hooks before wiring more kinds. Do not start §8 phase-37b until phase-37a lands with at least `flashcards` and `quiz` kinds plumbed through, otherwise the gate logic in the UI has nothing to render.
session_id: 20260701_045934_c9de34

