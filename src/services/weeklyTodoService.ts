// Phase 37b — Pure weekly-todo board builder.
// Per docs/phase-37-todo-gated-progression-proposal.md §4. The function is the
// progression gate that decides whether week N+1 is unlocked for the learner.
// It does NOT consult LessonInteractionPath — that path's previousWeekComplete
// describes lesson flow, not todo flow (proposal §4.1).
//
// Pure: no React, no async, no SQLite. Screens pass in the persisted
// state and a WeekPlan; the board renders from the result.
//
// IMPORTANT: TodoState and LearnerProgress use the ExtendedLearnerProgress
// cast pattern from src/repositories/sqliteLearningRepository.ts:33-37
// because src/types/progress.ts is widened in a later phase.

import type { LearnerProgress } from '../types/progress';
import type {
  TodoEventCounts,
  TodoState,
  WeekPlan,
  WeekTodo,
} from '../types/weeklyTodo';

/** Minimal extended shape so this service compiles without widening progress.ts. */
export interface TodoPayload {
  todoStates: Record<string, TodoState>;
  weekTodosInitialized: Record<number, boolean>;
  todoEventCounts: TodoEventCounts;
  completedLessonIds: string[];
}

export type TodoCtaRoute =
  | { screen: 'lessons'; params?: { weekNumber: number } }
  | { screen: 'lesson'; params?: { lessonId: string } }
  | { screen: 'flashcards'; params?: { weekNumber: number } }
  | { screen: 'daily-rush' }
  | { screen: 'quiz'; params?: { weekNumber: number } }
  | { screen: 'kanji'; params?: { weekNumber: number } }
  | { screen: 'example-sentences'; params?: { weekNumber: number } };

export interface WeeklyTodoStatus {
  todo: WeekTodo;
  progress: number;
  target: number;
  completed: boolean;
  skipped: boolean;
  ctaRoute: TodoCtaRoute;
  helperText: string;
}

export interface WeeklyTodoBoard {
  weekNumber: number;
  todos: WeeklyTodoStatus[];
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  canAdvance: boolean;
  /** True when weekTodosInitialized[weekNumber] is false → render as legacy. */
  isLegacyWeek: boolean;
}

function ctaRouteForTodo(weekNumber: number, todo: WeekTodo): TodoCtaRoute {
  switch (todo.kind) {
    case 'lesson': {
      const firstLesson = todo.lessonIds?.[0];
      return firstLesson
        ? { screen: 'lesson', params: { lessonId: firstLesson } }
        : { screen: 'lessons', params: { weekNumber } };
    }
    case 'flashcards':
      return { screen: 'flashcards', params: { weekNumber } };
    case 'daily-rush':
      return { screen: 'daily-rush' };
    case 'quiz':
      return { screen: 'quiz', params: { weekNumber } };
    case 'kanji':
      return { screen: 'kanji', params: { weekNumber } };
    case 'example-sentences':
      return { screen: 'example-sentences', params: { weekNumber } };
    default:
      return { screen: 'lessons', params: { weekNumber } };
  }
}

function helperTextForTodo(
  todo: WeekTodo,
  status: { progress: number; target: number; completed: boolean; isLegacyWeek: boolean },
): string {
  if (status.isLegacyWeek) return 'Completed before weekly todos were introduced';
  if (status.completed) return `Done — ${status.progress} / ${status.target} ${todo.unit ?? ''}`.trim();
  if (status.target === 0) return 'No requirements — open the lesson to mark this todo complete.';
  return `${status.progress} / ${status.target} ${todo.unit ?? ''}`.trim();
}

function statusForTodo(
  weekNumber: number,
  todo: WeekTodo,
  todoState: TodoState | undefined,
  isInitialized: boolean,
): WeeklyTodoStatus {
  const progress = todoState?.progress ?? 0;
  const target = todoState?.target ?? todo.target;
  const completed = isInitialized && progress >= target && target > 0;
  const isLegacyWeek = !isInitialized;
  return {
    todo,
    progress,
    target,
    completed,
    skipped: Boolean(todoState?.skipped) && completed,
    ctaRoute: ctaRouteForTodo(weekNumber, todo),
    helperText: helperTextForTodo(todo, { progress, target, completed, isLegacyWeek }),
  };
}

/**
 * Build a board for a single week given its plan + persisted todo state.
 *
 * - If `weekPlan` is undefined → board has totalCount=0, allDone=true,
 *   canAdvance=true (proposal §3.4: "no week plan → current behavior
 *   preserved, always-unlocked next week").
 * - If `isInitialized` is false → render as legacy week: totalCount=0,
 *   isLegacyWeek=true (proposal §3.4 step 4).
 */
