import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  buildWeeklyTodoBoard,
  type TodoPayload,
} from '../src/services/weeklyTodoService';
import type {
  TodoEventCounts,
  TodoState,
  WeekPlan,
  WeekTodo,
} from '../src/types/weeklyTodo';
import { emptyTodoEventCounts } from '../src/types/weeklyTodo';
import { WEEKLY_PLANS } from '../src/data/weeklyPlans';
import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import { createPracticeProgressStore, setTodoFeatureEnabled, isTodoFeatureEnabled } from '../src/services/practiceProgressStore';

// Phase 37d-4 tests per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37d-4. These focus on the new `quiz` todo kind wiring:
//   a) gate-off is a no-op
//   b) recordQuizAttempt persists quizAttempts[weekNumber] via
//      saveExtendedProgress as the BEST score (higher replaces lower,
//      lower does not replace higher)
//   c) A score below passThreshold (70) does NOT complete the todo
//   d) A score >= passThreshold completes the todo and sets completedAt
//   e) Two attempts: first 65, second 80 — first does not complete, second does
//   f) existing quiz tests still green (covered by focused vitest invocation
//      alongside this file in the task brief)
//   g) (optional) buildWeeklyTodoBoard shows correct progress for a
//      quiz-kind todo

function makeEmptyPayload(): TodoPayload {
  return {
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: emptyTodoEventCounts(),
    completedLessonIds: [],
  };
}

function createInMemoryDb(): SqliteLikeDatabase {
  const tables = new Map<string, unknown[]>();
  return {
    tables,
    async execAsync(_sql: string) {
      // No-op for CREATE TABLE in initialize(); we write directly to `tables`.
    },
    async runAsync(sql: string, ...params: unknown[]) {
      const trimmed = sql.trim();
      if (/^INSERT OR REPLACE INTO progress VALUES/i.test(trimmed)) {
        const rows = (tables.get('progress') ?? []) as Array<Record<string, unknown>>;
        const [id, lessonId, completed, completedAt, score, todoStates, weekTodosInitialized, todoEventCounts] = params;
        const idx = rows.findIndex(r => r.id === id);
        const row = {
          id, lesson_id: lessonId, completed, completed_at: completedAt, score,
          todo_states: todoStates, week_todos_initialized: weekTodosInitialized, todo_event_counts: todoEventCounts,
        };
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        tables.set('progress', rows);
      } else if (/^UPDATE progress SET todo_states/i.test(trimmed)) {
        const [todoStates, weekTodosInitialized, todoEventCounts] = params;
        const rows = (tables.get('progress') ?? []) as Array<Record<string, unknown>>;
        if (rows.length > 0) {
          rows[rows.length - 1] = {
            ...rows[rows.length - 1],
            todo_states: todoStates,
            week_todos_initialized: weekTodosInitialized,
            todo_event_counts: todoEventCounts,
          };
          tables.set('progress', rows);
        }
      } else if (/^INSERT INTO progress/i.test(trimmed)) {
        const rows = (tables.get('progress') ?? []) as Array<Record<string, unknown>>;
        rows.push({
          id: params[0], lesson_id: params[1], completed: params[2], completed_at: params[3], score: params[4],
          todo_states: params[5], week_todos_initialized: params[6], todo_event_counts: params[7],
        });
        tables.set('progress', rows);
      }
      return { changes: 1 };
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      if (/FROM progress/i.test(sql)) {
        return ((tables.get('progress') ?? []) as T[]);
      }
      return [];
    },
  };
}

/**
 * Build a synthetic WeekPlan that has a quiz-kind todo. We install it into
 * WEEKLY_PLANS for the duration of the test (the array is module-level
 * mutable) so getWeekPlan(weekNumber) returns it. The original plans are
 * restored in afterEach so test ordering is irrelevant. Option B per the
 * brief — keeps weeklyPlans.ts untouched.
 */
function installSyntheticQuizPlan(opts: { target?: number; weekNumber?: number } = {}): WeekPlan {
  const target = opts.target ?? 1;
  const weekNumber = opts.weekNumber ?? 1;
  const quizTodo: WeekTodo = {
    id: 'synthetic-quiz-todo',
    kind: 'quiz',
    title: 'Synthetic quiz todo',
    target,
    unit: '% correct',
  };
  const synthetic: WeekPlan = {
    weekNumber,
    passingStrategy: 'all',
    todos: [quizTodo],
  };
  // Replace the existing entry for `weekNumber` (or push if absent).
  const idx = WEEKLY_PLANS.findIndex(p => p.weekNumber === weekNumber);
  if (idx >= 0) WEEKLY_PLANS[idx] = synthetic;
  else WEEKLY_PLANS.push(synthetic);
  return synthetic;
}

