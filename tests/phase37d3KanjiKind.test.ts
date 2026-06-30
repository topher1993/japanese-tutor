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

// Phase 37d-3 tests per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37d-3. These focus on the new `kanji` todo kind wiring:
//   a) gate-off is a no-op
//   b) recordKanjiGood persists kanjiGoodAnswers[weekNumber] via saveExtendedProgress
//   c) card ids outside todo.kanjiSet do not count toward progress
//      (intersection rule from §5 — vocab cards / unlisted cards are ignored)
//   d) re-marking the same kanji card Good is a no-op (de-dup)
//   e) after marking all kanjiSet cards Good, buildWeeklyTodoBoard shows N/N
//   f) recordKanjiGood is no-op when repo lacks saveExtendedProgress (legacy)
//   g) regression: 37d-2 flashcards tests still pass (covered by focused
//      vitest invocation in the task brief — they re-run alongside this file)

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
 * Build a synthetic WeekPlan that has a kanji-kind todo with the supplied
 * kanjiSet. We install it into WEEKLY_PLANS for the duration of the test
 * (the array is module-level mutable) so getWeekPlan(weekNumber) returns
 * it. The original plans are restored in afterEach so test ordering is
 * irrelevant. Option B per the brief — keeps weeklyPlans.ts untouched.
 */
function installSyntheticPlan(kanjiSet: string[], weekNumber = 1): WeekPlan {
  const kanjiTodo: WeekTodo = {
    id: 'synthetic-kanji-todo',
    kind: 'kanji',
    title: 'Synthetic kanji todo',
    // §11.2 default: leave target=0 so the resolver drives the count.
    target: 0,
    unit: 'kanji',
    kanjiSet: [...kanjiSet],
  };
  const synthetic: WeekPlan = {
    weekNumber,
    passingStrategy: 'all',
    todos: [kanjiTodo],
  };
  // Replace the existing entry for `weekNumber` (or push if absent).
  const idx = WEEKLY_PLANS.findIndex(p => p.weekNumber === weekNumber);
  if (idx >= 0) WEEKLY_PLANS[idx] = synthetic;
  else WEEKLY_PLANS.push(synthetic);
  return synthetic;
}

describe('Phase 37d-3 — kanji todo kind wiring', () => {
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

  it('a. recordKanjiGood is a no-op when todoFeatureEnabled is false (gate off → no saveExtendedProgress call)', async () => {
    setTodoFeatureEnabled(false);
    expect(isTodoFeatureEnabled()).toBe(false);

    // Install a synthetic plan so getWeekPlan(1) doesn't return undefined
    // and the store can short-circuit on the weekPlan check too.
    installSyntheticPlan(['kanji-1'], 1);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordKanjiGood(1, 'kanji-1');

    expect(saveSpy).not.toHaveBeenCalled();

    const after = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(after.todoEventCounts.kanjiGoodAnswers?.[1] ?? []).toEqual([]);
  });

  it('b. recordKanjiGood persists kanjiGoodAnswers[weekNumber] to disk via saveExtendedProgress', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticPlan(['kanji-1'], 1);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordKanjiGood(1, 'kanji-1');

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const writtenArg = saveSpy.mock.calls[0]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(writtenArg.todoEventCounts.kanjiGoodAnswers[1]).toEqual(['kanji-1']);

    // Re-read from disk: the card id must survive a "cold start".
    const reread = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(reread.todoEventCounts.kanjiGoodAnswers[1]).toEqual(['kanji-1']);
  });

  it('c. card ids outside the todo.kanjiSet do not count toward progress (intersection rule from §5)', async () => {
    setTodoFeatureEnabled(true);

    // kanjiSet is the gate — the call site is responsible for filtering by
    // card.kind === 'kanji', but the STORE additionally intersects against
    // todo.kanjiSet. A card id the caller passes that is NOT in kanjiSet
    // (e.g. an unlisted vocab card) must not bump progress.
    const kanjiSet = ['kanji-a', 'kanji-b'];
    installSyntheticPlan(kanjiSet, 1);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Pass one card id outside the kanjiSet and one inside.
    await store.recordKanjiGood(1, 'kanji-X'); // not in set
    await store.recordKanjiGood(1, 'kanji-a'); // in set

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    // The event log records both (the store trusts the caller).
    expect(stored.todoEventCounts.kanjiGoodAnswers[1].sort()).toEqual(['kanji-X', 'kanji-a'].sort());
    // But the TODO progress is the intersection with kanjiSet — 1, not 2.
    expect(stored.todoStates['synthetic-kanji-todo']).toBeDefined();
    expect(stored.todoStates['synthetic-kanji-todo'].progress).toBe(1);
    expect(stored.todoStates['synthetic-kanji-todo'].target).toBe(2);
  });

  it('d. re-marking the same kanji card Good is a no-op (de-duped log + progress stays the same)', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticPlan(['kanji-a', 'kanji-b', 'kanji-c'], 1);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Mark kanji-a Good three times.
    await store.recordKanjiGood(1, 'kanji-a');
    await store.recordKanjiGood(1, 'kanji-a');
    await store.recordKanjiGood(1, 'kanji-a');

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    // De-duped: only one entry.
    expect(stored.todoEventCounts.kanjiGoodAnswers[1]).toEqual(['kanji-a']);
    expect(stored.todoStates['synthetic-kanji-todo'].progress).toBe(1);
    expect(stored.todoStates['synthetic-kanji-todo'].target).toBe(3);
    expect(stored.todoStates['synthetic-kanji-todo'].completedAt).toBeUndefined();
  });

  it('e. after marking all kanjiSet cards Good, buildWeeklyTodoBoard shows N/N for a kanji-kind todo', async () => {
    setTodoFeatureEnabled(true);
    const kanjiSet = ['kanji-a', 'kanji-b'];
    const synthetic = installSyntheticPlan(kanjiSet, 1);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Mark every kanji Good.
    for (const kanjiCardId of kanjiSet) {
      await store.recordKanjiGood(1, kanjiCardId);
    }

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.weekTodosInitialized[1]).toBe(true);
    expect(stored.todoStates['synthetic-kanji-todo'].progress).toBe(2);
    expect(stored.todoStates['synthetic-kanji-todo'].target).toBe(2);
    expect(stored.todoStates['synthetic-kanji-todo'].completedAt).toBeTypeOf('number');

    // buildWeeklyTodoBoard should now show the kanji todo as completed.
    const board = buildWeeklyTodoBoard(1, synthetic, stored.todoStates, true, 'all');
    const kanjiTodoStatus = board.todos.find(t => t.todo.id === 'synthetic-kanji-todo');
    expect(kanjiTodoStatus).toBeDefined();
    expect(kanjiTodoStatus!.progress).toBe(2);
    expect(kanjiTodoStatus!.target).toBe(2);
    expect(kanjiTodoStatus!.completed).toBe(true);
  });

  it('f. recordKanjiGood is no-op when repo lacks saveExtendedProgress (legacy repo)', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticPlan(['kanji-1'], 1);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Strip saveExtendedProgress to simulate a legacy in-memory repo.
    const stripped = repo as unknown as { saveExtendedProgress?: (...args: unknown[]) => Promise<void> };
    delete stripped.saveExtendedProgress;

    await expect(store.recordKanjiGood(1, 'kanji-1')).resolves.toBeDefined();
  });
});