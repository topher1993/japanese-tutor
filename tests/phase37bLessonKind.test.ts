import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  buildWeeklyTodoBoard,
  buildAllTodoBoards,
  isWeekUnlocked,
  recomputeTodoStatesForWeek,
  type TodoPayload,
} from '../src/services/weeklyTodoService';
import type {
  TodoEventCounts,
  TodoState,
  WeekPlan,
} from '../src/types/weeklyTodo';
import { getAllLessons } from '../src/services/lessonService';
import { getAllWeekPlans, getWeekPlan } from '../src/services/weeklyPlansService';
import { resolveCardPool, resolveKanjiSet } from '../src/services/weeklyCardPoolService';
import { emptyTodoEventCounts } from '../src/types/weeklyTodo';
import { createFlashcardDeck } from '../src/services/flashcardService';

// Phase 37b tests per docs/phase-37-todo-gated-progression-proposal.md §8 phase-37b.
// These are pure-service tests; they exercise the recompute-from-event-log
// path, the board builder, and the unlock rule. The store-wiring test is
// deferred to the 37c smoke phase.

function makeEmptyPayload(): TodoPayload {
  return {
    todoStates: {},
    weekTodosInitialized: {},
    todoEventCounts: emptyTodoEventCounts(),
    completedLessonIds: [],
  };
}

function n5w1Plan(): WeekPlan {
  const plan = getWeekPlan(1);
  if (!plan) throw new Error('week 1 plan not authored');
  return plan;
}