describe('Phase 37d-4 — quiz todo kind wiring', () => {
  // Snapshot/restore the module-level WEEKLY_PLANS around every test so
  // mutations never leak between cases.
  let originalPlans: WeekPlan[];

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    originalPlans = WEEKLY_PLANS.splice(0, WEEKLY_PLANS.length, ...[]); // empty it
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setTodoFeatureEnabled(false);
    WEEKLY_PLANS.splice(0, WEEKLY_PLANS.length, ...originalPlans);
  });

  it('a. recordQuizAttempt is a no-op when todoFeatureEnabled is false (gate off → no saveExtendedProgress call)', async () => {
    setTodoFeatureEnabled(false);
    expect(isTodoFeatureEnabled()).toBe(false);

    // Install a synthetic plan so getWeekPlan(1) doesn't return undefined.
    installSyntheticQuizPlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordQuizAttempt(1, 100);

    expect(saveSpy).not.toHaveBeenCalled();

    const after = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    // Best score should remain the default 0 (no event written).
    expect(after.todoEventCounts.quizAttempts?.[1] ?? 0).toBe(0);
  });

  it('b. recordQuizAttempt persists quizAttempts[weekNumber] as the BEST score (higher replaces lower, lower does not replace higher)', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticQuizPlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    // First attempt: 85.
    await store.recordQuizAttempt(1, 85);
    expect(saveSpy).toHaveBeenCalledTimes(1);
    const firstWrittenArg = saveSpy.mock.calls[0]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(firstWrittenArg.todoEventCounts.quizAttempts[1]).toBe(85);

    // Second attempt: 60 (lower than prior best). Best must stay 85.
    await store.recordQuizAttempt(1, 60);
    expect(saveSpy).toHaveBeenCalledTimes(2);
    const secondWrittenArg = saveSpy.mock.calls[1]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(secondWrittenArg.todoEventCounts.quizAttempts[1]).toBe(85);

    // Third attempt: 95 (higher than prior best). Best must update to 95.
    await store.recordQuizAttempt(1, 95);
    expect(saveSpy).toHaveBeenCalledTimes(3);
    const thirdWrittenArg = saveSpy.mock.calls[2]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(thirdWrittenArg.todoEventCounts.quizAttempts[1]).toBe(95);

    // Re-read from disk: the best score must survive a "cold start".
    const reread = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(reread.todoEventCounts.quizAttempts[1]).toBe(95);
  });

  it('c. a score below passThreshold (70) does NOT complete the todo', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticQuizPlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // 69 is one below threshold.
    await store.recordQuizAttempt(1, 69);

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.todoEventCounts.quizAttempts[1]).toBe(69);
    expect(stored.todoStates['synthetic-quiz-todo']).toBeDefined();
    expect(stored.todoStates['synthetic-quiz-todo'].progress).toBe(0);
    expect(stored.todoStates['synthetic-quiz-todo'].target).toBe(1);
    expect(stored.todoStates['synthetic-quiz-todo'].completedAt).toBeUndefined();
  });

  it('d. a score >= passThreshold completes the todo and sets completedAt', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticQuizPlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // 70 is exactly the threshold.
    await store.recordQuizAttempt(1, 70);

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.todoEventCounts.quizAttempts[1]).toBe(70);
    expect(stored.todoStates['synthetic-quiz-todo'].progress).toBe(1);
    expect(stored.todoStates['synthetic-quiz-todo'].target).toBe(1);
    expect(stored.todoStates['synthetic-quiz-todo'].completedAt).toBeTypeOf('number');
  });

  it('e. two attempts — first 65 (below), second 80 (above): first does not complete, second does', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticQuizPlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // First attempt: 65 — below threshold, todo stays incomplete.
    await store.recordQuizAttempt(1, 65);
    const after1 = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(after1.todoEventCounts.quizAttempts[1]).toBe(65);
    expect(after1.todoStates['synthetic-quiz-todo'].progress).toBe(0);
    expect(after1.todoStates['synthetic-quiz-todo'].completedAt).toBeUndefined();

    // Second attempt: 80 — above threshold, todo now completes.
    await store.recordQuizAttempt(1, 80);
    const after2 = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(after2.todoEventCounts.quizAttempts[1]).toBe(80);
    expect(after2.todoStates['synthetic-quiz-todo'].progress).toBe(1);
    expect(after2.todoStates['synthetic-quiz-todo'].completedAt).toBeTypeOf('number');
  });

  it('g. buildWeeklyTodoBoard shows correct progress for a quiz-kind todo (in-progress + completed)', async () => {
    setTodoFeatureEnabled(true);
    const synthetic = installSyntheticQuizPlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // 50 → not yet met.
    await store.recordQuizAttempt(1, 50);
    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      weekTodosInitialized: Record<number, boolean>;
    };
    expect(stored.weekTodosInitialized[1]).toBe(true);

    // Board should show 0/1, not completed.
    const boardInProgress = buildWeeklyTodoBoard(1, synthetic, stored.todoStates, true, 'all');
    const quizTodoStatusInProgress = boardInProgress.todos.find(t => t.todo.id === 'synthetic-quiz-todo');
    expect(quizTodoStatusInProgress).toBeDefined();
    expect(quizTodoStatusInProgress!.progress).toBe(0);
    expect(quizTodoStatusInProgress!.target).toBe(1);
    expect(quizTodoStatusInProgress!.completed).toBe(false);

    // 80 → met.
    await store.recordQuizAttempt(1, 80);
    const stored2 = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
    };
    const boardDone = buildWeeklyTodoBoard(1, synthetic, stored2.todoStates, true, 'all');
    const quizTodoStatusDone = boardDone.todos.find(t => t.todo.id === 'synthetic-quiz-todo');
    expect(quizTodoStatusDone).toBeDefined();
    expect(quizTodoStatusDone!.progress).toBe(1);
    expect(quizTodoStatusDone!.target).toBe(1);
    expect(quizTodoStatusDone!.completed).toBe(true);
  });
});
