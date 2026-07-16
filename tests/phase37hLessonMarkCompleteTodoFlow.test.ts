import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Phase 37h — Lesson-mark-complete → in-memory todo-state propagation.
//
// Regression test for the bug "when accessed the week1 lesson thru todo I
// can't mark the lesson complete". The bug was a two-part defect:
//
//   1. weeklyTodoService.statusForTodo derived `isLegacyWeek` purely from
//      `!isInitialized`, so even the current week showed the "Completed
//      before weekly todos were introduced" helper copy on every todo row.
//   2. The store's completeCurrentLesson only persisted todoStates via
//      saveExtendedProgress. The in-memory `progress` state in LessonsScreen
//      never reflected the recomputed todoStates, so the on-screen todo
//      board always rendered with the empty initial payload.
//
// These tests pin both fixes: (1) the per-todo helper text uses the
// current-week rule, and (2) after completeCurrentLesson, the store's
// getExtendedProgress() exposes the recomputed todoStates so the screen's
// memoized todoPayload picks them up on the next render.

import {
  buildAllTodoBoards,
  buildWeeklyTodoBoard,
} from '../src/services/weeklyTodoService';
import type {
  TodoState,
  WeekPlan,
} from '../src/types/weeklyTodo';
import { getWeekPlan, getAllWeekPlans } from '../src/services/weeklyPlansService';
import {
  createPracticeProgressStore,
  setTodoFeatureEnabled,
  isTodoFeatureEnabled,
} from '../src/services/practiceProgressStore';
import {
  createSqliteLearningRepository,
  type SqliteLikeDatabase,
} from '../src/repositories/sqliteLearningRepository';
import { createInMemoryLearningRepository } from '../src/repositories/inMemoryLearningRepository';

function n5w1Plan(): WeekPlan {
  const plan = getWeekPlan(1);
  if (!plan) throw new Error('week 1 plan not authored');
  return plan;
}

