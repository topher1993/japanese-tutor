# Phase 37 — Todo-Gated Weekly Progression

Proposal for the Japanese Tutor mobile app (React Native + Expo, `C:\Users\tophe\japanese-tutor-mobile-app`).

This document is a **plan, not an implementation contract**. Code, tests, and verification are gated on Chris's sign-off of the design decisions at the bottom.

---

## 1. Problem statement

Today the learner can advance week-to-week with no proof they actually studied the current week's material. The existing curriculum path (`buildLessonInteractionPath`) only tracks *which lessons are completed*; it doesn't track whether the learner reviewed flashcards, ran a Daily Rush, or did the quiz for the week. The result:

- A learner can mark a lesson complete, skip every flashcard and quiz, and unlock next week.
- Daily Rush feels optional — there is no consequence to skipping it.
- Progress tab numbers go up but reflect engagement, not retention.

We want a **todo system per week** that gates next-week unlock. Open question for Chris: how strict is "strict"? See §6.

---

## 2. Goals & non-goals

### Goals

1. Each week carries a small set of todos the learner must complete before the next week unlocks.
2. Todos are *visible*, *concrete*, and *actionable from a single tap*.
3. Completion of a todo updates existing XP / streak / profile signals — no parallel progression universe.
4. Todos persist across sessions and survive app restarts / reinstalls via existing `practiceProgressStore`.
5. Backward compatible: existing learners on week N keep their progress; only **future** week unlocks require todos.

### Non-goals (this phase)

- Spaced-repetition scheduling of *todo timing* (no "do this todo tomorrow").
- Admin UI to author todos at runtime (todos ship as static lesson data).
- Cloud sync of todos (they ride on existing local progress).
- "Skip week" / pay-to-unlock escape hatch.
- Reordering / customization of todo lists.

---

## 3. Data model

### 3.1 Authoring location: sibling `weeklyPlans.ts`

**Decision: todos live in a sibling weekly data module, not on `SenseiLesson`.**

Reason: `SenseiLesson` (`src/types/lesson.ts:19-29`) describes one lesson, not a week of plans. Adding `weekPlan` would force every lesson file to carry a weekly-aggregate concept that only one lesson per week actually owns. A sibling loader keeps lesson data clean and gives authors one obvious place to edit weekly plans.

New module:

```ts
// src/data/weeklyPlans.ts
// Authored by hand; types live in src/types/weeklyTodo.ts.

import type { WeekPlan } from '../types/weeklyTodo';

export const WEEKLY_PLANS: WeekPlan[] = [
  // N5 weeks 1..4 seeded in Phase 37a; more weeks added without code changes.
];
```

Loader service:

```ts
// src/services/weeklyPlansService.ts
export function getWeekPlan(weekNumber: number): WeekPlan | undefined;
export function getAllWeekPlans(): WeekPlan[];
```

Types:

```ts
// src/types/weeklyTodo.ts
export interface WeekTodo {
  id: string;                  // stable, e.g. "n5-w1-flashcards"
  kind:
    | 'flashcards'             // review X cards from this week's pool
    | 'daily-rush'             // complete one Daily Rush session
    | 'quiz'                   // pass the weekly quiz at >= N%
    | 'lesson'                 // mark each listed lesson complete
    | 'example-sentences'      // read N example sentences
    | 'kanji';                 // drill N kanji from this week
  title: string;               // learner-visible title (English + selected helper lang)
  target: number;              // count threshold (cards, %, sentences, lessons)
  unit?: string;               // optional unit hint, e.g. "cards", "% correct"
  // Per-kind config:
  pool?: 'week' | 'level' | string;   // which card pool to draw from
  lessonIds?: string[];               // for lesson-kind todos
  kanjiSet?: string[];                // for kanji-kind todos
}

export interface WeekPlan {
  weekNumber: number;
  todos: WeekTodo[];
  passingStrategy?: 'all' | 'majority'; // default 'all'
}
```

#### Card-pool resolver

For `flashcards` and `kanji` todos the `pool` and `kanjiSet` values must resolve to a concrete list of card ids at runtime. The proposal previously said `pool: 'week' | 'level'`, but no resolver exists today. New service:

```ts
// src/services/weeklyCardPoolService.ts
export interface CardPoolResolution {
  cardIds: string[];                       // ordered; can be empty
  source: 'week' | 'level' | 'lesson-set' | 'kanji-set' | 'empty';
  expectedTarget?: number;                 // override target when undefined at todo level
}

export function resolveCardPool(
  poolSpec: WeekTodo['pool'],
  weekNumber: number,
): CardPoolResolution;

export function resolveKanjiSet(
  kanjiSetSpec: WeekTodo['kanjiSet'],
): CardPoolResolution;
```