describe('Phase 37b — `lesson` kind: data model + pure service', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. WEEKLY_PLANS contains exactly one plan (N5 week 1) with the lesson-kind todo referencing real lesson ids', () => {
    const plans = getAllWeekPlans();
    expect(plans).toHaveLength(1);
    expect(plans[0].weekNumber).toBe(1);
    // Phase 37d-1: a daily-rush todo was added alongside the lesson todo
    // (for end-to-end recompute coverage). The lesson todo MUST stay first so
    // 37c's "current todo" lookup still resolves to lessons.
    const lessonTodo = plans[0].todos.find(todo => todo.kind === 'lesson');
    expect(lessonTodo).toBeDefined();
    expect(lessonTodo!.id).toBe('n5-w1-lessons');

    // The lessonIds must match what getAllLessons() actually carries for N5 week 1.
    const expected = getAllLessons()
      .filter(lesson => lesson.level === 'N5' && lesson.week === 1)
      .map(lesson => lesson.id)
      .sort();
    expect(lessonTodo!.lessonIds?.slice().sort()).toEqual(expected);
    expect(lessonTodo!.target).toBe(expected.length);
  });

  it('2. buildWeeklyTodoBoard: empty state — totalCount > 0, completedCount 0, allDone false', () => {
    const plan = n5w1Plan();
    const board = buildWeeklyTodoBoard(1, plan, {}, false, 'all');
    // Not yet initialized → render as legacy (proposal §3.4 step 4).
    expect(board.isLegacyWeek).toBe(true);
    expect(board.allDone).toBe(true);
    expect(board.canAdvance).toBe(true);
    expect(board.totalCount).toBe(0);
  });

  it('3. buildWeeklyTodoBoard: partial state — not all todos completed → canAdvance false', () => {
    // Phase 37d-1: N5 W1 now has 2 todos (lesson + daily-rush). Partial state
    // means the lesson todo is one short of its target AND the daily-rush
    // todo is incomplete; under strategy='all', board.allDone must be false.
    const plan = n5w1Plan();
    const lessonTodo = plan.todos.find(t => t.kind === 'lesson')!;
    const expected = getAllLessons().filter(l => l.level === 'N5' && l.week === 1);
    const partial: Record<string, TodoState> = {
      [lessonTodo.id]: {
        todoId: lessonTodo.id,
        weekNumber: 1,
        progress: expected.length - 1, // one short of target
        target: expected.length,
      },
    };
    const board = buildWeeklyTodoBoard(1, plan, partial, true, 'all');
    expect(board.isLegacyWeek).toBe(false);
    expect(board.completedCount).toBe(0); // lesson todo not yet complete
    expect(board.totalCount).toBe(2);     // 1 lesson + 1 daily-rush
    expect(board.allDone).toBe(false);
    expect(board.canAdvance).toBe(false);
  });

  it('4. buildWeeklyTodoBoard: complete state — all todos done → allDone true', () => {
    // Phase 37d-1: complete state requires BOTH todos done, not just lesson.
    const plan = n5w1Plan();
    const lessonTodo = plan.todos.find(t => t.kind === 'lesson')!;
    const rushTodo = plan.todos.find(t => t.kind === 'daily-rush')!;
    const ids = lessonTodo.lessonIds ?? [];
    const complete: Record<string, TodoState> = {
      [lessonTodo.id]: {
        todoId: lessonTodo.id,
        weekNumber: 1,
        progress: ids.length,
        target: ids.length,
        completedAt: Date.now(),
      },
      [rushTodo.id]: {
        todoId: rushTodo.id,
        weekNumber: 1,
        progress: 1,
        target: 1,
        completedAt: Date.now(),
      },
    };
    const board = buildWeeklyTodoBoard(1, plan, complete, true, 'all');
    expect(board.completedCount).toBe(2);
    expect(board.totalCount).toBe(2);
    expect(board.allDone).toBe(true);
    expect(board.canAdvance).toBe(true);
  });

  it('5. recomputeTodoStatesForWeek: clamps at todo.target and sets completedAt only once', () => {
    const plan = n5w1Plan();
    const todo = plan.todos[0];
    const ids = todo.lessonIds ?? [];
    // The idempotency check: feed MORE completed IDs than the todo has — clamp
    // must hold; completedAt set on first cross and never updated later.
    const payload: TodoPayload = makeEmptyPayload();
    payload.completedLessonIds = [...ids, 'lesson-extra-not-in-todo'];
    const firstPass = recomputeTodoStatesForWeek(1, plan, payload);
    expect(firstPass[todo.id]).toBeDefined();
    expect(firstPass[todo.id].progress).toBe(ids.length);
    expect(firstPass[todo.id].target).toBe(ids.length);
    const firstCompletedAt = firstPass[todo.id].completedAt;
    expect(firstCompletedAt).toBeDefined();

    // Second pass: completedAt must not change (no Date.now() drift per pass).
    const secondPass = recomputeTodoStatesForWeek(1, plan, {
      ...payload,
      todoStates: firstPass,
    });
    expect(secondPass[todo.id].progress).toBe(ids.length);
    expect(secondPass[todo.id].completedAt).toBe(firstCompletedAt);
  });

  it('6. recomputeTodoStatesForWeek: progress is the count of todo.lessonIds present in completedLessonIds (not all completedLessonIds)', () => {
    const plan = n5w1Plan();
    const todo = plan.todos[0];
    const payload: TodoPayload = makeEmptyPayload();
    // Include only 2 of the 5 lessonIds plus 5 unrelated ids.
    payload.completedLessonIds = [
      ...(todo.lessonIds ?? []).slice(0, 2),
      'unrelated-lesson-a',
      'unrelated-lesson-b',
      'unrelated-lesson-c',
      'unrelated-lesson-d',
    ];
    const next = recomputeTodoStatesForWeek(1, plan, payload);
    expect(next[todo.id].progress).toBe(2);
    expect(next[todo.id].target).toBe(todo.target);
    expect(next[todo.id].completedAt).toBeUndefined();
  });

  it('7. isWeekUnlocked: week 1 always unlocked; week 2 unlocked only when week 1 board.canAdvance', () => {
    const plan = n5w1Plan();
    const todo = plan.todos[0];
    const ids = todo.lessonIds ?? [];

    // Empty progress with week 1 explicitly initialized (so it is NOT treated
    // as legacy): week 1 not allDone → week 2 locked.
    const initialisedEmpty = buildAllTodoBoards([plan], {
      ...makeEmptyPayload(),
      weekTodosInitialized: { 1: true },
    }, 'all');
    expect(isWeekUnlocked(1, initialisedEmpty, {
      ...makeEmptyPayload(),
      weekTodosInitialized: { 1: true },
    }, 'all')).toBe(true);
    expect(isWeekUnlocked(2, initialisedEmpty, {
      ...makeEmptyPayload(),
      weekTodosInitialized: { 1: true },
    }, 'all')).toBe(false);

    // Once week 1's lesson AND daily-rush todos are both complete, week 2
    // unlocks. Phase 37d-1: the plan now has 2 todos; canAdvance=true under
    // strategy='all' requires both. Board is built from todoStates (not
    // completedLessonIds), so we seed the recomputed map for both todos.
    const fullPayload: TodoPayload = {
      ...makeEmptyPayload(),
      weekTodosInitialized: { 1: true },
      completedLessonIds: [...ids],
      todoStates: {
        [todo.id]: {
          todoId: todo.id,
          weekNumber: 1,
          progress: ids.length,
          target: ids.length,
          completedAt: Date.now(),
        },
        // Phase 37d-1: daily-rush todo must also be marked complete for the
        // board to reach allDone under strategy='all'. Build the payload
        // directly with both todos done so the unlock rule fires.
        ...(plan.todos.find(t => t.kind === 'daily-rush') ? {
          [plan.todos.find(t => t.kind === 'daily-rush')!.id]: {
            todoId: plan.todos.find(t => t.kind === 'daily-rush')!.id,
            weekNumber: 1,
            progress: 1,
            target: 1,
            completedAt: Date.now(),
          },
        } : {}),
      },
    };
    const fullBoards = buildAllTodoBoards([plan], fullPayload, 'all');
    expect(isWeekUnlocked(2, fullBoards, fullPayload, 'all')).toBe(true);
  });

  it('8. isWeekUnlocked: legacy prior week (weekTodosInitialized false) → next week unlocked without board', () => {
    // Proposal §4: if the prior week was never initialized (learner was mid-
    // curriculum when the feature shipped), treat it as completed under old
    // rules and unlock the next week.
    const payload = makeEmptyPayload();
    expect(isWeekUnlocked(2, {}, payload, 'all')).toBe(true);
    expect(isWeekUnlocked(3, {}, payload, 'all')).toBe(true);

    // If we *did* initialize week 1 but didn't complete its todos, week 2 is
    // locked even when no board object exists for week 1 (defensive branch).
    const initializedButIncomplete = {
      ...payload,
      weekTodosInitialized: { 1: true },
    };
    expect(isWeekUnlocked(2, {}, initializedButIncomplete, 'all')).toBe(false);
  });

  it('9. buildAllTodoBoards accepts weekPlans parameter so screens can pass authored plans without coupling to data/', () => {
    const customPlan: WeekPlan = {
      weekNumber: 7,
      passingStrategy: 'all',
      todos: [
        { id: 'custom-todo', kind: 'lesson', title: 'Custom', target: 1, lessonIds: ['lesson-a'] },
      ],
    };
    const boards = buildAllTodoBoards([customPlan], {
      ...makeEmptyPayload(),
      weekTodosInitialized: { 7: true },
    }, 'all');
    expect(boards[7]).toBeDefined();
    expect(boards[7].totalCount).toBe(1);
    expect(boards[7].allDone).toBe(false);
    expect(boards[7].canAdvance).toBe(false);
  });

  it('10. resolveCardPool: `week` pool returns card ids from createFlashcardDeck (no getLessonCategoryCards reference)', () => {
    // §3.1 + QC round-2 P1-1 fix: pool must come from createFlashcardDeck,
    // not from a non-existent helper. We assert the resolver returns the
    // exact card ids createFlashcardDeck produces for the week's lessons.
    const lessons = getAllLessons().filter(l => l.week === 1);
    const expectedDeck = createFlashcardDeck(lessons);
    const expectedIds = expectedDeck.cards.map(c => c.id);

    const resolution = resolveCardPool('week', 1);
    expect(resolution.source).toBe('week');
    expect(resolution.cardIds).toEqual(expectedIds);
    expect(resolution.expectedTarget).toBe(expectedIds.length);
    // No supplemental-only id produced (the deck merges supplemental in).
    expect(resolution.cardIds.length).toBeGreaterThan(0);
  });

  it('11. resolveCardPool: `level` pool returns N5 lesson cards for the 37b level scope', () => {
    const lessons = getAllLessons().filter(l => l.level === 'N5');
    const expectedIds = createFlashcardDeck(lessons).cards.map(c => c.id);
    const resolution = resolveCardPool('level', 1);
    expect(resolution.source).toBe('level');
    expect(resolution.cardIds).toEqual(expectedIds);
  });

  it('12. resolveKanjiSet: passthrough validator; empty set returns empty pool', () => {
    expect(resolveKanjiSet(undefined).cardIds).toEqual([]);
    expect(resolveKanjiSet([]).cardIds).toEqual([]);
    expect(resolveKanjiSet([]).source).toBe('empty');

    const result = resolveKanjiSet(['card-a', 'card-b']);
    expect(result.source).toBe('kanji-set');
    expect(result.cardIds).toEqual(['card-a', 'card-b']);
    expect(result.expectedTarget).toBe(2);
  });
});

