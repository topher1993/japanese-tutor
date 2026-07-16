import type { PersistentLearningRepository } from '../repositories/sqliteLearningRepository';
import { getAllCourseLessons, getPhraseLessons } from './lessonService';
import { buildProgressDashboard } from './progressDashboardService';
import { getAllWeekPlans, getWeekPlan } from './weeklyPlansService';
import { resolveCardPool, resolveKanjiSet } from './weeklyCardPoolService';
import {
  maybeRecordWeeklyReviewCompletion,
  recomputeTodoStatesForWeek,
  type TodoPayload,
} from './weeklyTodoService';
import type { QuizHistoryEntry, TodoState, TodoEventCounts, WeekTodo } from '../types/weeklyTodo';
import { calculateStudyStreak, dailyTodoTarget, localDateKey } from './dailyTodoService';
import { resolveActivePhraseWeek } from './activeLessonWeekService';
import type { MasteryEvidence, MasterySnapshot } from '../types/mastery';
import type { PlacementLevel } from './placementTestService';

// React Native injects `__DEV__` at runtime; declare it for TS so we don't
// get an implicit-any error when guarding console.warn calls.
declare const __DEV__: boolean | undefined;

export type PracticeProgressStore = ReturnType<typeof createPracticeProgressStore>;

// Phase 37g — the weekly-todo gate ships ON by default. Phase 37a–37h
// landed behind a feature flag so each sub-phase could be QA'd in isolation;
// 37g promotes the gate to default-on for all learners (existing learners
// see the `isLegacyWeek` render rule for prior weeks — proposal §3.4 step 4).
// `createPracticeProgressStore` and `LessonsScreen` both read this same flag
// via the named binding, so the flip is a one-line constant change.
// Mutate via setTodoFeatureEnabled() if a QA tester needs to disable the gate
// in a specific session — the dev-menu toggle in SettingsScreen calls it.
export let todoFeatureEnabled = true;
export function setTodoFeatureEnabled(next: boolean): void {
  todoFeatureEnabled = next;
}
export function isTodoFeatureEnabled(): boolean {
  return todoFeatureEnabled;
}

async function getLessonCatalog(repo: PersistentLearningRepository) {
  const persistedLessons = await repo.getLessons();
  // Keep the legacy phrase catalog as the dashboard/course baseline. Grammar
  // lessons are an additive track and are resolved separately by
  // `courseLessonById` when a grammar lesson is completed.
  return persistedLessons.length ? persistedLessons : getPhraseLessons();
}

function courseLessonById(lessonId: string) {
  return getAllCourseLessons().find(lesson => lesson.id === lessonId);
}

function todoTrackForLesson(lessonId: string): 'phrases' | 'grammar' {
  return courseLessonById(lessonId)?.category === 'grammar' ? 'grammar' : 'phrases';
}

/** Phase 37b — local shape for the in-memory extended-progress cache. The
 * extended fields (todoStates / weekTodosInitialized / todoEventCounts) are
 * persisted via `repo.saveExtendedProgress`, but the underlying repo's
 * `getProgress()` only returns the canonical LearnerProgress. The store
 * maintains a single in-memory cache of the extended slice so screens that
 * gate UI on todo state can read it back synchronously after a
 * `completeCurrentLesson` / `record*` call. Phase 37g adds eager hydration
 * from disk on store construction so the cache reflects persisted state on
 * app cold start; callers can await `ready()` to wait for hydration to
 * finish. */
type ExtendedProgressCache = {
  todoStates: Record<string, TodoState>;
  weekTodosInitialized: Record<number, boolean>;
  todoEventCounts: TodoEventCounts;
};

function emptyExtendedProgressCache(): ExtendedProgressCache {
  return {
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: {
      flashcardReviews: {},
      quizAttempts: {},
      dailyRushDates: {},
      exampleSentencesViewed: {},
      kanjiGoodAnswers: {},
      seenStageAdvancedRefIds: {},
      dailyActivity: {},
      quizHistory: [],
    },
  };
}

function defaultEmptyEventCounts(): TodoEventCounts {
  return {
    flashcardReviews: {},
    quizAttempts: {},
    dailyRushDates: {},
    exampleSentencesViewed: {},
    kanjiGoodAnswers: {},
    seenStageAdvancedRefIds: {},
    dailyActivity: {},
    quizHistory: [],
  };
}

function mergeStringArrayRecords(
  base: Record<number, string[]> | undefined,
  overlay: Record<number, string[]> | undefined,
): Record<number, string[]> {
  const result: Record<number, string[]> = { ...(base ?? {}) };
  for (const [week, values] of Object.entries(overlay ?? {})) {
    const weekNumber = Number(week);
    result[weekNumber] = Array.from(new Set([...(result[weekNumber] ?? []), ...values]));
  }
  return result;
}

function mergeQuizAttempts(
  base: Record<number, number> | undefined,
  overlay: Record<number, number> | undefined,
): Record<number, number> {
  const result: Record<number, number> = { ...(base ?? {}) };
  for (const [week, score] of Object.entries(overlay ?? {})) {
    const weekNumber = Number(week);
    result[weekNumber] = Math.max(result[weekNumber] ?? 0, score);
  }
  return result;
}

function mergeDailyActivity(
  base: TodoEventCounts['dailyActivity'] | undefined,
  overlay: TodoEventCounts['dailyActivity'] | undefined,
): TodoEventCounts['dailyActivity'] {
  const result = { ...(base ?? {}) };
  for (const [date, activity] of Object.entries(overlay ?? {})) {
    const prior = result[date] ?? {};
    result[date] = {
      ...prior,
      ...activity,
      lessonIds: Array.from(new Set([...(prior.lessonIds ?? []), ...(activity.lessonIds ?? [])])),
      flashcardReviewIds: Array.from(new Set([...(prior.flashcardReviewIds ?? []), ...(activity.flashcardReviewIds ?? [])])),
      sentenceLabReviewIds: Array.from(new Set([...(prior.sentenceLabReviewIds ?? []), ...(activity.sentenceLabReviewIds ?? [])])),
      dailyRushCompleted: prior.dailyRushCompleted === true || activity.dailyRushCompleted === true,
      quizCompleted: prior.quizCompleted === true || activity.quizCompleted === true,
      quizBestScore: Math.max(prior.quizBestScore ?? 0, activity.quizBestScore ?? 0) || undefined,
    };
  }
  return result;
}