Implementation contract:
- `'week'` → flashcard cards whose lesson's `week === weekNumber`. Source: filter `getAllLessons()` then `getLessonCategoryCards(...)`.
- `'level'` → all cards tagged with the learner's current JLPT target level (read from `userProfileService`).
- `'lesson-set'` / `'kanji-set'` → already explicit id lists from the todo; resolver is a passthrough validator.
- An empty resolution renders the todo as `totalCount: 1, completed: false` with helper text "No cards found for this week's pool — author must populate weeklyPlans.ts before release" so the gate fails closed loudly rather than silently auto-passing.

`resolveCardPool` also fills `expectedTarget` so authors can omit `target` on a `flashcards` todo and get "review the whole pool once" for free. Default in `WeekPlan` resolver: `target ?? expectedTarget`.

Fallback when a week has no `weekPlan`: empty todos array, current behavior preserved (always-unlocked next week).

### 3.2 New persisted state

Add to `LearnerProgress` (in `practiceProgressStore`):

```ts
interface TodoState {
  todoId: string;
  weekNumber: number;
  progress: number;            // current count toward target
  target: number;              // snapshot at the time the week was unlocked
  completedAt?: number;        // epoch ms, set when progress >= target
  skipped?: boolean;           // see §6.3 — soft-skip path
}

interface LearnerProgress {
  // ... existing fields
  todoStates: Record<string, TodoState>;   // key = todoId
  weekTodosInitialized: Record<number, boolean>; // week → seeded?
  todoEventCounts: TodoEventCounts;         // see below
}

interface TodoEventCounts {
  flashcardReviews: Record<string, string[]>;   // weekNumber → cardIds reviewed
  quizAttempts: Record<number, number>;          // weekNumber → best score %
  dailyRushDates: Record<number, string[]>;      // weekNumber → ISO dates completed
  exampleSentencesViewed: Record<number, string[]>; // weekNumber → sentence ids
  kanjiGoodAnswers: Record<string, string[]>;    // weekNumber → kanji card ids
}
```

#### Why a separate `todoEventCounts` block

The QC flagged that `practiceProgressStore` has no event-bus surface today. Rather than introduce one (scope creep), we make the store the **only** writer of these counters, and the screens call into the store at the moments where progress should happen. This is direct method calls, not pub/sub. See §5 for the per-kind wiring.

### 3.3 SQLite migration plan (concrete)

The repo's `progress` table is a 5-tuple (`sqliteLearningRepository.ts:32,37,46-49`). Adding fields means a real schema migration, not a TS-only edit. Concrete plan:

1. **Schema bump.** `db/schema.ts` version constant: `CURRENT_SCHEMA_VERSION = 2`. Bump from 1 → 2.
2. **Column strategy.** Add 3 new columns to the `progress` table:
   - `todoStates TEXT NOT NULL DEFAULT '{}'`  — JSON-serialized `Record<string, TodoState>`
   - `weekTodosInitialized TEXT NOT NULL DEFAULT '{}'`  — JSON-serialized `Record<number, boolean>`
   - `todoEventCounts TEXT NOT NULL DEFAULT '{}'`  — JSON-serialized `TodoEventCounts`
   
   JSON-blob columns (vs. one row per todo) because todos are a small, mostly-write-rarely-read-everywhere structure. They are not query-targets. If a future feature needs to query them, a separate `todo_states` table can be introduced without changing the public schema.
3. **Repo changes.** `sqliteLearningRepository.ts`:
   - `createInitialProgress()` adds the 3 new fields with `{}` defaults.
   - `getProgress()` parses the 3 JSON columns back into objects; on parse failure, fall back to `{}` and log a warning (do not crash).
   - `saveProgress(progress)` serializes the 3 fields into the `INSERT OR REPLACE` (now 8-tuple).
   - `deleteAllProgress()` already runs through `createInitialProgress` reset path; no extra change.
4. **In-memory test path.** The repo uses an in-memory map (`db.tables` at `sqliteLearningRepository.ts:27`) for tests. **The migration test MUST instantiate the repo via this in-memory path**, not via `expo-sqlite`, otherwise the test will silently hit native SQLite and not actually exercise the new columns. The test will:
   - seed `progress` row with v1 fields only via the legacy 5-tuple path (manually crafted SQL)
   - call `getProgress()` against the new repo
   - assert the 3 new fields are present and empty
   - assert no exception is thrown
5. **Rollback.** Schema-version table or a `schemaVersion` row in `progress` itself: simplest is a single row in a `meta` table. Migration is forward-only; rollback re-installs the app.
6. **What does NOT change.** `completedLessonIds` and `quizScores` stay in their existing columns. No data loss.

### 3.4 Seeding logic

