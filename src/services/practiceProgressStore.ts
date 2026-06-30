import type { PersistentLearningRepository } from '../repositories/sqliteLearningRepository';
import { getAllLessons } from './lessonService';
import { buildProgressDashboard } from './progressDashboardService';
import { getWeekPlan } from './weeklyPlansService';
import { resolveCardPool, resolveKanjiSet } from './weeklyCardPoolService';
import { recomputeTodoStatesForWeek, type TodoPayload } from './weeklyTodoService';
import type { TodoState, TodoEventCounts, WeekTodo } from '../types/weeklyTodo';

export type PracticeProgressStore = ReturnType<typeof createPracticeProgressStore>;

// Phase 37a (P1-4 fix): the weekly-todo gate is OFF by default until phase
// 37c wires the UI. Both `createPracticeProgressStore` and `LessonsScreen`
// need to read this same flag, so it is exported as a named binding rather
// than buried inside the factory closure. Mutate via setTodoFeatureEnabled()
// — the store rebuilds its own derived state lazily on the next call.
export let todoFeatureEnabled = false;
export function setTodoFeatureEnabled(next: boolean): void {
  todoFeatureEnabled = next;
}
export function isTodoFeatureEnabled(): boolean {
  return todoFeatureEnabled;
}

async function getLessonCatalog(repo: PersistentLearningRepository) {
  const persistedLessons = await repo.getLessons();
  return persistedLessons.length ? persistedLessons : getAllLessons();
}

