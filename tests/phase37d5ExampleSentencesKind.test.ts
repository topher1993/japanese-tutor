import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

import {
  buildWeeklyTodoBoard,
} from '../src/services/weeklyTodoService';
import type {
  TodoEventCounts,
  TodoState,
  WeekPlan,
  WeekTodo,
} from '../src/types/weeklyTodo';
import { WEEKLY_PLANS } from '../src/data/weeklyPlans';
import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import { createPracticeProgressStore, setTodoFeatureEnabled, isTodoFeatureEnabled } from '../src/services/practiceProgressStore';

// Phase 37d-5 tests per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37d-5. These focus on the new `example-sentences` todo kind
// wiring:
//   a) gate-off is a no-op
//   b) markExampleViewed persists exampleSentencesViewed[weekNumber]
//      via saveExtendedProgress
//   c) re-viewing the same sentenceId is a no-op (de-dup)
//   d) after viewing N distinct sentences where N === target, the todo
//      completes and sets completedAt
//   e) rendering and filtering never auto-count sentences; progress requires
//      the learner's explicit Mark studied action
//   f) existing example-sentences tests still green (phase18d3 covers
//      the data pack; covered by focused vitest invocation in the task
//      brief alongside this file)
//   g) buildWeeklyTodoBoard shows correct progress for an
//      example-sentences-kind todo

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
 * Build a synthetic WeekPlan that has an example-sentences-kind todo. We
 * install it into WEEKLY_PLANS for the duration of the test (the array
 * is module-level mutable) so getWeekPlan(weekNumber) returns it. The
 * original plans are restored in afterEach so test ordering is
 * irrelevant. Option B per the brief — keeps weeklyPlans.ts untouched.
 */
function installSyntheticExamplePlan(opts: { target?: number; weekNumber?: number } = {}): WeekPlan {
  const target = opts.target ?? 5;
  const weekNumber = opts.weekNumber ?? 1;
  const exampleTodo: WeekTodo = {
    id: 'synthetic-example-todo',
    kind: 'example-sentences',
    title: 'Synthetic example-sentences todo',
    // §11.2 default: target = 5 sentences viewed. Author may override per week.
    target,
    unit: 'sentences',
  };
  const synthetic: WeekPlan = {
    weekNumber,
    passingStrategy: 'all',
    todos: [exampleTodo],
  };
  // Replace the existing entry for `weekNumber` (or push if absent).
  const idx = WEEKLY_PLANS.findIndex(p => p.weekNumber === weekNumber);
  if (idx >= 0) WEEKLY_PLANS[idx] = synthetic;
  else WEEKLY_PLANS.push(synthetic);
  return synthetic;
}