For learners currently mid-curriculum:

1. On every read of `getProgress()`, compute `currentWeekNumber` from `buildLessonInteractionPath(lessons, progress)`.
2. If `weekTodosInitialized[currentWeekNumber]` is false:
   - Load `weekPlan = getWeekPlan(currentWeekNumber)`.
   - For each todo, populate `todoStates[todo.id] = { progress: 0, target: todo.target ?? resolver.expectedTarget, weekNumber }`.
   - Set `weekTodosInitialized[currentWeekNumber] = true`.
   - `saveProgress(...)` once.
3. **Do NOT seed prior weeks** — they are considered already-finished under old rules.
4. **Render rule for prior weeks** (matters under §6.1-B): when a learner views a prior week's board and `weekTodosInitialized[weekNumber]` is false, render `totalCount: 0, allDone: true, helperText: "Completed before weekly todos were introduced"`. This is the single rule that makes both §6.1-A and §6.1-B behave correctly without a second migration flag.
5. **Reset.** `practiceProgressStore.reset()` wipes everything; next read re-seeds the current week. No special handling.

### 3.5 Naming note

The field `todoEventCounts.dailyRushDates` collides with existing `streak.lastDate`. They live on different objects (`LearnerProgress` vs user-profile), so no actual conflict, but readers should grep both names when debugging.

---

## 4. The progression service (pure)

New sibling module — does **not** extend `lessonInteractionPathService`:

```ts
// src/services/weeklyTodoService.ts
// Pure. No React, no SQLite, no async.

import type { WeekPlan } from '../types/weeklyTodo';
import type { LearnerProgress } from '../types/progress';

export interface TodoCtaRoute {
  screen: 'flashcards' | 'daily-rush' | 'quiz' | 'lesson' | 'example-sentences' | 'kanji';
  params?: Record<string, string | number>;
}

export interface WeeklyTodoStatus {
  todo: WeekTodo;
  progress: number;
  target: number;
  completed: boolean;
  skipped: boolean;
  ctaRoute: TodoCtaRoute;     // where the learner goes when they tap "Do this"
  helperText: string;         // learner-visible, depends on resolved state
}

export interface WeeklyTodoBoard {
  weekNumber: number;
  todos: WeeklyTodoStatus[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  canAdvance: boolean;        // true iff allDone (under 'all') or majority (under 'majority')
  isLegacyWeek: boolean;      // true when weekTodosInitialized[weekNumber] is false → render as "completed under old rules"
}

export function buildWeeklyTodoBoard(
  weekNumber: number,
  weekPlan: WeekPlan | undefined,
  todoStates: Record<string, TodoState>,
  isInitialized: boolean,
  strategy: 'all' | 'majority' = 'all',
): WeeklyTodoBoard;

// IMPORTANT: this does NOT consult LessonInteractionPath. The path's
// previousWeekComplete flag describes lesson completion, not todo completion.
// Mixing the two was the QC-flagged P1#4 confusion.
export function isWeekUnlocked(
  weekNumber: number,
  todoBoards: Record<number, WeeklyTodoBoard>,
  strategy: 'all' | 'majority' = 'all',
): boolean;
  // Implementation:
  //   weekNumber <= 1 → true (week 1 is always unlocked)
  //   isInitialized[weekNumber] === false for weekNumber - 1 → true (prior week is legacy, treat as passed)
  //   else → todoBoards[weekNumber - 1]?.canAdvance === true

// One-call helper for screens that have the raw progress shape:
export function buildAllTodoBoards(
  weekPlans: WeekPlan[],
  progress: LearnerProgress,
  strategy?: 'all' | 'majority',
): Record<number, WeeklyTodoBoard>;
```

Screens render the returned `WeeklyTodoBoard`. Same pure-service pattern as `buildLessonInteractionPath` — repository can be swapped later for a backend without rewriting UI. The two services are decoupled: `lessonInteractionPath` answers "what lessons can I study?", `weeklyTodoService` answers "can I unlock next week?".

### 4.1 Why `isWeekUnlocked` does not take `LessonInteractionPath`

QC flagged that the original proposal conflated `previousWeekComplete` (a lesson-completion flag on `LessonInteractionPath`) with the todo gate. They are different:

- A learner on the first lesson of week N has `previousWeekComplete === false` because week N-1 lessons are done (week N-1 fully complete) — actually yes, `previousWeekComplete` IS true there. But consider a learner on the last lesson of week N: `previousWeekComplete` is still `true` (week N-1 done), but `WeeklyTodoBoard(N-1).allDone` may be false if they haven't done their week N-1 todos yet under the new system.

So `previousWeekComplete` only describes lesson flow, not todo flow. The todo gate must read todo-board state, full stop. `isWeekUnlocked` takes only `todoBoards`.