function mergeQuizHistory(
  base: QuizHistoryEntry[] | undefined,
  overlay: QuizHistoryEntry[] | undefined,
): QuizHistoryEntry[] {
  const byId = new Map<string, QuizHistoryEntry>();
  for (const entry of [...(base ?? []), ...(overlay ?? [])]) byId.set(entry.id, entry);
  return Array.from(byId.values())
    .sort((left, right) => left.completedAt.localeCompare(right.completedAt))
    .slice(-100);
}

/** Lossless merge for repository snapshots and the newer live web cache. */
function mergeTodoEventCounts(
  base: TodoEventCounts,
  overlay: TodoEventCounts | undefined,
): TodoEventCounts {
  const evidenceById = new Map((base.masteryEvidence ?? []).map(item => [item.id, item]));
  for (const item of overlay?.masteryEvidence ?? []) evidenceById.set(item.id, item);
  const snapshotsByDate = new Map((base.masterySnapshots ?? []).map(item => [item.date, item]));
  for (const item of overlay?.masterySnapshots ?? []) snapshotsByDate.set(item.date, item);
  const masteryEvidence = Array.from(evidenceById.values());
  const masterySnapshots = Array.from(snapshotsByDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  return {
    ...defaultEmptyEventCounts(),
    ...base,
    ...(overlay ?? {}),
    flashcardReviews: mergeStringArrayRecords(base.flashcardReviews, overlay?.flashcardReviews),
    quizAttempts: mergeQuizAttempts(base.quizAttempts, overlay?.quizAttempts),
    dailyRushDates: mergeStringArrayRecords(base.dailyRushDates, overlay?.dailyRushDates),
    exampleSentencesViewed: mergeStringArrayRecords(base.exampleSentencesViewed, overlay?.exampleSentencesViewed),
    kanjiGoodAnswers: mergeStringArrayRecords(base.kanjiGoodAnswers, overlay?.kanjiGoodAnswers),
    seenStageAdvancedRefIds: mergeStringArrayRecords(base.seenStageAdvancedRefIds, overlay?.seenStageAdvancedRefIds),
    dailyActivity: mergeDailyActivity(base.dailyActivity, overlay?.dailyActivity),
    quizHistory: mergeQuizHistory(base.quizHistory, overlay?.quizHistory),
    ...(masteryEvidence.length > 0 ? { masteryEvidence } : {}),
    ...(masterySnapshots.length > 0 ? { masterySnapshots } : {}),
  };
}

function resolvedInitialTarget(todo: WeekTodo, weekNumber: number): number {
  if (todo.target > 0) return todo.target;
  if (todo.kind === 'kanji') return resolveKanjiSet(todo.kanjiSet).expectedTarget ?? 0;
  if (todo.kind === 'flashcards') return resolveCardPool(todo.pool, weekNumber).expectedTarget ?? 0;
  return 0;
}

/**
 * Phase 51 Q6d: Daily Rush todo progress represents distinct cards advanced
 * out of `seen`, not the number of times the Rush screen was completed. Keep
 * a one-point participation floor after any completed Rush for older learners
 * whose pre-Q6d rows do not contain stage-transition evidence.
 */
function dailyRushTodoProgress(
  eventCounts: TodoEventCounts,
  weekNumber: number,
  target: number,
): number {
  const advancedRefIds = new Set(
    Object.values(eventCounts.seenStageAdvancedRefIds ?? {}).flat(),
  );
  const participationFloor = (eventCounts.dailyRushDates?.[weekNumber]?.length ?? 0) > 0 ? 1 : 0;
  return Math.min(target, Math.max(participationFloor, advancedRefIds.size));
}

function reconcileDailyScaledTodoStates(cache: ExtendedProgressCache): ExtendedProgressCache {
  const todoStates = { ...cache.todoStates };
  for (const plan of getAllWeekPlans()) {
    for (const todo of plan.todos) {
      const prior = todoStates[todo.id];
      if (todo.kind === 'daily-rush') {
        const target = Math.max(prior?.target ?? 0, todo.target);
        const progress = dailyRushTodoProgress(cache.todoEventCounts, plan.weekNumber, target);
        todoStates[todo.id] = {
          todoId: todo.id,
          weekNumber: plan.weekNumber,
          progress,
          target,
          completedAt: progress >= target && target > 0 ? (prior?.completedAt ?? Date.now()) : undefined,
          skipped: prior?.skipped,
        };
      }
      if (todo.kind === 'flashcards') {
        const activities = Object.values(cache.todoEventCounts.dailyActivity ?? {})
          .filter(activity => activity.weekNumber === plan.weekNumber);
        if (activities.length === 0) continue;
        const pool = resolveCardPool(todo.pool, plan.weekNumber);
        const requestedTarget = todo.target > 0 ? todo.target : (prior?.target ?? pool.expectedTarget ?? 0);
        const target = pool.cardIds.length > 0 ? Math.min(requestedTarget, pool.cardIds.length) : requestedTarget;
        const perDayTarget = dailyTodoTarget('flashcards');
        const progress = Math.min(target, activities.reduce(
          (sum, activity) => sum + Math.min(new Set(activity.flashcardReviewIds ?? []).size, perDayTarget),
          0,
        ));
        todoStates[todo.id] = {
          todoId: todo.id,
          weekNumber: plan.weekNumber,
          progress,
          target,
          completedAt: progress >= target && target > 0 ? (prior?.completedAt ?? Date.now()) : undefined,
          skipped: prior?.skipped,
        };
      }
      if (todo.kind === 'kanji') {
        const resolution = resolveKanjiSet(todo.kanjiSet);
        const target = todo.target > 0 ? todo.target : (resolution.expectedTarget ?? 0);
        const allowedIds = new Set(resolution.cardIds);
        const progress = Math.min(
          target,
          (cache.todoEventCounts.kanjiGoodAnswers?.[plan.weekNumber] ?? [])
            .filter(id => allowedIds.has(id)).length,
        );
        todoStates[todo.id] = {
          todoId: todo.id,
          weekNumber: plan.weekNumber,
          progress,
          target,
          completedAt: progress >= target && target > 0 ? (prior?.completedAt ?? Date.now()) : undefined,
          skipped: prior?.skipped,
        };
      }
    }
  }
  return { ...cache, todoStates };
}

export function createPracticeProgressStore(repo: PersistentLearningRepository) {
  let extendedCache: ExtendedProgressCache = emptyExtendedProgressCache();
  let extendedRevision = 0;
  const extendedListeners = new Set<() => void>();
  function notifyExtendedChange(): void {
    extendedRevision += 1;
    for (const listener of extendedListeners) listener();
  }
  // Phase 37g — eager disk-hydration. The factory stays synchronous; the
  // hydration promise is shared so all mutating methods and external awaiters
  // see the same in-flight read. Mutations `await ensureHydrated()` so they
  // always start from the freshest on-disk state.
  let hydrationPromise: Promise<void> | null = null;
  function ensureHydrated(): Promise<void> {
    if (!hydrationPromise) {
      hydrationPromise = (async () => {
        try {
          const persisted = await repo.getProgress();
          const extended = persisted as unknown as Partial<ExtendedProgressCache> | null;
          if (extended && typeof extended === 'object') {
            extendedCache = reconcileDailyScaledTodoStates({
              todoStates: extended.todoStates ?? {},
              weekTodosInitialized: extended.weekTodosInitialized ?? {},
              todoEventCounts: extended.todoEventCounts ?? defaultEmptyEventCounts(),
            });
            notifyExtendedChange();
          }
        } catch (err) {
          if (__DEV__) console.warn('[practiceProgressStore] failed to hydrate extended cache from disk', err);
        }
      })();
    }
    return hydrationPromise;
  }
  // Fire-and-forget so the factory stays synchronous.
  void ensureHydrated();

  // Daily Rush records card reviews without blocking the answer animation.
  // Serialize those writes with the final Rush-completion write so an older
  // card snapshot can never land afterward and erase dailyRushDates/todoState.
  let mutationTail = Promise.resolve();
  async function acquireMutationLock(): Promise<() => void> {
    const previous = mutationTail;
    let release!: () => void;
    mutationTail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    return release;
  }

  function seedWeekSnapshot(
    weekNumber: number,
    weekPlan: ReturnType<typeof getWeekPlan>,
    extended: TodoPayload,
  ): { seed: Record<string, TodoState>; weekTodosInitialized: Record<number, boolean> } {
    const seed: Record<string, TodoState> = {
      ...extendedCache.todoStates,
      ...((extended.todoStates ?? {}) as Record<string, TodoState>),
    };
    const weekTodosInitialized = {
      ...extendedCache.weekTodosInitialized,
      ...(extended.weekTodosInitialized ?? {}),
    };
    if (weekPlan && !weekTodosInitialized[weekNumber]) {
      for (const todo of weekPlan.todos) {
        if (!seed[todo.id]) {
          seed[todo.id] = {
            todoId: todo.id,
            weekNumber,
            progress: 0,
            target: resolvedInitialTarget(todo, weekNumber),
          };
        }
      }
    }
    return { seed, weekTodosInitialized };
  }

  return {
    async completeCurrentLesson(lessonId: string, score: number, date: string) {
      const releaseMutation = await acquireMutationLock();
      try {
      await ensureHydrated();
      await repo.saveCompletedLesson(lessonId, score, date);
      // Daily lesson completion is date-scoped and must not depend on a
      // weekly plan existing for the lesson's course week.
      if (todoFeatureEnabled) {
        const updatedForDaily = await repo.getProgress();
        const extendedForDaily = updatedForDaily as unknown as TodoPayload;
        const lessonWeekForDaily = courseLessonById(lessonId)?.week;
        const persistedEvents = extendedForDaily.todoEventCounts;
        const priorActivity = persistedEvents?.dailyActivity?.[date]
          ?? extendedCache.todoEventCounts.dailyActivity?.[date]
          ?? {};
        const nextDailyEvents: TodoEventCounts = {
          ...defaultEmptyEventCounts(),
          ...extendedCache.todoEventCounts,
          ...(persistedEvents ?? {}),
          flashcardReviews: {
            ...(extendedCache.todoEventCounts.flashcardReviews ?? {}),
            ...(persistedEvents?.flashcardReviews ?? {}),
          },
          quizAttempts: {
            ...(extendedCache.todoEventCounts.quizAttempts ?? {}),
            ...(persistedEvents?.quizAttempts ?? {}),
          },
          dailyRushDates: {
            ...(extendedCache.todoEventCounts.dailyRushDates ?? {}),
            ...(persistedEvents?.dailyRushDates ?? {}),
          },
          exampleSentencesViewed: {
            ...(extendedCache.todoEventCounts.exampleSentencesViewed ?? {}),
            ...(persistedEvents?.exampleSentencesViewed ?? {}),
          },
          kanjiGoodAnswers: {
            ...(extendedCache.todoEventCounts.kanjiGoodAnswers ?? {}),
            ...(persistedEvents?.kanjiGoodAnswers ?? {}),
          },
          seenStageAdvancedRefIds: {
            ...(extendedCache.todoEventCounts.seenStageAdvancedRefIds ?? {}),
            ...(persistedEvents?.seenStageAdvancedRefIds ?? {}),
          },
          dailyActivity: {
            ...(extendedCache.todoEventCounts.dailyActivity ?? {}),
            ...(persistedEvents?.dailyActivity ?? {}),
            [date]: {
              ...priorActivity,
              weekNumber: lessonWeekForDaily ?? priorActivity.weekNumber,
              lessonIds: Array.from(new Set([...(priorActivity.lessonIds ?? []), lessonId])),
            },
          },
        };
        const dailyTodoStates = {
          ...extendedCache.todoStates,
          ...((extendedForDaily.todoStates ?? {}) as Record<string, TodoState>),
        };
        const dailyWeekInitialized = {
          ...extendedCache.weekTodosInitialized,
          ...(extendedForDaily.weekTodosInitialized ?? {}),
        };
        extendedCache = {
          todoStates: dailyTodoStates,
          weekTodosInitialized: dailyWeekInitialized,
          todoEventCounts: nextDailyEvents,
        };
        notifyExtendedChange();
        if (typeof repo.saveExtendedProgress === 'function') {
          await repo.saveExtendedProgress({
            ...updatedForDaily,
            todoStates: dailyTodoStates,
            weekTodosInitialized: dailyWeekInitialized,
            todoEventCounts: nextDailyEvents as unknown as Record<string, unknown>,
          } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
        }
      }
      // Phase 37b: when the todo gate is enabled and a WeekPlan exists for
      // the lesson's week, recompute todo states from the now-updated
      // completedLessonIds list. Idempotent: calling twice converges to the
      // same state. The recomputed snapshot is flushed to disk via
      // repo.saveExtendedProgress so it survives a cold start (otherwise the
      // gate UI in 37c would read stale state after every app reload).
      if (todoFeatureEnabled) {
        const lessonWeek = courseLessonById(lessonId)?.week;
        if (lessonWeek != null) {
          const weekPlan = getWeekPlan(lessonWeek, todoTrackForLesson(lessonId));
          if (weekPlan && weekPlan.todos.length > 0) {
            const updated = await repo.getProgress();
            const extended = updated as unknown as TodoPayload;
            // The web repository intentionally has no extended-progress
            // persistence method. Merge its canonical row with the live
            // cache so completing a lesson cannot erase Daily Rush/card
            // activity already recorded in this session.
            const existing = {
              ...extendedCache.todoStates,
              ...((extended.todoStates ?? {}) as Record<string, TodoState>),
            };
            const persistedEvents = extended.todoEventCounts;
            const mergedEvents: TodoEventCounts = {
              ...defaultEmptyEventCounts(),
              ...extendedCache.todoEventCounts,
              ...(persistedEvents ?? {}),
              flashcardReviews: {
                ...(extendedCache.todoEventCounts.flashcardReviews ?? {}),
                ...(persistedEvents?.flashcardReviews ?? {}),
              },
              quizAttempts: {
                ...(extendedCache.todoEventCounts.quizAttempts ?? {}),
                ...(persistedEvents?.quizAttempts ?? {}),
              },
              dailyRushDates: {
                ...(extendedCache.todoEventCounts.dailyRushDates ?? {}),
                ...(persistedEvents?.dailyRushDates ?? {}),
              },
              exampleSentencesViewed: {
                ...(extendedCache.todoEventCounts.exampleSentencesViewed ?? {}),
                ...(persistedEvents?.exampleSentencesViewed ?? {}),
              },
              kanjiGoodAnswers: {
                ...(extendedCache.todoEventCounts.kanjiGoodAnswers ?? {}),
                ...(persistedEvents?.kanjiGoodAnswers ?? {}),
              },
              seenStageAdvancedRefIds: {
                ...(extendedCache.todoEventCounts.seenStageAdvancedRefIds ?? {}),
                ...(persistedEvents?.seenStageAdvancedRefIds ?? {}),
              },
              dailyActivity: {
                ...(extendedCache.todoEventCounts.dailyActivity ?? {}),
                ...(persistedEvents?.dailyActivity ?? {}),
              },
            };
            const seed: Record<string, TodoState> = { ...existing };
            const weekTodosInitialized = {
              ...extendedCache.weekTodosInitialized,
              ...(extended.weekTodosInitialized ?? {}),
            };
            if (!weekTodosInitialized[lessonWeek]) {
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
              weekTodosInitialized: { ...weekTodosInitialized, [lessonWeek]: true },
              todoEventCounts: {
                ...mergedEvents,
                dailyActivity: {
                  ...(mergedEvents.dailyActivity ?? {}),
                  [date]: {
                    ...(mergedEvents.dailyActivity?.[date] ?? {}),
                    weekNumber: lessonWeek,
                    lessonIds: Array.from(new Set([
                      ...(mergedEvents.dailyActivity?.[date]?.lessonIds ?? []),
                      lessonId,
                    ])),
                  },
                },
              },
              completedLessonIds: updated.completedLessonIds,
            };
            const recomputed = recomputeTodoStatesForWeek(lessonWeek, weekPlan, payload);
            const nextTodoStates = { ...seed, ...recomputed };
            // Always mirror the freshly-computed slice into the in-memory
            // cache so screens that read extended progress through this
            // store (LessonsScreen, HomeScreen) see the live todoStates
            // immediately. The persistence side effect is best-effort and
            // only runs when the underlying repo supports it — the in-memory
            // repo used on web deliberately omits saveExtendedProgress.
            extendedCache = {
              todoStates: nextTodoStates,
              weekTodosInitialized: payload.weekTodosInitialized,
              todoEventCounts: payload.todoEventCounts,
            };
            notifyExtendedChange();
            // Phase 46 — if the recomputed board is all-done for the current
            // week, stamp a WeeklyReviewCompletion. Pure helper, idempotent
            // on the ISO-week key, no persistence side effects here. The
            // N3 badge predicate in profileProgressionService reads the
            // counter this call populates.
            const augmented = maybeRecordWeeklyReviewCompletion(
              updated,
              lessonWeek,
              weekPlan,
              nextTodoStates,
              true,
              'lesson_completion',
              new Date(),
            );
            // Cast through unknown so the two slightly-different TodoEventCounts
            // shapes (one keyed by string index in the repo's ExtendedLearnerProgress
            // view, one with named keys here) can converge for the persistence call.
            if (typeof repo.saveExtendedProgress === 'function') {
              await repo.saveExtendedProgress({
                ...augmented,
                todoStates: nextTodoStates,
                weekTodosInitialized: payload.weekTodosInitialized,
                todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
              } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
            }
          }
        }
      }
      } finally {
        releaseMutation();
      }
    },
    async getDashboard() {
      await ensureHydrated();
      const dashboard = buildProgressDashboard(await repo.getProgress(), await getLessonCatalog(repo));
      const activityStreak = calculateStudyStreak(extendedCache.todoEventCounts.dailyActivity);
      if (activityStreak.longestStreak === 0) return dashboard;
      return {
        ...dashboard,
        currentStreak: activityStreak.currentStreak,
        longestStreak: Math.max(dashboard.longestStreak, activityStreak.longestStreak),
      };
    },
    /**
     * Phase 37b — return the in-memory extended-progress slice so screens
     * that gate UI on todo state (LessonsScreen, HomeScreen) can render the
     * real per-todo counts without falling back to the persisted
     * saveExtendedProgress path. The cache is updated by completeCurrentLesson
     * and the record* methods. Phase 37g adds eager hydration from disk on
     * store construction so the cache reflects persisted state on app cold
     * start; callers can await `ready()` to wait for hydration to finish.
     */
    getExtendedProgress(): ExtendedProgressCache {
      return extendedCache;
    },
    getExtendedProgressRevision(): number {
      return extendedRevision;
    },
    subscribeExtendedProgress(listener: () => void): () => void {
      extendedListeners.add(listener);
      return () => extendedListeners.delete(listener);
    },
    /**
     * Phase 37g — await the disk-hydration of the extended cache. Screens
     * that need to read fresh extended state on cold start can await this
     * in a useEffect before rendering the gate. Idempotent — calling twice
     * resolves on the same promise.
     */
    async ready(): Promise<void> {
      await ensureHydrated();
    },
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
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        if (!todoFeatureEnabled) return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);

      // De-duped append of the date into dailyRushDates[weekNumber]. We never
      // mutate the existing array — we spread into a fresh one to keep the
      // recompute input immutable across concurrent calls.
      const priorDates = baseEvents.dailyRushDates?.[weekNumber] ?? [];
      const nextDates = priorDates.includes(date) ? priorDates : [...priorDates, date];
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        dailyRushDates: {
          ...(baseEvents.dailyRushDates ?? {}),
          [weekNumber]: nextDates,
        },
        dailyActivity: {
          ...(baseEvents.dailyActivity ?? {}),
          [date]: {
            ...(baseEvents.dailyActivity?.[date] ?? {}),
            weekNumber,
            dailyRushCompleted: true,
          },
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      // For `daily-rush` todos we compute the count directly from the updated
      // dailyRushDates list (recomputeTodoStatesForWeek is lesson-only in 37b;
      // 37d-1 owns the daily-rush progress rule per proposal §5).
      const { seed, weekTodosInitialized } = seedWeekSnapshot(weekNumber, weekPlan, extended);
      if (weekPlan) {
        for (const todo of weekPlan.todos) {
          if (todo.kind !== 'daily-rush') continue;
          const prior = seed[todo.id];
          const target = Math.max(prior?.target ?? 0, todo.target);
          // Phase 51 Q6d — weight the daily-rush weekly todo by
          // `seen` → `memorized` / `seen` → `recognized` transitions,
          // NOT raw Daily Rush completions. Cumulative dedup of
          // refIds across ALL weeks in the seenStageAdvancedRefIds log
          // so a learner with prior Daily Rush work (e.g. 50 cards
          // already in 'memorized' state) shows non-zero progress
          // even if no new transitions happened this week. The
          // date-presence floor (1 when any date in
          // dailyRushDates[weekNumber]) keeps the Phase 37d-1
          // "showed up today" semantic alive as a backstop for users
          // with no prior transitions yet.
          const progress = dailyRushTodoProgress(nextEventCounts, weekNumber, target);
          seed[todo.id] = {
            todoId: todo.id,
            weekNumber,
            progress,
            target,
            completedAt: progress >= target && target > 0 ? (prior?.completedAt ?? Date.now()) : undefined,
            skipped: prior?.skipped,
          };
        }
      }

      const payload: TodoPayload = {
        todoStates: seed,
        weekTodosInitialized: { ...weekTodosInitialized, [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      const recomputed = weekPlan
        ? recomputeTodoStatesForWeek(weekNumber, weekPlan, payload)
        : {};
      const nextTodoStates = { ...seed, ...recomputed };

      // Mirror the freshly-computed slice into the in-memory cache first so
      // the UI sees the updated todoStates even when the underlying repo is
      // the in-memory one used on web (no saveExtendedProgress).
      extendedCache = {
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts,
      };
      notifyExtendedChange();

      // Phase 46 — weekly-review stamp gate. If the day's daily-rush pushed
      // the weekly board to all-done, append a WeeklyReviewCompletion stamp.
      const augmented = maybeRecordWeeklyReviewCompletion(
        updated,
        weekNumber,
        weekPlan,
        nextTodoStates,
        Boolean(payload.weekTodosInitialized[weekNumber]),
        'lesson_completion',
        new Date(),
      );

      // Cast through unknown — same pattern completeCurrentLesson uses (37b).
      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...augmented,
          todoStates: nextTodoStates,
          weekTodosInitialized: payload.weekTodosInitialized,
          todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }

        return repo.getProgress();
      } finally {
        releaseMutation();
      }
    },
    /**
     * Phase 51 (Q6d) — record that a Daily Rush answer advanced a card's
     * stage from `seen` to `memorized` or `seen` to `recognized`.
     * Appends `refId` to
     * `todoEventCounts.seenStageAdvancedRefIds[weekNumber]` (de-duplicated
     * so a card that flips back and forth doesn't bloat the log) and
     * recomputes the `daily-rush` todos for the week so the Q6d weighting
     * is reflected in the gate UI.
     *
     * Beru Q6d rationale: the daily-rush weekly todo must weight
     * `stageAdvanced` (seen→memorized / seen→recognized) transitions,
     * NOT raw Daily Rush completions. A learner with 50 memorized + 5
     * seen cards should not see "Daily Rush: 0/5" as low-progress.
     * (See Gate 7e Q6d grep in the Tusk QC prompt.)
     *
     * The actual todo progress is computed by `recordDailyRushComplete`:
     * it sums the deduped refIds across ALL weeks
     * (cumulativeSeenToMemorized) and clamps at `target`, with a
     * date-presence floor of 1 to preserve the Phase 37d-1 "showed up
     * today" semantic. This means callers do NOT need to call
     * `recordDailyRushComplete` from the same answer handler — the
     * recompute fires when the next daily-rush date lands (or on the
     * next read of the extended progress).
     *
     * `toStage` of `'seen'` is a no-op (it represents a regression or a
     * session-cap revert, not a forward transition). All other values
     * (`'recognized' | 'memorized'`) are recorded.
     *
     * No-op while todoFeatureEnabled is false (matches the
     * recordDailyRushComplete / recordFlashcardReview pattern).
     */
    async recordCardStageAdvanced(weekNumber: number, refId: string, toStage: 'seen' | 'recognized' | 'memorized') {
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        if (!todoFeatureEnabled) return repo.getProgress();
        if (toStage === 'seen') return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;

      // De-duped append of refId into seenStageAdvancedRefIds[weekNumber].
      // Forward transitions only — 'seen' is filtered above.
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
      const priorAdvanced = baseEvents.seenStageAdvancedRefIds?.[weekNumber] ?? [];
      const nextAdvanced = priorAdvanced.includes(refId)
        ? priorAdvanced
        : [...priorAdvanced, refId];
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        seenStageAdvancedRefIds: {
          ...(baseEvents.seenStageAdvancedRefIds ?? {}),
          [weekNumber]: nextAdvanced,
        },
      };

      // Recompute the week's daily-rush todos so the Q6d weight is
      // reflected immediately. Mirrors the recordFlashcardReview pattern
      // — we build a payload from the current extendedCache, run the
      // recompute, and persist the snapshot.
      const weekPlan = getWeekPlan(weekNumber);
      const { seed, weekTodosInitialized } = seedWeekSnapshot(weekNumber, weekPlan, extended);
      // Apply the same Q6d daily-rush weighting rule so the recompute
      // here matches the one in recordDailyRushComplete.
      if (weekPlan) {
        for (const todo of weekPlan.todos) {
          if (todo.kind !== 'daily-rush') continue;
          const prior = seed[todo.id];
          const target = Math.max(prior?.target ?? 0, todo.target);
          const progress = dailyRushTodoProgress(nextEventCounts, weekNumber, target);
          seed[todo.id] = {
            todoId: todo.id,
            weekNumber,
            progress,
            target,
            completedAt: progress >= target && target > 0 ? (prior?.completedAt ?? Date.now()) : undefined,
            skipped: prior?.skipped,
          };
        }
      }
      const payload: TodoPayload = {
        todoStates: seed,
        weekTodosInitialized: { ...weekTodosInitialized, [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };
      const recomputed = weekPlan
        ? recomputeTodoStatesForWeek(weekNumber, weekPlan, payload)
        : {};
      const nextTodoStates = { ...seed, ...recomputed };

      extendedCache = {
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts,
      };
      notifyExtendedChange();

      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...updated,
          todoStates: nextTodoStates,
          weekTodosInitialized: payload.weekTodosInitialized,
          todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }

        return repo.getProgress();
      } finally {
        releaseMutation();
      }
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
    async recordFlashcardReview(weekNumber: number, cardId: string, date = localDateKey()) {
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        if (!todoFeatureEnabled) return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);

      // De-duped append of cardId into flashcardReviews[weekNumber].
      const priorReviewed = baseEvents.flashcardReviews?.[weekNumber] ?? [];
      const nextReviewed = priorReviewed.includes(cardId)
        ? priorReviewed
        : [...priorReviewed, cardId];
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        flashcardReviews: {
          ...(baseEvents.flashcardReviews ?? {}),
          [weekNumber]: nextReviewed,
        },
        dailyActivity: {
          ...(baseEvents.dailyActivity ?? {}),
          [date]: {
            ...(baseEvents.dailyActivity?.[date] ?? {}),
            weekNumber,
            flashcardReviewIds: Array.from(new Set([
              ...(baseEvents.dailyActivity?.[date]?.flashcardReviewIds ?? []),
              cardId,
            ])),
          },
        },
      };

      if (!weekPlan) {
        const nextTodoStates = {
          ...extendedCache.todoStates,
          ...((extended.todoStates ?? {}) as Record<string, TodoState>),
        };
        const nextWeekInitialized = {
          ...extendedCache.weekTodosInitialized,
          ...(extended.weekTodosInitialized ?? {}),
        };
        extendedCache = {
          todoStates: nextTodoStates,
          weekTodosInitialized: nextWeekInitialized,
          todoEventCounts: nextEventCounts,
        };
        notifyExtendedChange();
        if (typeof repo.saveExtendedProgress === 'function') {
          await repo.saveExtendedProgress({
            ...updated,
            todoStates: nextTodoStates,
            weekTodosInitialized: nextWeekInitialized,
            todoEventCounts: nextEventCounts as unknown as Record<string, unknown>,
          } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
        }
        return repo.getProgress();
      }

      // Seed any todo states that haven't been materialized yet for this week.
      const { seed, weekTodosInitialized } = seedWeekSnapshot(weekNumber, weekPlan, extended);

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
        const dailyCardTarget = dailyTodoTarget('flashcards');
        const weekActivities = Object.values(nextEventCounts.dailyActivity ?? {})
          .filter(activity => activity.weekNumber === weekNumber);
        const progressCount = weekActivities.length > 0
          ? weekActivities.reduce((sum, activity) => {
              // The weekly requirement is the sum of the daily five-review
              // goals. Daily Rush draws from the full adaptive pool, so
              // restricting this count to Week 1 card ids incorrectly turns
              // a completed 5/5 daily goal into only 1/35 weekly progress.
              const reviewedToday = new Set(activity.flashcardReviewIds ?? []).size;
              return sum + Math.min(reviewedToday, dailyCardTarget);
            }, 0)
          : reviewedInPool.length;
        const prior = seed[todo.id];
        const requestedTarget = flashcardTodo.target > 0
          ? flashcardTodo.target
          : (prior?.target && prior.target > 0 ? prior.target : (pool.expectedTarget ?? flashcardTodo.target));
        const target = pool.cardIds.length > 0
          ? Math.min(requestedTarget, pool.cardIds.length)
          : requestedTarget;
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
        weekTodosInitialized: { ...weekTodosInitialized, [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Mirror the freshly-computed slice into the in-memory cache first so
      // the UI sees the updated todoStates even when the underlying repo is
      // the in-memory one used on web (no saveExtendedProgress).
      extendedCache = {
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts,
      };
      notifyExtendedChange();

      // Phase 46 — weekly-review stamp gate.
      const augmented = maybeRecordWeeklyReviewCompletion(
        updated,
        weekNumber,
        weekPlan,
        nextTodoStates,
        Boolean(payload.weekTodosInitialized[weekNumber]),
        'lesson_completion',
        new Date(),
      );

      // Cast through unknown — same pattern recordDailyRushComplete uses (37d-1).
      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...augmented,
          todoStates: nextTodoStates,
          weekTodosInitialized: payload.weekTodosInitialized,
          todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }

        return repo.getProgress();
      } finally {
        releaseMutation();
      }
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
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        if (!todoFeatureEnabled) return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      if (!weekPlan) return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;

      // De-duped append of kanjiCardId into kanjiGoodAnswers[weekNumber].
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
      const priorGood = baseEvents.kanjiGoodAnswers?.[weekNumber] ?? [];
      const nextGood = priorGood.includes(kanjiCardId)
        ? priorGood
        : [...priorGood, kanjiCardId];
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        kanjiGoodAnswers: {
          ...(baseEvents.kanjiGoodAnswers ?? {}),
          [weekNumber]: nextGood,
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      const { seed, weekTodosInitialized } = seedWeekSnapshot(weekNumber, weekPlan, extended);

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
        weekTodosInitialized: { ...weekTodosInitialized, [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Mirror the freshly-computed slice into the in-memory cache first so
      // the UI sees the updated todoStates even when the underlying repo is
      // the in-memory one used on web (no saveExtendedProgress).
      extendedCache = {
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts,
      };
      notifyExtendedChange();

      // Phase 46 — weekly-review stamp gate.
      const augmented = maybeRecordWeeklyReviewCompletion(
        updated,
        weekNumber,
        weekPlan,
        nextTodoStates,
        Boolean(payload.weekTodosInitialized[weekNumber]),
        'lesson_completion',
        new Date(),
      );

      // Cast through unknown — same pattern recordFlashcardReview uses (37d-2).
      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...augmented,
          todoStates: nextTodoStates,
          weekTodosInitialized: payload.weekTodosInitialized,
          todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }

        return repo.getProgress();
      } finally {
        releaseMutation();
      }
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
    /** Persist a quiz result even when weekly todo gating is disabled. */
    async recordQuizHistory(entry: QuizHistoryEntry) {
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        const updated = await repo.getProgress();
        const extended = updated as unknown as TodoPayload;
        const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
        const nextEventCounts: TodoEventCounts = {
          ...baseEvents,
          quizHistory: mergeQuizHistory(baseEvents.quizHistory, [entry]),
        };
        const nextTodoStates = {
          ...extendedCache.todoStates,
          ...((extended.todoStates ?? {}) as Record<string, TodoState>),
        };
        const nextWeekInitialized = {
          ...extendedCache.weekTodosInitialized,
          ...(extended.weekTodosInitialized ?? {}),
        };
        extendedCache = {
          todoStates: nextTodoStates,
          weekTodosInitialized: nextWeekInitialized,
          todoEventCounts: nextEventCounts,
        };
        notifyExtendedChange();
        if (typeof repo.saveExtendedProgress === 'function') {
          await repo.saveExtendedProgress({
            ...updated,
            todoStates: nextTodoStates,
            weekTodosInitialized: nextWeekInitialized,
            todoEventCounts: nextEventCounts as unknown as Record<string, unknown>,
          } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
        }
        return entry;
      } finally {
        releaseMutation();
      }
    },
    async recordQuizAttempt(weekNumber: number, score: number) {
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        if (!todoFeatureEnabled) return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      if (!weekPlan) return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;

      // Best-score semantics: todoEventCounts.quizAttempts[weekNumber] is
      // the maximum of the prior score and the new attempt. §5 row 'quiz':
      // "Best score across attempts wins".
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
      const priorBest = baseEvents.quizAttempts?.[weekNumber] ?? 0;
      const nextBest = Math.max(priorBest, score);
      const date = localDateKey();
      const todayActivity = baseEvents.dailyActivity?.[date] ?? {};
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        quizAttempts: {
          ...(baseEvents.quizAttempts ?? {}),
          [weekNumber]: nextBest,
        },
        dailyActivity: {
          ...(baseEvents.dailyActivity ?? {}),
          [date]: {
            ...todayActivity,
            weekNumber,
            quizCompleted: true,
            quizBestScore: Math.max(todayActivity.quizBestScore ?? 0, score),
          },
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      const { seed, weekTodosInitialized } = seedWeekSnapshot(weekNumber, weekPlan, extended);

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
        weekTodosInitialized: { ...weekTodosInitialized, [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Mirror the freshly-computed slice into the in-memory cache first so
      // the UI sees the updated todoStates even when the underlying repo is
      // the in-memory one used on web (no saveExtendedProgress).
      extendedCache = {
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts,
      };
      notifyExtendedChange();

      // Phase 46 — weekly-review stamp gate.
      const augmented = maybeRecordWeeklyReviewCompletion(
        updated,
        weekNumber,
        weekPlan,
        nextTodoStates,
        Boolean(payload.weekTodosInitialized[weekNumber]),
        'lesson_completion',
        new Date(),
      );

      // Cast through unknown — same pattern recordKanjiGood uses (37d-3).
      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...augmented,
          todoStates: nextTodoStates,
          weekTodosInitialized: payload.weekTodosInitialized,
          todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }

        return repo.getProgress();
      } finally {
        releaseMutation();
      }
    },
    /** Persist a date-scoped Sentence Lab review signal for Adaptive Daily Plan 2.0. */
    async recordSentenceLabReview(
      sentenceId: string,
      date = localDateKey(),
      placementLevel?: PlacementLevel | null,
    ) {
      const releaseMutation = await acquireMutationLock();
      try {
      await ensureHydrated();
      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;
      const weekNumber = resolveActivePhraseWeek(updated, placementLevel);
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
      const priorActivity = baseEvents.dailyActivity?.[date] ?? {};
      const sentenceLabReviewIds = Array.from(new Set([...(priorActivity.sentenceLabReviewIds ?? []), sentenceId]));
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        dailyActivity: {
          ...(baseEvents.dailyActivity ?? {}),
          [date]: { ...priorActivity, weekNumber, sentenceLabReviewIds },
        },
      };
      extendedCache = {
        todoStates: { ...extendedCache.todoStates, ...(extended.todoStates ?? {}) },
        weekTodosInitialized: { ...extendedCache.weekTodosInitialized, ...(extended.weekTodosInitialized ?? {}) },
        todoEventCounts: nextEventCounts,
      };
      notifyExtendedChange();
      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...updated,
          todoStates: extendedCache.todoStates,
          weekTodosInitialized: extendedCache.weekTodosInitialized,
          todoEventCounts: nextEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }
        return repo.getProgress();
      } finally {
        releaseMutation();
      }
    },
    /**
     * Phase 37d-5 — record that an example sentence was viewed on screen
     * for `weekNumber`. Appends `sentenceId` to
     * `todoEventCounts.exampleSentencesViewed[weekNumber]` (de-duplicated
     * so re-rendering the same sentence does not bloat the log) and
     * recomputes the `example-sentences`-kind todos for the week,
     * persisting via saveExtendedProgress so the gate UI in 37c reads
     * fresh state after a cold start.
     *
     * Per docs/phase-37-todo-gated-progression-proposal.md §5 row
     * `example-sentences`: progress = |distinct sentenceIds in
     * todoEventCounts.exampleSentencesViewed[weekNumber] ∩ week's
     * example set|, clamped at target. §11.2 default target is 5
     * sentences viewed per week (placeholder, tunable per week in
     * weeklyPlans.ts).
     *
     * Source is the ExampleSentencesScreen view-tracking effect, which
     * debounces per-sentence so flurries (filter changes, scrolling
     * re-renders) do not spam the store. The screen-side guard is the
     * primary throttle; the de-dup + intersection here is the
     * correctness belt-and-suspenders.
     *
     * No-op while todoFeatureEnabled is false (matches the
     * recordQuizAttempt / recordKanjiGood / recordFlashcardReview /
     * recordDailyRushComplete / completeCurrentLesson pattern) so the
     * gate stays invisible until 37g flips the flag. Returns the
     * persisted LearnerProgress (mirrors the §5.1 contract).
     */
    async markExampleViewed(weekNumber: number, sentenceId: string) {
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        if (!todoFeatureEnabled) return repo.getProgress();

      const weekPlan = getWeekPlan(weekNumber);
      if (!weekPlan) return repo.getProgress();

      const updated = await repo.getProgress();
      const extended = updated as unknown as TodoPayload;

      // De-duped append of sentenceId into exampleSentencesViewed[weekNumber].
      const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
      const priorViewed = baseEvents.exampleSentencesViewed?.[weekNumber] ?? [];
      const nextViewed = priorViewed.includes(sentenceId)
        ? priorViewed
        : [...priorViewed, sentenceId];
      const nextEventCounts: TodoEventCounts = {
        ...baseEvents,
        exampleSentencesViewed: {
          ...(baseEvents.exampleSentencesViewed ?? {}),
          [weekNumber]: nextViewed,
        },
      };

      // Seed any todo states that haven't been materialized yet for this week.
      const { seed, weekTodosInitialized } = seedWeekSnapshot(weekNumber, weekPlan, extended);

      // Compute per-example-sentences-todo progress from the updated event
      // log. Per §5 row `example-sentences`: count = |distinct sentenceIds
      // viewed|. Per §11.2 default: target = 5 sentences viewed (the author
      // can override via todo.target). We do not intersect against an
      // explicit week's "example set" array here — the weeklyPlans author
      // owns the target. The store trusts the caller's sentenceId (the
      // screen renders only sentences from the curated pack).
      for (const todo of weekPlan.todos) {
        if (todo.kind !== 'example-sentences') continue;
        const prior = seed[todo.id];
        const target = prior?.target && prior.target > 0
          ? prior.target
          : todo.target;
        const progressCount = nextViewed.length;
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
        weekTodosInitialized: { ...weekTodosInitialized, [weekNumber]: true },
        todoEventCounts: nextEventCounts,
        completedLessonIds: updated.completedLessonIds,
      };

      // recomputeTodoStatesForWeek preserves prior progress for non-lesson
      // kinds, so the manual updates we just wrote to seed survive untouched.
      const recomputed = recomputeTodoStatesForWeek(weekNumber, weekPlan, payload);
      const nextTodoStates = { ...seed, ...recomputed };

      // Mirror the freshly-computed slice into the in-memory cache first so
      // the UI sees the updated todoStates even when the underlying repo is
      // the in-memory one used on web (no saveExtendedProgress).
      extendedCache = {
        todoStates: nextTodoStates,
        weekTodosInitialized: payload.weekTodosInitialized,
        todoEventCounts: payload.todoEventCounts,
      };
      notifyExtendedChange();

      // Phase 46 — weekly-review stamp gate.
      const augmented = maybeRecordWeeklyReviewCompletion(
        updated,
        weekNumber,
        weekPlan,
        nextTodoStates,
        Boolean(payload.weekTodosInitialized[weekNumber]),
        'lesson_completion',
        new Date(),
      );

      // Cast through unknown — same pattern recordQuizAttempt uses (37d-4).
      if (typeof repo.saveExtendedProgress === 'function') {
        await repo.saveExtendedProgress({
          ...augmented,
          todoStates: nextTodoStates,
          weekTodosInitialized: payload.weekTodosInitialized,
          todoEventCounts: payload.todoEventCounts as unknown as Record<string, unknown>,
        } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
      }

      return repo.getProgress();
      } finally {
        releaseMutation();
      }
    },
    /**
     * Phase 30 — expose the raw learner progress so screens (e.g. the
     * Lessons screen) can show weekly progress ("3 of 5 done this week")
     * without rebuilding the full dashboard summary on every render.
     */
    /** Append one normalized, bounded mastery outcome without disturbing todos. */
    async recordMasteryEvidence(input: Omit<MasteryEvidence, 'id' | 'occurredAt'> & Partial<Pick<MasteryEvidence, 'id' | 'occurredAt'>>) {
      const release = await acquireMutationLock();
      try {
        await ensureHydrated();
        const updated = await repo.getProgress();
        const extended = updated as unknown as TodoPayload;
        const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
        const occurredAt = input.occurredAt ?? new Date().toISOString();
        const priorEvidence = baseEvents.masteryEvidence ?? [];
        const entry: MasteryEvidence = {
          id: input.id ?? `${occurredAt}:${input.source}:${input.modality}:${input.refId}:${priorEvidence.length}`,
          refId: input.refId,
          modality: input.modality,
          score: Math.min(1, Math.max(0, input.score)),
          source: input.source,
          occurredAt,
        };
        const nextEventCounts: TodoEventCounts = {
          ...baseEvents,
          masteryEvidence: [...priorEvidence.filter(item => item.id !== entry.id), entry].slice(-5000),
        };
        extendedCache = {
          ...extendedCache,
          todoStates: { ...extendedCache.todoStates, ...(extended.todoStates ?? {}) },
          weekTodosInitialized: { ...extendedCache.weekTodosInitialized, ...(extended.weekTodosInitialized ?? {}) },
          todoEventCounts: nextEventCounts,
        };
        notifyExtendedChange();
        if (typeof repo.saveExtendedProgress === 'function') {
          await repo.saveExtendedProgress({
            ...updated,
            todoStates: extendedCache.todoStates,
            weekTodosInitialized: extendedCache.weekTodosInitialized,
            todoEventCounts: nextEventCounts as unknown as Record<string, unknown>,
          } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
        }
        return entry;
      } finally {
        release();
      }
    },
    /** Persist or replace one compact daily snapshot, keeping sixty days. */
    async recordMasterySnapshot(snapshot: MasterySnapshot) {
      const release = await acquireMutationLock();
      try {
        await ensureHydrated();
        const updated = await repo.getProgress();
        const extended = updated as unknown as TodoPayload;
        const baseEvents = mergeTodoEventCounts(extendedCache.todoEventCounts, extended.todoEventCounts);
        const priorSnapshots = baseEvents.masterySnapshots ?? [];
        const masterySnapshots = [...priorSnapshots.filter(item => item.date !== snapshot.date), snapshot]
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-60);
        const nextEventCounts: TodoEventCounts = {
          ...baseEvents,
          masterySnapshots,
        };
        extendedCache = {
          ...extendedCache,
          todoStates: { ...extendedCache.todoStates, ...(extended.todoStates ?? {}) },
          weekTodosInitialized: { ...extendedCache.weekTodosInitialized, ...(extended.weekTodosInitialized ?? {}) },
          todoEventCounts: nextEventCounts,
        };
        notifyExtendedChange();
        if (typeof repo.saveExtendedProgress === 'function') {
          await repo.saveExtendedProgress({
            ...updated,
            todoStates: extendedCache.todoStates,
            weekTodosInitialized: extendedCache.weekTodosInitialized,
            todoEventCounts: nextEventCounts as unknown as Record<string, unknown>,
          } as unknown as Parameters<NonNullable<typeof repo.saveExtendedProgress>>[0]);
        }
        return snapshot;
      } finally {
        release();
      }
    },
    async getProgress() { return repo.getProgress(); },
    /** Wipe durable progress after every older mutation has finished. */
    async reset() {
      const releaseMutation = await acquireMutationLock();
      try {
        await ensureHydrated();
        await repo.deleteAllProgress();
        extendedCache = emptyExtendedProgressCache();
        hydrationPromise = null;
        notifyExtendedChange();
      } finally {
        releaseMutation();
      }
    },

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