describe('Phase 37d-5 — example-sentences todo kind wiring', () => {
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

  it('a. markExampleViewed is a no-op when todoFeatureEnabled is false (gate off → no saveExtendedProgress call)', async () => {
    setTodoFeatureEnabled(false);
    expect(isTodoFeatureEnabled()).toBe(false);

    // Install a synthetic plan so getWeekPlan(1) doesn't return undefined
    // and the store can short-circuit on the weekPlan check too.
    installSyntheticExamplePlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.markExampleViewed(1, 'sentence-1');

    expect(saveSpy).not.toHaveBeenCalled();

    const after = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(after.todoEventCounts.exampleSentencesViewed?.[1] ?? []).toEqual([]);
  });

  it('b. markExampleViewed persists exampleSentencesViewed[weekNumber] to disk via saveExtendedProgress', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticExamplePlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.markExampleViewed(1, 'sentence-1');

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const writtenArg = saveSpy.mock.calls[0]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(writtenArg.todoEventCounts.exampleSentencesViewed[1]).toEqual(['sentence-1']);

    // Re-read from disk: the sentence id must survive a "cold start".
    const reread = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(reread.todoEventCounts.exampleSentencesViewed[1]).toEqual(['sentence-1']);
  });

  it('c. re-viewing the same sentenceId is a no-op (de-duped log + progress stays the same)', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticExamplePlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // View sentence-1 three times.
    await store.markExampleViewed(1, 'sentence-1');
    await store.markExampleViewed(1, 'sentence-1');
    await store.markExampleViewed(1, 'sentence-1');

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    // De-duped: only one entry.
    expect(stored.todoEventCounts.exampleSentencesViewed[1]).toEqual(['sentence-1']);
    expect(stored.todoStates['synthetic-example-todo'].progress).toBe(1);
    expect(stored.todoStates['synthetic-example-todo'].target).toBe(5);
    expect(stored.todoStates['synthetic-example-todo'].completedAt).toBeUndefined();
  });

  it('d. after viewing N distinct sentences where N === target, the todo completes and sets completedAt', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticExamplePlan({ target: 5 });

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // View 4 sentences — not yet at target.
    for (const id of ['s1', 's2', 's3', 's4']) {
      await store.markExampleViewed(1, id);
    }
    const partial = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(partial.todoStates['synthetic-example-todo'].progress).toBe(4);
    expect(partial.todoStates['synthetic-example-todo'].target).toBe(5);
    expect(partial.todoStates['synthetic-example-todo'].completedAt).toBeUndefined();

    // 5th distinct sentence crosses the target → completes + completedAt.
    await store.markExampleViewed(1, 's5');
    const done = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(done.todoEventCounts.exampleSentencesViewed[1]).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(done.todoStates['synthetic-example-todo'].progress).toBe(5);
    expect(done.todoStates['synthetic-example-todo'].target).toBe(5);
    expect(done.todoStates['synthetic-example-todo'].completedAt).toBeTypeOf('number');

    // 6th distinct sentence — progress is clamped at target (5), completedAt unchanged.
    await store.markExampleViewed(1, 's6');
    const beyond = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
    };
    expect(beyond.todoStates['synthetic-example-todo'].progress).toBe(5);
  });

  it('e. rendering or filtering never auto-counts sentences as studied', () => {
    const source = readFileSync('src/screens/ExampleSentencesScreen.tsx', 'utf8');
    expect(source).not.toContain('pickReportableSentenceIds');
    expect(source).toContain("['all', 'N5', 'N4', 'N3']");
    expect(source).toMatch(/label=\{isStudied \? 'Studied'[^}]+: 'Mark studied'\}/);
    expect(source).toContain('onPress={() => { void markSentenceStudied(s.id); }}');
  });

  it('g. buildWeeklyTodoBoard shows correct progress for an example-sentences-kind todo (in-progress + completed)', async () => {
    setTodoFeatureEnabled(true);
    const synthetic = installSyntheticExamplePlan({ target: 3 });

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // 1 of 3 viewed → not yet met.
    await store.markExampleViewed(1, 's1');
    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      weekTodosInitialized: Record<number, boolean>;
    };
    expect(stored.weekTodosInitialized[1]).toBe(true);

    const boardInProgress = buildWeeklyTodoBoard(1, synthetic, stored.todoStates, true, 'all');
    const todoStatusInProgress = boardInProgress.todos.find(t => t.todo.id === 'synthetic-example-todo');
    expect(todoStatusInProgress).toBeDefined();
    expect(todoStatusInProgress!.progress).toBe(1);
    expect(todoStatusInProgress!.target).toBe(3);
    expect(todoStatusInProgress!.completed).toBe(false);

    // 3 of 3 viewed → completed.
    await store.markExampleViewed(1, 's2');
    await store.markExampleViewed(1, 's3');
    const stored2 = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
    };
    const boardDone = buildWeeklyTodoBoard(1, synthetic, stored2.todoStates, true, 'all');
    const todoStatusDone = boardDone.todos.find(t => t.todo.id === 'synthetic-example-todo');
    expect(todoStatusDone).toBeDefined();
    expect(todoStatusDone!.progress).toBe(3);
    expect(todoStatusDone!.target).toBe(3);
    expect(todoStatusDone!.completed).toBe(true);
  });

  it('h. markExampleViewed is no-op when repo lacks saveExtendedProgress (legacy repo)', async () => {
    setTodoFeatureEnabled(true);
    installSyntheticExamplePlan();

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Strip saveExtendedProgress to simulate a legacy in-memory repo.
    const stripped = repo as unknown as { saveExtendedProgress?: (...args: unknown[]) => Promise<void> };
    delete stripped.saveExtendedProgress;

    await expect(store.markExampleViewed(1, 'sentence-1')).resolves.toBeDefined();
  });
});