---

## 5. Where progress comes from (kind → source)

QC round 1 caught that the original §5 overstated which hooks already exist. This is the honest map. Each row tells you **where the call lives today** and **what needs to be added**.

| Kind              | Status      | Progress source (counted)                                                                              | Where progress is updated                                                                                  |
|-------------------|-------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|
| `lesson`          | **READY**   | each `lessonId` in `todo.lessonIds` present in `LearnerProgress.completedLessonIds`                   | Existing `practiceProgressStore.completeCurrentLesson` at `src/services/practiceProgressStore.ts:14`        |
| `daily-rush`      | **READY***  | one completed rush (any score) for a date in `todoEventCounts.dailyRushDates[weekNumber]`             | Today Daily Rush writes to `userProfile` only (`src/screens/DailyRushScreen.tsx:117-122`). **New**: also call `practiceProgressStore.recordDailyRushComplete(weekNumber)` |
| `flashcards`      | NEW METHOD  | distinct cardIds in `todoEventCounts.flashcardReviews[weekNumber]` ∩ resolved pool                    | **New**: `practiceProgressStore.recordFlashcardReview(weekNumber, cardId)`; **New**: `FlashcardReviewCard.kind?` field at `src/types/flashcard.ts:3`; **Wire**: `answerFlashcard` at `src/services/flashcardService.ts:21` must call into the store |
| `kanji`           | NEW METHOD  | distinct kanjiCardIds in `todoEventCounts.kanjiGoodAnswers[weekNumber]` ∩ `todo.kanjiSet`             | Same new wiring as `flashcards` but filtered by `card.kind === 'kanji'` and only `Good` answers              |
| `quiz`            | NEW METHOD  | `todoEventCounts.quizAttempts[weekNumber] >= passThreshold` (default 70)                                | **New**: `practiceProgressStore.recordQuizAttempt(weekNumber, score)`; **Wire**: `QuizScreen` final-submit handler |
| `example-sentences`| NEW METHOD | distinct sentenceIds in `todoEventCounts.exampleSentencesViewed[weekNumber]` ∩ week's example set    | **New**: `practiceProgressStore.markExampleViewed(weekNumber, sentenceId)`; **Wire**: `ExampleSentencesScreen` view-tracking effect |

`*` `daily-rush` is marked READY because the wiring change is a one-line add at the existing summarize site; the others need new methods and call sites.

### 5.1 Update semantics

The store's new methods follow a common contract:

```ts
// All take a weekNumber, return the updated LearnerProgress.
recordFlashcardReview(weekNumber: number, cardId: string): Promise<LearnerProgress>;
recordDailyRushComplete(weekNumber: number, date: string): Promise<LearnerProgress>;
recordQuizAttempt(weekNumber: number, score: number): Promise<LearnerProgress>;
markExampleViewed(weekNumber: number, sentenceId: string): Promise<LearnerProgress>;
recordKanjiGood(weekNumber: number, kanjiCardId: string): Promise<LearnerProgress>;
```

Each method:
1. Loads `weekPlan` for the week (or skips if none).
2. For every todo whose kind matches and whose filter accepts the event (e.g. pool ∩ cardId, kanjiSet ∩ kanjiCardId, lessonIds ∩ completedLessonIds), recompute `progress` from the event log (`todoEventCounts`).
3. Clamp at `target`, set `completedAt` on first cross.
4. Save progress once.

The store is the **only** writer of `todoEventCounts` and `todoStates` for these methods. Screens do not write directly. This keeps the source of truth single and lets us re-derive `todoStates` from `todoEventCounts` at any time.

### 5.2 Helper recompute (defensive)

Because `todoStates` is derived from `todoEventCounts`, we expose:

```ts
recomputeTodoStatesForWeek(weekNumber: number, progress: LearnerProgress): Record<string, TodoState>;
```

This is called by every `record*` method (single source of truth) and by `getProgress()` once at read time as a self-healing pass (in case persisted `todoStates` got out of sync with `todoEventCounts` from a prior buggy version).

### 5.3 The "no tap-to-mark-done" principle

Todos piggyback on actions the learner is *already supposed to do*. The only new tap the learner makes is `markExampleViewed`, which is emitted automatically by `ExampleSentencesScreen` view-tracking — no learner button. If a future kind has no natural counter source, we either skip that kind or add a single tap-to-confirm; we never invent a generic "Mark todo done" button.

---

## 6. Design decisions (superseded — see §11)

The original draft of this section asked Chris to pick A/B/C/D on five calls. After QC round 1, those decisions have been collapsed into concrete proposed defaults in **§11**. This section is kept for archival traceability but is no longer authoritative — implement against §11, not this list.