export function createPracticeProgressStore(repo: PersistentLearningRepository) {
  return {
    async completeCurrentLesson(lessonId: string, score: number, date: string) {
      await repo.saveCompletedLesson(lessonId, score, date);
      // Phase 37b: when the todo gate is enabled and a WeekPlan exists for
      // the lesson's week, recompute todo states from the now-updated
      // completedLessonIds list. Idempotent: calling twice converges to the
      // same state. The recomputed snapshot is flushed to disk via
      // repo.saveExtendedProgress so it survives a cold start (otherwise the
      // gate UI in 37c would read stale state after every app reload).
      if (todoFeatureEnabled && typeof repo.saveExtendedProgress === 'function') {
        const lessonWeek = getAllLessons().find(l => l.id === lessonId)?.week;
        if (lessonWeek != null) {
          const weekPlan = getWeekPlan(lessonWeek);
          if (weekPlan && weekPlan.todos.length > 0) {
            const updated = await repo.getProgress();
            const extended = updated as unknown as TodoPayload & {
              todoStates: Record<string, TodoState>;
              weekTodosInitialized: Record<number, boolean>;
              todoEventCounts: TodoEventCounts;
            };
            const existing = (extended.todoStates ?? {}) as Record<string, TodoState>;
            const seed: Record<string, TodoState> = { ...existing };
            if (!extended.weekTodosInitialized?.[lessonWeek]) {
              for (const todo of weekPlan.todos) {
                if (!seed[todo.id]) {
                  seed[todo.id] = {
                    todoId: todo.id,
                    weekNumber: lessonWeek,
                    progress: 0,
                    target: todo.target,
                  };
                }
              }
            }
            const payload: TodoPayload = {
              todoStates: seed,
              weekTodosInitialized: { ...(extended.weekTodosInitialized ?? {}), [lessonWeek]: true },
              todoEventCounts: extended.todoEventCounts ?? {
                flashcardReviews: {},
                quizAttempts: {},
                dailyRushDates: {},
                exampleSentencesViewed: {},
                kanjiGoodAnswers: {},
              },
              completedLessonIds: updated.completedLessonIds,
            };
            const recomputed = recomputeTodoStatesForWeek(lessonWeek, weekPlan, payload);
            const nextTodoStates = { ...seed, ...recomputed };
            // Cast through unknown so the two slightly-different TodoEventCounts
            // shapes (one keyed by string index in the repo's ExtendedLearnerProgress
            // view, one with named keys here) can converge for the persistence call.
            await repo.saveExtendedProgress({
              ...updated,
              todoStates: nextTodoStates,
              weekTodosInitialized: payload.weekTodosInitialized,
              todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
            } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
          }
        }
      }
    },
    async getDashboard() { return buildProgressDashboard(await repo.getProgress(), await getLessonCatalog(repo)); },
    /**
     * Phase 37d-1 — record that a Daily Rush was completed on `date` for
     * `weekNumber`. Appends the date to
     * `todoEventCounts.dailyRushDates[weekNumber]` (de-duplicated so repeat
     * runs on the same day do not bloat the log) and recomputes the week's
     * todo states, persisting the snapshot via saveExtendedProgress so the
     * gate UI in 37c reads fresh state after a cold start.
     *
     * No-op while todoFeatureEnabled is false (matches the completeCurrentLesson
     * pattern) so the gate stays invisible until 37g flips the flag.
     *
     * Returns the persisted LearnerProgress (mirrors the §5.1 contract).
     */
    async recordDailyRushComplete(weekNumber: number, date: string) {
      if (!todoFeatureEnabled) return repo.getProgress();
      if (typeof repo.saveExtendedProgress !== 'function') return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload & {
        todoStates: Record<string, TodoState>;
        weekTodosInitialized: Record<number, boolean>;
        todoEventCounts: TodoEventCounts;
      };

      // De-duped append of the date into dailyRushDates[weekNumber]. We never
      // mutate the existing array — we spread into a fresh one to keep the
      // recompute input immutable across concurrent calls.
      const priorDates = extended.todoEventCounts?.dailyRushDates?.[weekNumber] ?? [];
      const nextDates = priorDates.includes(date) ? priorDates : [...priorDates, date];
      const nextEventCounts: TodoEventCounts = {
        ...(extended.todoEventCounts ?? {
          flashcardReviews: {},
          quizAttempts: {},
          dailyRushDates: {},
          exampleSentencesViewed: {},
          kanjiGoodAnswers: {},
        }),
        dailyRushDates: {
          ...(extended.todoEventCounts?.dailyRushDates ?? {}),
          [weekNumber]: nextDates,
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      // For `daily-rush` todos we compute the count directly from the updated
      // dailyRushDates list (recomputeTodoStatesForWeek is lesson-only in 37b;
      // 37d-1 owns the daily-rush progress rule per proposal §5).
      const existingStates = (extended.todoStates ?? {}) as Record<string, TodoState>;
      const seed: Record<string, TodoState> = { ...existingStates };
      if (weekPlan && !extended.weekTodosInitialized?.[weekNumber]) {
        for (const todo of weekPlan.todos) {
          if (!seed[todo.id]) {
            seed[todo.id] = {
              todoId: todo.id,
              weekNumber,
              progress: 0,
              target: todo.target,
            };
          }
        }
      }
      if (weekPlan) {
        for (const todo of weekPlan.todos) {
          if (todo.kind !== 'daily-rush') continue;
          const prior = seed[todo.id];
          const reached = nextDates.length > 0;
          const target = prior?.target ?? todo.target;
          const progress = reached ? Math.min(1, target) : 0;
          seed[todo.id] = {
            todoId: todo.id,
            weekNumber,
            progress,
            target,
            completedAt: reached ? (prior?.completedAt ?? Date.now()) : undefined,
            skipped: prior?.skipped,
          };
        }
      }

      const payload: TodoPayload = {
        todoStates: seed,
        weekTodosInitialized: { ...(extended.weekTodosInitialized ?? {}), [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      const recomputed = weekPlan
        ? recomputeTodoStatesForWeek(weekNumber, weekPlan, payload)
        : {};
      const nextTodoStates = { ...seed, ...recomputed };

      // Cast through unknown — same pattern completeCurrentLesson uses (37b).
      await repo.saveExtendedProgress({
        ...updated,
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
      } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);

      return repo.getProgress();
    },
    /**
     * Phase 37d-2 — record that a single flashcard was reviewed on this
     * device for `weekNumber`. Appends `cardId` to
     * `todoEventCounts.flashcardReviews[weekNumber]` (de-duplicated so
     * re-reviewing the same card does not bloat the log) and recomputes the
     * `flashcards`-kind todos for the week, persisting via saveExtendedProgress
     * so the gate UI in 37c reads fresh state after a cold start.
     *
     * Per docs/phase-37-todo-gated-progression-proposal.md §5 row
     * `flashcards`: progress = |distinct cardIds in
     * todoEventCounts.flashcardReviews[weekNumber] ∩ resolved pool|,
     * clamped at target. completedAt is set on the first cross.
     *
     * No-op while todoFeatureEnabled is false (matches the
     * recordDailyRushComplete / completeCurrentLesson pattern) so the gate
     * stays invisible until 37g flips the flag. Returns the persisted
     * LearnerProgress (mirrors the §5.1 contract).
     */
    async recordFlashcardReview(weekNumber: number, cardId: string) {
      if (!todoFeatureEnabled) return repo.getProgress();
      if (typeof repo.saveExtendedProgress !== 'function') return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      if (!weekPlan) return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload & {
        todoStates: Record<string, TodoState>;
        weekTodosInitialized: Record<number, boolean>;
        todoEventCounts: TodoEventCounts;
      };

      // De-duped append of cardId into flashcardReviews[weekNumber].
      const priorReviewed = extended.todoEventCounts?.flashcardReviews?.[weekNumber] ?? [];
      const nextReviewed = priorReviewed.includes(cardId)
        ? priorReviewed
        : [...priorReviewed, cardId];
      const nextEventCounts: TodoEventCounts = {
        ...(extended.todoEventCounts ?? {
          flashcardReviews: {},
          quizAttempts: {},
          dailyRushDates: {},
          exampleSentencesViewed: {},
          kanjiGoodAnswers: {},
        }),
        flashcardReviews: {
          ...(extended.todoEventCounts?.flashcardReviews ?? {}),
          [weekNumber]: nextReviewed,
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      const existingStates = (extended.todoStates ?? {}) as Record<string, TodoState>;
      const seed: Record<string, TodoState> = { ...existingStates };
      if (!extended.weekTodosInitialized?.[weekNumber]) {
        for (const todo of weekPlan.todos) {
          if (!seed[todo.id]) {
            seed[todo.id] = {
              todoId: todo.id,
              weekNumber,
              progress: 0,
              target: todo.target,
            };
          }
        }
      }

      // Compute per-flashcards-todo progress from the updated event log ∩ pool.
      // recomputeTodoStatesForWeek (37b) only handles lesson-kind; we therefore
      // compute the flashcards-kind progress ourselves and merge into seed.
      // §11.2 default: target defaults to the pool size via resolveCardPool's
      // `expectedTarget`. The author leaves `target` as 0 so the resolver
      // owns the count — read expectedTarget when target is 0.
      for (const todo of weekPlan.todos) {
        if (todo.kind !== 'flashcards') continue;
        const flashcardTodo = todo as WeekTodo;
        const pool = resolveCardPool(flashcardTodo.pool, weekNumber);
        const poolSet = new Set(pool.cardIds);
        const reviewedInPool = nextReviewed.filter(id => poolSet.has(id));
        const progressCount = reviewedInPool.length;
        const prior = seed[todo.id];
        const target = prior?.target && prior.target > 0
          ? prior.target
          : (flashcardTodo.target > 0 ? flashcardTodo.target : (pool.expectedTarget ?? flashcardTodo.target));
        const clamped = Math.min(progressCount, target);
        const reached = clamped >= target && target > 0;
        seed[todo.id] = {
          todoId: todo.id,
          weekNumber,
          progress: clamped,
          target,
          completedAt: reached ? (prior?.completedAt ?? Date.now()) : undefined,
          skipped: prior?.skipped,
        };
      }

      const payload: TodoPayload = {
        todoStates: seed,
        weekTodosInitialized: { ...(extended.weekTodosInitialized ?? {}), [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Cast through unknown — same pattern recordDailyRushComplete uses (37d-1).
      await repo.saveExtendedProgress({
        ...updated,
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
      } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);

      return repo.getProgress();
    },
    /**
     * Phase 37d-3 — record that a single kanji card was marked Good for
     * `weekNumber`. Appends `kanjiCardId` to
     * `todoEventCounts.kanjiGoodAnswers[weekNumber]` (de-duplicated so
     * re-marking the same card Good does not bloat the log) and recomputes
     * the `kanji`-kind todos for the week, persisting via saveExtendedProgress
     * so the gate UI in 37c reads fresh state after a cold start.
     *
     * Per docs/phase-37-todo-gated-progression-proposal.md §5 row `kanji`:
     * progress = |distinct kanjiCardIds in
     * todoEventCounts.kanjiGoodAnswers[weekNumber] ∩ todo.kanjiSet|, clamped
     * at target. completedAt is set on the first cross.
     *
     * Source for `kanjiSet` is the todo's own `kanjiSet` array (proposal
     * §3.1, §11.2 default target = kanjiSet.length). The call site (currently
     * FlashcardsScreen.markGoodAndAdvance) is responsible for filtering by
     * `card.kind === 'kanji'` AND `answer === 'good'` — this store method
     * trusts the caller and stores whatever kanjiCardId it receives, then
     * intersects with the todo's kanjiSet to scope the count.
     *
     * No-op while todoFeatureEnabled is false (matches the
     * recordFlashcardReview / recordDailyRushComplete / completeCurrentLesson
     * pattern) so the gate stays invisible until 37g flips the flag. Returns
     * the persisted LearnerProgress (mirrors the §5.1 contract).
     */
    async recordKanjiGood(weekNumber: number, kanjiCardId: string) {
      if (!todoFeatureEnabled) return repo.getProgress();
      if (typeof repo.saveExtendedProgress !== 'function') return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      if (!weekPlan) return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload & {
        todoStates: Record<string, TodoState>;
        weekTodosInitialized: Record<number, boolean>;
        todoEventCounts: TodoEventCounts;
      };

      // De-duped append of kanjiCardId into kanjiGoodAnswers[weekNumber].
      const priorGood = extended.todoEventCounts?.kanjiGoodAnswers?.[weekNumber] ?? [];
      const nextGood = priorGood.includes(kanjiCardId)
        ? priorGood
        : [...priorGood, kanjiCardId];
      const nextEventCounts: TodoEventCounts = {
        ...(extended.todoEventCounts ?? {
          flashcardReviews: {},
          quizAttempts: {},
          dailyRushDates: {},
          exampleSentencesViewed: {},
          kanjiGoodAnswers: {},
        }),
        kanjiGoodAnswers: {
          ...(extended.todoEventCounts?.kanjiGoodAnswers ?? {}),
          [weekNumber]: nextGood,
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      const existingStates = (extended.todoStates ?? {}) as Record<string, TodoState>;
      const seed: Record<string, TodoState> = { ...existingStates };
      if (!extended.weekTodosInitialized?.[weekNumber]) {
        for (const todo of weekPlan.todos) {
          if (!seed[todo.id]) {
            seed[todo.id] = {
              todoId: todo.id,
              weekNumber,
              progress: 0,
              target: todo.target,
            };
          }
        }
      }

      // Compute per-kanji-todo progress from the updated event log ∩ kanjiSet.
      // recomputeTodoStatesForWeek (37b) only handles lesson-kind; we therefore
      // compute the kanji-kind progress ourselves and merge into seed. The
      // resolver (resolveKanjiSet) owns the kanjiSet → cardIds mapping and the
      // expectedTarget fallback. Per §11.2 default: target defaults to
      // kanjiSet.length via resolveKanjiSet's `expectedTarget`; the author
      // can also set todo.target > 0 to override.
      for (const todo of weekPlan.todos) {
        if (todo.kind !== 'kanji') continue;
        const kanjiTodo = todo as WeekTodo;
        const kanjiSetResolution = resolveKanjiSet(kanjiTodo.kanjiSet);
        const kanjiSet = new Set(kanjiSetResolution.cardIds);
        const goodInSet = nextGood.filter(id => kanjiSet.has(id));
        const progressCount = goodInSet.length;
        const prior = seed[todo.id];
        const target = prior?.target && prior.target > 0
          ? prior.target
          : (kanjiTodo.target > 0 ? kanjiTodo.target : (kanjiSetResolution.expectedTarget ?? kanjiTodo.target));
        const clamped = Math.min(progressCount, target);
        const reached = clamped >= target && target > 0;
        seed[todo.id] = {
          todoId: todo.id,
          weekNumber,
          progress: clamped,
          target,
          completedAt: reached ? (prior?.completedAt ?? Date.now()) : undefined,
          skipped: prior?.skipped,
        };
      }

      const payload: TodoPayload = {
        todoStates: seed,
        weekTodosInitialized: { ...(extended.weekTodosInitialized ?? {}), [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Cast through unknown — same pattern recordFlashcardReview uses (37d-2).
      await repo.saveExtendedProgress({
        ...updated,
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
      } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);

      return repo.getProgress();
    },
    /**
     * Phase 37d-4 — record a quiz attempt with score `score` (0..100) for
     * `weekNumber`. Updates `todoEventCounts.quizAttempts[weekNumber]` to
     * the BEST score across attempts (max(prior, score)) and recomputes
     * the `quiz`-kind todos for the week, persisting via saveExtendedProgress
     * so the gate UI in 37c reads fresh state after a cold start.
     *
     * Per docs/phase-37-todo-gated-progression-proposal.md §5 row `quiz`:
     * progress is binary — 1 if the best score >= passThreshold (default
     * 70, configurable per todo), clamped at target. §11.2 default target
     * is 1: a single attempt at >= 70% closes the todo. completedAt is
     * set on the first cross.
     *
     * Notes:
     *  - `quizAttempts[weekNumber]` is a single number per week (not an
     *    array) — the §5 counter is "best score across attempts wins".
     *  - The passThreshold defaults to 70; a future per-todo override via
     *    WeekTodo.passThreshold is supported if added in a later phase.
     *  - The QuizScreen call site is responsible for filtering by
     *    `score >= 0 && score <= 100`. The store trusts the caller.
     *
     * No-op while todoFeatureEnabled is false (matches the
     * recordKanjiGood / recordFlashcardReview / recordDailyRushComplete
     * / completeCurrentLesson pattern) so the gate stays invisible until
     * 37g flips the flag. Returns the persisted LearnerProgress
     * (mirrors the §5.1 contract).
     */
    async recordQuizAttempt(weekNumber: number, score: number) {
      if (!todoFeatureEnabled) return repo.getProgress();
      if (typeof repo.saveExtendedProgress !== 'function') return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      if (!weekPlan) return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload & {
        todoStates: Record<string, TodoState>;
        weekTodosInitialized: Record<number, boolean>;
        todoEventCounts: TodoEventCounts;
      };

      // Best-score semantics: todoEventCounts.quizAttempts[weekNumber] is
      // the maximum of the prior score and the new attempt. §5 row 'quiz':
      // "Best score across attempts wins".
      const priorBest = extended.todoEventCounts?.quizAttempts?.[weekNumber] ?? 0;
      const nextBest = Math.max(priorBest, score);
      const nextEventCounts: TodoEventCounts = {
        ...(extended.todoEventCounts ?? {
          flashcardReviews: {},
          quizAttempts: {},
          dailyRushDates: {},
          exampleSentencesViewed: {},
          kanjiGoodAnswers: {},
        }),
        quizAttempts: {
          ...(extended.todoEventCounts?.quizAttempts ?? {}),
          [weekNumber]: nextBest,
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      const existingStates = (extended.todoStates ?? {}) as Record<string, TodoState>;
      const seed: Record<string, TodoState> = { ...existingStates };
      if (!extended.weekTodosInitialized?.[weekNumber]) {
        for (const todo of weekPlan.todos) {
          if (!seed[todo.id]) {
            seed[todo.id] = {
              todoId: todo.id,
              weekNumber,
              progress: 0,
              target: todo.target,
            };
          }
        }
      }

      // Compute per-quiz-todo progress. Per §11.2 default: target = 1 and
      // passThreshold defaults to 70. Progress is binary: 1 if best score
      // >= passThreshold and target > 0, else 0. Clamp at target.
      for (const todo of weekPlan.todos) {
        if (todo.kind !== 'quiz') continue;
        const prior = seed[todo.id];
        const target = prior?.target && prior.target > 0
          ? prior.target
          : todo.target;
        const passThreshold = 70; // §11.2 default — override via WeekTodo.passThreshold in a later phase if added.
        const reached = nextBest >= passThreshold && target > 0;
        const progress = reached ? Math.min(1, target) : 0;
        seed[todo.id] = {
          todoId: todo.id,
          weekNumber,
          progress,
          target,
          completedAt: reached ? (prior?.completedAt ?? Date.now()) : undefined,
          skipped: prior?.skipped,
        };
      }

      const payload: TodoPayload = {
        todoStates: seed,
        weekTodosInitialized: { ...(extended.weekTodosInitialized ?? {}), [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Cast through unknown — same pattern recordKanjiGood uses (37d-3).
      await repo.saveExtendedProgress({
        ...updated,
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
      } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);

      return repo.getProgress();
    },
    /**
     * Phase 30 — expose the raw learner progress so screens (e.g. the
     * Lessons screen) can show weekly progress ("3 of 5 done this week")
     * without rebuilding the full dashboard summary on every render.
     */
    async getProgress() { return repo.getProgress(); },
    /** Phase 25 / P0-2: wipe all persisted progress + reset in-memory cache. */
    async reset() { await repo.deleteAllProgress(); },

    // -------------------------------------------------------------------
    // Phase 37a stubs. These are no-ops while todoFeatureEnabled is false.
    // Phase 37b will replace the bodies with the real weeklyTodoService
    // calls; phase 37c will flip todoFeatureEnabled to true.
    // -------------------------------------------------------------------

    /** Phase 37a stub. Phase 37b will seed the current week's todos. */
    async ensureWeekTodosInitialized() {
      if (!todoFeatureEnabled) return null;
      // Phase 37b: call weeklyTodoService.ensureSeeded(weekNumber, progress).
      return null;
    },

    /** Phase 37a stub. Phase 37b will compute per-todo completion. */
    async getWeekTodoState(_weekNumber: number) {
      if (!todoFeatureEnabled) return null;
      // Phase 37b: return weeklyTodoService.computeState(weekNumber, progress).
      return null;
    },

    /** Phase 37a stub. Phase 37b will return the gate verdict (allDone / canAdvance). */
    async canAdvanceToNextWeek() {
      if (!todoFeatureEnabled) return true;
      // Phase 37b: return weeklyTodoService.canAdvance(progress).
      return true;
    },
  };
}