function createInMemoryDb(): SqliteLikeDatabase {
  const tables = new Map<string, unknown[]>();
  return {
    tables,
    async execAsync(_sql: string) {
      // No-op for CREATE TABLE; tests write to `tables` directly.
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

describe('Phase 37h — Lesson mark-complete → todo-state propagation', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setTodoFeatureEnabled(false);
  });

  it('1. statusForTodo: current week (not yet initialized) does NOT show "Completed before weekly todos were introduced"', () => {
    const plan = n5w1Plan();
    const board = buildWeeklyTodoBoard(1, plan, {}, false, 'all', 1);
    for (const todo of board.todos) {
      expect(todo.helperText, `${todo.todo.id} helper text`).not.toMatch(/Completed before weekly todos were introduced/);
    }
  });

  it('2. statusForTodo: prior week that is uninitialized still shows the legacy copy', () => {
    const plan = n5w1Plan();
    // currentWeek = 2 means week 1 is a "prior" week relative to current.
    const board = buildWeeklyTodoBoard(1, plan, {}, false, 'all', 2);
    // The board-level isLegacyWeek=true here, so the row helper text is
    // the legacy copy — same as before.
    for (const todo of board.todos) {
      expect(todo.helperText).toBe('Completed before weekly todos were introduced');
    }
  });

  it('3. statusForTodo: after marking the lesson todo completed, helper text shows "Done — N/N"', () => {
    const plan = n5w1Plan();
    const lessonTodo = plan.todos.find(t => t.kind === 'lesson')!;
    const expected = plan.todos.find(t => t.kind === 'lesson')?.lessonIds ?? [];
    const todoStates: Record<string, TodoState> = {
      [lessonTodo.id]: {
        todoId: lessonTodo.id,
        weekNumber: 1,
        progress: expected.length,
        target: expected.length,
        completedAt: Date.now(),
      },
    };
    const board = buildWeeklyTodoBoard(1, plan, todoStates, true, 'all', 1);
    const lessonRow = board.todos.find(t => t.todo.kind === 'lesson');
    expect(lessonRow).toBeDefined();
    expect(lessonRow!.completed).toBe(true);
    expect(lessonRow!.helperText).toMatch(/Done — /);
  });

  it('4. completeCurrentLesson updates the store\'s getExtendedProgress() so the UI sees fresh todoStates', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    const store = createPracticeProgressStore(repo);
    expect(isTodoFeatureEnabled()).toBe(true);

    const lessonTodo = n5w1Plan().todos.find(t => t.kind === 'lesson')!;
    const firstLessonId = lessonTodo.lessonIds?.[0];
    if (!firstLessonId) throw new Error('week 1 plan lessonIds missing');

    // Pre-completion: extended progress is empty.
    const before = store.getExtendedProgress();
    expect(Object.keys(before.todoStates).length).toBe(0);
    expect(before.weekTodosInitialized[1]).toBeFalsy();

    // Mark the first lesson complete.
    await store.completeCurrentLesson(firstLessonId, 100, '2026-06-30');

    // Post-completion: extended progress should reflect the recomputed
    // todoStates and the week should be marked initialized.
    const after = store.getExtendedProgress();
    expect(after.weekTodosInitialized[1]).toBe(true);
    const lessonState = after.todoStates[lessonTodo.id];
    expect(lessonState, 'lesson todo state must exist after completeCurrentLesson').toBeDefined();
    expect(lessonState.progress).toBe(1);

    // The board built from the in-memory extended slice shows the lesson
    // todo progress — proving the screen's memoized todoPayload will see
    // it on the next render.
    const boards = buildAllTodoBoards(getAllWeekPlans(), {
      todoStates: after.todoStates,
      weekTodosInitialized: after.weekTodosInitialized,
      todoEventCounts: after.todoEventCounts,
      completedLessonIds: (await store.getProgress()).completedLessonIds,
    }, 'all', 1);
    const lessonRow = boards[1]?.todos.find(t => t.todo.kind === 'lesson');
    expect(lessonRow, 'lesson row must render after completeCurrentLesson').toBeDefined();
    expect(lessonRow!.progress).toBe(1);
    expect(lessonRow!.helperText).toMatch(/1 \/ /);
  });

  it('5. completeCurrentLesson is a no-op for getExtendedProgress() when the gate flag is off (preserves default-learner path)', async () => {
    setTodoFeatureEnabled(false);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    const store = createPracticeProgressStore(repo);

    const lessonTodo = n5w1Plan().todos.find(t => t.kind === 'lesson')!;
    const firstLessonId = lessonTodo.lessonIds?.[0];
    if (!firstLessonId) throw new Error('week 1 plan lessonIds missing');

    await store.completeCurrentLesson(firstLessonId, 100, '2026-06-30');

    const after = store.getExtendedProgress();
    // No todo state was written: the gate-off branch skips saveExtendedProgress.
    expect(after.todoStates[lessonTodo.id]).toBeUndefined();
    expect(after.weekTodosInitialized[1]).toBeFalsy();
  });

  it('6. reset() wipes the in-memory extended cache (P0-2 regression)', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    const store = createPracticeProgressStore(repo);

    const lessonTodo = n5w1Plan().todos.find(t => t.kind === 'lesson')!;
    const firstLessonId = lessonTodo.lessonIds?.[0];
    if (!firstLessonId) throw new Error('week 1 plan lessonIds missing');

    await store.completeCurrentLesson(firstLessonId, 100, '2026-06-30');
    expect(store.getExtendedProgress().weekTodosInitialized[1]).toBe(true);

    await store.reset();
    const after = store.getExtendedProgress();
    expect(after.weekTodosInitialized[1]).toBeFalsy();
    expect(Object.keys(after.todoStates).length).toBe(0);
  });

  // -----------------------------------------------------------------
  // Bug surface: in-memory repo (no saveExtendedProgress) must still
  // update the cache so screens that read getExtendedProgress() in the
  // current session see live todoStates. Otherwise the lesson-kind todo
  // would stay at 0/5 forever on web. Phase 37 web runs against
  // createInMemoryLearningRepository, which lacks saveExtendedProgress.
  // -----------------------------------------------------------------
  it('7. completeCurrentLesson with the in-memory repo still updates the extended cache so the UI sees fresh todoStates', async () => {
    setTodoFeatureEnabled(true);
    const repo = createInMemoryLearningRepository();
    // The in-memory repo intentionally omits saveExtendedProgress — that's
    // exactly the runtime shape on web. The store must still keep the
    // extended slice in its in-memory cache so subsequent reads reflect
    // the lesson completion.
    const store = createPracticeProgressStore(repo as unknown as Parameters<typeof createPracticeProgressStore>[0]);

    const lessonTodo = n5w1Plan().todos.find(t => t.kind === 'lesson')!;
    const firstLessonId = lessonTodo.lessonIds?.[0];
    if (!firstLessonId) throw new Error('week 1 plan lessonIds missing');

    // Pre-completion: extended progress is empty.
    const before = store.getExtendedProgress();
    expect(Object.keys(before.todoStates).length).toBe(0);
    expect(before.weekTodosInitialized[1]).toBeFalsy();

    await store.completeCurrentLesson(firstLessonId, 100, '2026-06-30');

    // Post-completion: the cache must reflect the recomputed todoStates
    // even though persistence was skipped.
    const after = store.getExtendedProgress();
    expect(after.weekTodosInitialized[1]).toBe(true);
    const lessonState = after.todoStates[lessonTodo.id];
    expect(lessonState, 'lesson todo state must exist in cache after completeCurrentLesson on web').toBeDefined();
    expect(lessonState.progress).toBe(1);
  });
});