Quick reference to the surviving §11 mapping:
- §6.1 Soft vs hard gating → §11.1 (proposed: B)
- §6.2 Per-kind thresholds → §11.2 (defaults locked)
- §6.3 Skip mechanism → §11.3 (proposed: A for v1)
- §6.4 Mid-week content edits → §11.4 (accept asymmetry)
- §6.5 Reset behavior → §11.5 (wipe everything)

---

## 7. My ideas to make learning progression better (broader than todos)

You asked for ideas. Here are 10, ordered by what I think gives the most learner leverage per hour of engineering. None of these are committed — just options for future discussion.

### 7.1 Bite-sized daily plan, not weekly unlock

The current curriculum unlock is coarse (whole week). Learners disengage when "this week" feels like a wall. Consider a **3-task daily plan** surfaced on Home that *projects forward* into the week — so the learner feels daily progress even mid-week. Todos become the building blocks of that daily plan instead of a weekly checklist. Engineering cost: small (Home service + existing todo state).

### 7.2 Retention check, not just completion

Marking "lesson complete" is a poor proxy for retention. Add a **2-day and 7-day spaced review** of each lesson's vocabulary. If the learner forgets, the lesson doesn't unlock its follow-up cleanly. This is true SRS, and the app already has the data — it's just not gating on it yet.

### 7.3 Show the *next* thing earlier

Right now next-week is hidden until current-week is done. That's good for focus but bad for motivation. A **"Peek ahead" card** on the Lessons tab showing next week's topic ("Week 2: Asking for directions") with a small lock icon — gives the learner something to look forward to without diluting focus. Pairs well with gating option 6.1-B.

### 7.4 Streak insurance

A single missed day breaks streaks today. **One "streak freeze" per month** (earned, not purchased) softens this. Costs ~5 lines in `practiceProgressStore`. Free retention win.

### 7.5 Visible "what I already know"

When a learner marks a todo `lesson` complete, currently we trust them. Add a **"Show me I already know this"** flow: a 3-card micro-quiz at lesson start; passing skips the lesson body but still marks it complete for progression. Honors real prior knowledge instead of forcing busywork.

### 7.6 Streak-aware todo ordering

If a learner is on a hot streak (Daily Rush 7+ days), surface their *weakest* todo first (kanji if their kanji accuracy is lowest). Order todos by **probability of friction × estimated time** — high-impact, low-cost first. This is the same trick Duolingo uses for "strengthen skills".

### 7.7 Friday review, Monday preview

**Friday**: auto-roll up the week's todos into a single review quiz (re-uses the `quiz` todo kind). **Sunday night**: show a 3-bullet "What's next week about" card so learners start Monday oriented. Calendar-aware scheduling fits naturally on top of the todo system because the events already exist.

### 7.8 Confidence rating on flashcards

The current flashcard has only Good/Again. Add an optional **third button "Hard"** for cards the learner got right but with effort. Treat "Hard" cards as weighted higher in `kanji` and `flashcards` todos so the todo progress reflects *real* retention, not luck. ~20 LOC change in the flashcard screen + SRS update.

### 7.9 Social accountability without social network

Learners don't need a feed. A **single "study buddy" code** (6-char) lets two learners see each other's weekly todo completion (anonymized, opt-in). No posts, no chat. Pure accountability. Skippable entirely. Big differentiation vs. Duolingo's noisy social layer.

### 7.10 Stop hiding failure

If a learner times out on a Daily Rush card, the UI moves on. **Replay-the-missed-cards** at the end of a rush: the cards you `Again`-ed come back once at the end. One-line behavior change in the rush flow, big retention impact because it converts a loss into a redo.

---

## 8. Implementation plan (subject to §6 + §11 sign-off)

**Sequence principle (per QC round 1):** ship one kind end-to-end before wiring more kinds. UI never renders an empty gate. SQLite migration lands first, behind a feature flag, so a failed migration can't brick a learner's existing data.

### Phase 37a — SQLite migration behind feature flag (no behavior change yet)

Goal: schema bump in place, no learner-visible change.

1. `db/schema.ts`: add `CURRENT_SCHEMA_VERSION = 2`, add the 3 new columns with `'{}'` defaults.
2. `sqliteLearningRepository.ts`: update `createInitialProgress` defaults, `getProgress` JSON parsing, `saveProgress` 8-tuple. Parse failures fall back to `{}` with `console.warn`.
3. `practiceProgressStore.ts`: add a no-op `todoFeatureEnabled` flag (default `false`). When `false`, all new methods short-circuit.
4. Tests: `tests/phase37aSqliteMigration.test.ts`
   - **In-memory DB path** — instantiate via the `db.tables` map at `sqliteLearningRepository.ts:27`, NOT via `expo-sqlite`. Manually craft a v1 5-tuple insert, call `getProgress()`, assert the 3 new fields exist and are empty objects, assert no exception thrown.
   - JSON-parse-failure tolerance: write a corrupted JSON blob to one column, assert `getProgress()` returns `{}` for that field and warns.
   - Roll-forward: write a v1 progress row, run the migration logic, assert schema-version meta row was updated.