export function buildWeeklyTodoBoard(
  weekNumber: number,
  weekPlan: WeekPlan | undefined,
  todoStates: Record<string, TodoState>,
  isInitialized: boolean,
  strategy: 'all' | 'majority' = 'all',
): WeeklyTodoBoard {
  if (!weekPlan || weekPlan.todos.length === 0) {
    return {
      weekNumber,
      todos: [],
      completedCount: 0,
      totalCount: 0,
      allDone: true,
      canAdvance: true,
      isLegacyWeek: !isInitialized,
    };
  }
  const statuses = weekPlan.todos.map(todo =>
    statusForTodo(weekNumber, todo, todoStates[todo.id], isInitialized),
  );
  // Legacy-week rule: rendered as "completed under old rules".
  if (!isInitialized) {
    return {
      weekNumber,
      todos: statuses,
      completedCount: 0,
      totalCount: 0,
      allDone: true,
      canAdvance: true,
      isLegacyWeek: true,
    };
  }
  const completedCount = statuses.filter(s => s.completed).length;
  const totalCount = statuses.length;
  const allDone = completedCount === totalCount;
  const majorityDone = completedCount > totalCount / 2;
  const canAdvance = strategy === 'majority' ? majorityDone : allDone;
  return { weekNumber, todos: statuses, completedCount, totalCount, allDone, canAdvance, isLegacyWeek: false };
}

/**
 * One-call helper for screens: takes the raw progress shape and returns a
 * map of weekNumber → WeeklyTodoBoard. Uses weekPlans parameter (so tests
 * can pass an in-memory plan rather than hit data/weeklyPlans).
 */
export function buildAllTodoBoards(
  weekPlans: WeekPlan[],
  progress: TodoPayload,
  strategy: 'all' | 'majority' = 'all',
): Record<number, WeeklyTodoBoard> {
  const result: Record<number, WeeklyTodoBoard> = {};
  for (const plan of weekPlans) {
    result[plan.weekNumber] = buildWeeklyTodoBoard(
      plan.weekNumber,
      plan,
      progress.todoStates,
      Boolean(progress.weekTodosInitialized[plan.weekNumber]),
      strategy,
    );
  }
  return result;
}

/**
 * Decide whether `weekNumber` is unlocked for the learner.
 *
 * Rules (proposal §4):
 *   - weekNumber <= 1 → true (week 1 is always unlocked)
 *   - weekTodosInitialized[weekNumber - 1] is false → true (prior week is
 *     legacy, treat as passed)
 *   - else → todoBoards[weekNumber - 1]?.canAdvance === true
 */
export function isWeekUnlocked(
  weekNumber: number,
  todoBoards: Record<number, WeeklyTodoBoard>,
  progress: TodoPayload,
  strategy: 'all' | 'majority' = 'all',
): boolean {
  if (weekNumber <= 1) return true;
  const prior = weekNumber - 1;
  const priorBoard = todoBoards[prior];
  if (priorBoard) return priorBoard.canAdvance;
  // No board was built for the prior week (no plan authored). If it was
  // never initialized either, treat as legacy and unlock.
  if (!progress.weekTodosInitialized[prior]) return true;
  return false;
}

/**
 * §5.2 helper recompute. Idempotent. The single source of truth is the
 * progress shape's `completedLessonIds` + `todoEventCounts`; this function
 * derives `todoStates[weekNumber]` from scratch and never carries anything
 * that is not in those inputs.
 *
 * - For `lesson` todos: progress = (# of todo.lessonIds in
 *   progress.completedLessonIds), clamped at target, completedAt set on
 *   first cross.
 * - For other kinds: not implemented in 37b (each phase 37d-N wires its
 *   own kind with its own event-count source).
 *
 * Caller is responsible for persisting the returned `TodoState` map via the
 * same atomic save path used by the rest of the store.
 */
export function recomputeTodoStatesForWeek(
  weekNumber: number,
  weekPlan: WeekPlan | undefined,
  progress: TodoPayload,
): Record<string, TodoState> {
  const out: Record<string, TodoState> = {};
  if (!weekPlan) return out;
  const completedIds = new Set(progress.completedLessonIds);

  for (const todo of weekPlan.todos) {
    const prior = progress.todoStates[todo.id];
    let progressCount = 0;
    if (todo.kind === 'lesson') {
      const ids = todo.lessonIds ?? [];
      progressCount = ids.reduce((acc, id) => (completedIds.has(id) ? acc + 1 : acc), 0);
    } else {
      // 37b lesson-kind only. For other kinds we preserve any prior count
      // (those are populated by 37d-N methods, NOT by this helper).
      progressCount = prior?.progress ?? 0;
    }
    const target = prior?.target ?? todo.target;
    const clamped = Math.min(progressCount, target);
    const reached = clamped >= target && target > 0;
    const state: TodoState = {
      todoId: todo.id,
      weekNumber,
      progress: clamped,
      target,
      completedAt: reached ? (prior?.completedAt ?? Date.now()) : undefined,
      skipped: prior?.skipped,
    };
    out[todo.id] = state;
  }
  return out;
}

/** Type-guard helper for screens that receive unknown progress. */
export function isTodoPayload(p: LearnerProgress | TodoPayload): p is TodoPayload {
  const candidate = p as Partial<TodoPayload>;
  return (
    typeof candidate === 'object'
    && candidate !== null
    && typeof candidate.todoStates === 'object'
    && candidate.todoStates !== null
    && typeof candidate.weekTodosInitialized === 'object'
    && candidate.weekTodosInitialized !== null
    && typeof candidate.todoEventCounts === 'object'
    && candidate.todoEventCounts !== null
    && Array.isArray(candidate.completedLessonIds)
  );
}