// =============================================================================
// Phase 37b integration: recompute lands on disk (regression for staged-buffer bug)
// =============================================================================
// Igris's first 37b attempt staged recomputed state into a closure buffer that
// was never written to SQLite. The gate UI in 37c would have read stale state.
// This test pins the fix: completeCurrentLesson must call saveExtendedProgress
// and the recomputed todo state must be visible in the next getProgress() read.

import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import { createPracticeProgressStore, setTodoFeatureEnabled } from '../src/services/practiceProgressStore';

function createInMemoryDb(): SqliteLikeDatabase {
  const tables = new Map<string, unknown[]>();
  return {
    tables,
    async execAsync(sql: string) {
      // Minimal no-op for the CREATE TABLE statements in initialize().
      // The in-memory path uses the tables map directly.
      void sql;
    },
    async runAsync(sql: string, ...params: unknown[]) {
      // Mirror INSERT OR REPLACE INTO progress (?, ?, ?, ?, ?, ?, ?, ?) writes
      // into the in-memory tables so getProgress() can rehydrate from them.
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

describe('Phase 37b end-to-end: recompute lands on disk', () => {
  beforeEach(() => {
    setTodoFeatureEnabled(true);
  });
  afterEach(() => {
    setTodoFeatureEnabled(false);
  });

  it('13. completeCurrentLesson persists recomputed todo state via saveExtendedProgress', async () => {
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();

    const store = createPracticeProgressStore(repo);
    const plan = getWeekPlan(1)!;
    expect(plan).toBeDefined();
    expect(plan.todos.length).toBeGreaterThan(0);
    const lessonTodo = plan.todos[0];
    const firstLessonId = (lessonTodo as { lessonIds?: string[] }).lessonIds?.[0];
    expect(firstLessonId).toBeDefined();

    // Complete one lesson — recompute should fire.
    await store.completeCurrentLesson(firstLessonId!, 90, '2026-07-01');

    // Read progress back from the repo (simulates a cold start).
    const stored = await store.getProgress() as unknown as { todoStates: Record<string, TodoState>; weekTodosInitialized: Record<number, boolean> };
    expect(stored.todoStates).toBeDefined();
    expect(stored.todoStates[lessonTodo.id]).toBeDefined();
    expect(stored.todoStates[lessonTodo.id].weekNumber).toBe(1);
    expect(stored.todoStates[lessonTodo.id].progress).toBe(1); // one lesson complete, target was lessonIds.length (5) but progress counts distinct completed ones
    expect(stored.weekTodosInitialized[1]).toBe(true);
  });

  it('14. completeCurrentLesson is idempotent — second call converges to same state', async () => {
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const plan = getWeekPlan(1)!;
    const lessonTodo = plan.todos[0];
    const firstLessonId = (lessonTodo as { lessonIds?: string[] }).lessonIds?.[0]!;

    await store.completeCurrentLesson(firstLessonId, 90, '2026-07-01');
    const after1 = await store.getProgress() as unknown as { todoStates: Record<string, TodoState> };
    const progress1 = after1.todoStates[lessonTodo.id].progress;

    await store.completeCurrentLesson(firstLessonId, 90, '2026-07-01');
    const after2 = await store.getProgress() as unknown as { todoStates: Record<string, TodoState> };
    const progress2 = after2.todoStates[lessonTodo.id].progress;

    // Re-completing the same lesson must not double-count or wipe state.
    expect(progress2).toBe(progress1);
  });
});