**Do not proceed to 37b until 37a is green.**

### Phase 37b — Data + service, one kind: `lesson`

Goal: prove the data model and pure service work for the simplest kind, with real UI smoke.

1. Add `src/types/weeklyTodo.ts` (`WeekTodo`, `WeekPlan`).
2. Add `src/data/weeklyPlans.ts` with **only** the N5 week 1 plan, containing exactly one `lesson`-kind todo referencing that week's `lessonIds`.
3. Add `src/services/weeklyPlansService.ts` and `src/services/weeklyTodoService.ts` per §4 (pure).
4. Add `src/services/weeklyCardPoolService.ts` per §3.1 (with empty resolution path tested).
5. Extend `practiceProgressStore.ts` with `todoFeatureEnabled = true` for this phase and the `lesson`-kind path: extend `completeCurrentLesson` to also recompute `todoStates` for the lesson's week.
6. Add `recomputeTodoStatesForWeek` per §5.2.
7. Add `buildAllTodoBoards` and `isWeekUnlocked` per §4.
8. Tests: `tests/phase37bLessonKind.test.ts`
   - `buildWeeklyTodoBoard` empty / partial / complete state
   - `recomputeTodoStatesForWeek` clamps at target, sets `completedAt` once
   - `isWeekUnlocked`: week 1 always true; week N>1 false until week N-1 board.allDone; legacy week N-1 returns true
   - Existing path tests (`phase20aLessonProgression`, `phase30*`, `phase38LessonsInteractionPath`, `phaseDeadButtons`) **still green** because `todoStates` and `weekTodosInitialized` default to `{}` and the path builder is unchanged
9. Smoke: enable feature flag in dev, open app fresh on week 1, observe `0/1` todo board, mark the lesson complete, observe `1/1`, attempt to advance to week 2 — locked. Disable flag, observe old behavior.

**Do not proceed to 37c until 37b is green and the gate has actually stopped a learner in a browser smoke.**

### Phase 37c — Lessons screen wiring (gate visible)

Goal: lessons screen shows the board and gates next week.

1. `src/screens/LessonsScreen.tsx`: render `WeeklyTodoBoard` block above the lesson list.
2. "Next week" CTA: disabled with copy "Finish Week N's todos to unlock" when `!isWeekUnlocked(weekNumber + 1, ...)`.
3. Per-todo CTA: `ctaRoute` deep-link to existing screens. Tap-through verified per kind in 37d.
4. Source-level regression assertions:
   - The next-week CTA calls `isWeekUnlocked` (text-grep)
   - The Continue-lesson CTA does NOT call `isWeekUnlocked` (per-week flow unaffected)
   - The board's `isLegacyWeek === true` path renders the legacy copy (string assertion)
5. Smoke: fresh learner → board visible → complete todo → next week unlocks → revisit week 1 → board reads `1/1`.

### Phase 37d — Plumb remaining kinds, one at a time

Each sub-phase adds one kind, wires its store method, wires its screen call site, adds focused tests, and runs browser smoke **before** moving to the next kind. This is the QC-flagged sequencing rule applied per kind.

#### 37d-1: `daily-rush`
- Add `practiceProgressStore.recordDailyRushComplete(weekNumber, date)`.
- Wire: at `src/screens/DailyRushScreen.tsx:117-122` summary, add the store call (preserving the existing `updateProfile` call — both fire).
- Tests: completing a rush increments the `daily-rush` todo; repeat completions same day do not double-count; different days do.
- Smoke: start rush → finish rush → todo chip flips to `1/1`.

#### 37d-2: `flashcards`
- Add `FlashcardReviewCard.kind?: 'kanji' | 'vocab'` at `src/types/flashcard.ts:3`.
- Backfill `kind` in `createFlashcardDeck` and `supplementalFlashcards`.
- Add `practiceProgressStore.recordFlashcardReview(weekNumber, cardId)`.
- Wire: `answerFlashcard` at `src/services/flashcardService.ts:21` calls the store after a successful answer.
- Tests: pool resolution (`week`/`level`) returns correct ids; non-pool cards ignored; `target` defaults to pool size; clamp at target.
- Smoke: review whole week's card pool → todo flips to done.

#### 37d-3: `kanji`
- Same wiring as `flashcards` but filtered by `card.kind === 'kanji'` and `answer === 'good'`.
- Tests: only Good answers count; non-kanji cards ignored; kanji outside the week's `kanjiSet` ignored.
- Smoke: review all kanji in the week with Good → todo done.

#### 37d-4: `quiz`
- Add `practiceProgressStore.recordQuizAttempt(weekNumber, score)`.
- Wire: `QuizScreen` final-submit handler calls the store.
- Tests: `recordQuizAttempt` updates `todoEventCounts.quizAttempts[weekNumber]` with `max(prior, new)`; threshold gating works.
- Smoke: take the weekly quiz, score below 70% → not done; score ≥ 70% → done.

#### 37d-5: `example-sentences`
- Add `practiceProgressStore.markExampleViewed(weekNumber, sentenceId)`.
- Wire: `ExampleSentencesScreen` view-tracking effect calls the store on render of each sentence card (debounced so flurries don't spam).
- Tests: only ids from the week's example set count; clamp at target.
- Smoke: scroll through the week's example set → todo flips.

### Phase 37e — Home + Progress integration

1. Home: surface today's todos as Home's "Today's focus" cards. One-tap navigation into the right screen via `ctaRoute`.
2. Progress: show "Week N todos: 3/5" + skipped count if §11.3 ≠ A.
3. Source-level assertion that Home's existing "Today's focus" selector does NOT shadow the new todo board (or does, intentionally — pick one and assert it).

### Phase 37f — Verification gate

Per the audit rule, the progression gate is yellow-zone code: it changes learner state shape and must be reviewed.

- `npm run typecheck`
- focused tests for 37a..37e (every sub-phase keeps its own green test file)
- full `npm test`
- `graphify update .`
- `npx expo export --platform web` — bundle HTTP probe; grep for the new constants (e.g. `WEEKLY_PLANS`, `isWeekUnlocked`)
- Browser smoke on each route: Home, Lessons, Flashcards, Quiz, Daily Rush, Progress, Example Sentences
- **Tusk / GPT-5.5 QC** on `src/services/weeklyTodoService.ts`, `practiceProgressStore.ts`, `sqliteLearningRepository.ts`, and `LessonsScreen.tsx` — the four highest-blast-radius files
- If GPT-5.5 unreachable: STOP with "QC BLOCKED" per audit rule, never silently substitute

### Phase 37g — Rollout (implemented 2026-07-01)

The three-tier rollout described in the original Phase 37g spec was
intended to derisk a future bad migration. In practice the 37a migration
landed cleanly (no production incidents), the SQLite cold-start
hydration added in 37g itself closes the loop on persisting
`completedLessonIds` across restarts, and the gate has been exercised
end-to-end on multiple kind paths (lesson / daily-rush / flashcards /
kanji / quiz / example-sentences) with QC-passing test coverage. We
therefore collapsed the tiered rollout into a single flip.

Implementation:

1. `src/services/practiceProgressStore.ts` — `todoFeatureEnabled` default
   is now `true`. The dev menu in `SettingsScreen` (under `__DEV__`)
   retains Enable/Disable buttons so a QA tester can flip the flag off
   in a specific session.
2. Eager disk-hydration: `createPracticeProgressStore` calls
   `repo.getProgress()` once on construction and copies the extended
   fields into the in-memory `extendedCache`. All mutating methods
   (`completeCurrentLesson`, `record*`, `markExampleViewed`) `await
   ensureHydrated()` before reading from the cache, so a mutation that
   arrives mid-hydration never clobbers the freshly-loaded state.
3. `src/repositories/sqliteLearningRepository.ts` — `getProgress()` now
   rebuilds `completedLessonIds` from every persisted row that has
   `completed = 1`, skipping the synthetic `todo-snapshot` placeholder
   rows written by `saveExtendedProgress`. Without this, a returning
   learner would lose their `completedLessonIds` across an app cold
   start even though the rows lived in the DB. Existing test fixtures
   that use the fake-SQLite helper (which no-ops persistence) are
   unaffected because the new hydration only commits when at least one
   real completion row exists.
4. `src/services/practiceProgressStore.ts` — added `ready()` so screens
   that need the freshest extended state on cold start can `await`
   hydration before rendering the gate.
5. `reset()` clears the extended cache and re-arms hydration; it
   intentionally does NOT re-read disk after delete because the SQLite
   repo's in-memory mirror holds the last row even after `DELETE FROM
   progress`, which would resurrect stale state.

Existing learners on weeks > currentWeek see the legacy
"Completed before weekly todos were introduced" copy on those rows
per the §3.4 step 4 rule. The current-week row renders the real
progress numbers immediately.

---

## 9. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Bad SQLite migration bricks existing learners | Feature flag, in-memory migration test, JSON-parse fall-back to `{}`, three-tier rollout (37g) |
| Learners feel punished by strict gating | §11.1 default is B (preview-but-locked); §11.3 default is A (no skip) for v1; if data shows backlash we move to B or add XP-skip in v2 without schema change |
| Author burden to write todos for every week | v1 ships N5 week 1 only (`lesson` kind) at 37b; remaining weeks and kinds added incrementally per 37d |
| `FlashcardReviewCard.kind` field change touches the deck generator | Backfill is in 37d-2 only; before that, the `flashcards` kind is simply not shipped. Decks work as before |
| `answerFlashcard` doesn't currently persist to `LearnerProgress` — wiring it could double-write | Recompute-from-event-log pattern in §5.2 means even if it fires twice, `todoStates` converges to the correct value. Test asserts idempotency |
| Gating breaks the existing curriculum-path tests | The path builder is untouched; new gate lives in `LessonsScreen.tsx`. Existing path tests stay green. Confirmed by §8 phase-37b step 8 |
| Pool resolver returns empty for misconfigured weeks | Fails closed: todo renders with "No cards found" helper, totalCount=1, completed=false. Learner cannot accidentally auto-pass |
| Daily Rush double-write to user-profile + store | Both fire on the same event. userProfile update is XP/streak, store update is todo counter. Independent write paths; no race |
| §11.1-B (preview-but-locked) prior-week render rule needs extra UI work | §3.4 step 4 covers it with a single `isLegacyWeek` boolean; the legacy copy is one string |
| Skip mechanism (§11.3) undecided at code time | Implementation does not depend on the choice until a skip UI is built. `skipped?: boolean` field exists from v1 so a future skip doesn't need a migration |

---

## 10. Open questions for Chris before code

These remain genuinely open:

1. **§11.4 — confirm the proposed defaults.** The proposal now proposes concrete defaults for §6.1, §6.2, §6.3, §6.4, §6.5 in §11. Please confirm or override.
2. **§7 ideas — any of the 10 to fold into Phase 37?** Each adds scope; recommend deferring all 10 to a future phase unless one is a hard requirement.
3. **Feature-flag exposure.** Is a dev-menu toggle acceptable for the rollout phases 37g-1 → 37g-3, or do you want a server-controlled flag? (Affects nothing in v1 since flag stays `false` for end users.)
4. **Pool resolver for `'level'`** — confirm it reads from `userProfileService` JLPT target, not a separate learner-preference setting.

---

## 11. Proposed defaults (replace §6 — please confirm or override)

QC round 1 left §6 as "Chris picks A/B/C/D." This revision proposes concrete defaults. Implementable as soon as you confirm. None of these lock us out of the alternatives later — they only choose the v1 shape.

### 11.1 Gating strictness (was §6.1) → **B. Hard block + preview**

Next week's lessons are visible (read-only) on the Lessons tab, but the `Continue` CTA is disabled with copy "Finish Week N's todos to unlock Week N+1". Lessons remain tappable for preview. **Why B over A:** the QC flagged that pure hard block combined with no prior-week render rule was hostile to existing mid-curriculum learners. B pairs cleanly with the §3.4 step 4 `isLegacyWeek` render rule.

### 11.2 Per-kind thresholds (was §6.2) → defaults locked:

- `flashcards`: target = pool size (review whole week's pool once). Pool default = `week`.
- `daily-rush`: target = 1 (any single completed rush counts for the week).
- `quiz`: target = 1 attempt at ≥ 70%. Best score across attempts wins.
- `lesson`: target = `lessonIds.length` (every listed lesson complete).
- `kanji`: target = `kanjiSet.length` (every listed kanji card marked Good at least once).
- `example-sentences`: target = 5 sentences viewed (placeholder; can be tuned per week in `weeklyPlans.ts`).

### 11.3 Skip mechanism (was §6.3) → **A. No skip for v1**

Pure gate. `skipped?: boolean` field exists in `TodoState` from day one so v2 can add XP-skip or attest-skip without a migration. UI shows skipped todos as a separate visual treatment if/when §11.3 changes.

### 11.4 Mid-week content edits (was §6.4) → accept asymmetry

- Existing `todoStates` for the week stay (target was snapshotted at init).
- New todos added later that week: appear with `progress=0`.
- Removed todos: stay in `todoStates` but ignored by `buildWeeklyTodoBoard`.
- Re-seeding is gated by `weekTodosInitialized[weekNumber]` and never fires again for that week.

Documented in the UI's edit-author guide; no code-side resolution.

### 11.5 Reset (was §6.5) → **wipe everything**

`practiceProgressStore.reset()` clears `todoStates`, `weekTodosInitialized`, `todoEventCounts`. Next read re-seeds the current week from current `weeklyPlans.ts`. No special handling.