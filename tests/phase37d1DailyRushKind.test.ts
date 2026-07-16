import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  buildWeeklyTodoBoard,
} from '../src/services/weeklyTodoService';
import type {
  TodoEventCounts,
  TodoState,
  WeekPlan,
} from '../src/types/weeklyTodo';
import { getWeekPlan } from '../src/services/weeklyPlansService';
import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import { createPracticeProgressStore, setTodoFeatureEnabled, isTodoFeatureEnabled } from '../src/services/practiceProgressStore';

// Phase 37d-1 tests per docs/phase-37-todo-gated-progression-proposal.md
// §8 phase-37d-1. These focus on the new `daily-rush` todo kind wiring:
//   a) gate-off is a no-op
//   b) recompute persists dailyRushDates[weekNumber] via saveExtendedProgress
//   c) after one rush the board shows 1/7 for the scaled weekly requirement
//   d) Rush completion supplies a one-point legacy participation floor;
//      distinct card-stage advances own progress above that floor
//   e) regression check: existing Daily Rush tests still green (run as part
//      of the suite, see suite hook below)

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

describe('Phase 37d-1 — daily-rush todo kind wiring', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    setTodoFeatureEnabled(false);
  });

  it('a. recordDailyRushComplete is a no-op when todoFeatureEnabled is false (gate off → no saveExtendedProgress call)', async () => {
    // Sanity: gate must be off by default after afterEach.
    setTodoFeatureEnabled(false);
    expect(isTodoFeatureEnabled()).toBe(false);

    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Spy on saveExtendedProgress — must NOT be called when gate is off.
    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordDailyRushComplete(1, '2026-07-01');

    expect(saveSpy).not.toHaveBeenCalled();

    // No todo state should be materialized either.
    const after = await store.getProgress() as unknown as { todoStates: Record<string, TodoState> };
    expect(after.todoStates['n5-w1-daily-rush']).toBeUndefined();
  });

  it('b. recordDailyRushComplete persists dailyRushDates[weekNumber] to disk via saveExtendedProgress', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    const saveSpy = vi.spyOn(repo as unknown as { saveExtendedProgress: (...args: unknown[]) => Promise<void> }, 'saveExtendedProgress');

    await store.recordDailyRushComplete(1, '2026-07-01');

    expect(saveSpy).toHaveBeenCalledTimes(1);
    const writtenArg = saveSpy.mock.calls[0]?.[0] as unknown as { todoEventCounts: TodoEventCounts };
    expect(writtenArg.todoEventCounts.dailyRushDates[1]).toEqual(['2026-07-01']);

    // Re-read from disk: the date must survive a "cold start".
    const reread = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(reread.todoEventCounts.dailyRushDates[1]).toEqual(['2026-07-01']);
  });

  it('c. after one rush completion, buildWeeklyTodoBoard shows 1/7 for the scaled weekly todo (recompute converges)', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    await store.recordDailyRushComplete(1, '2026-07-01');

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.weekTodosInitialized[1]).toBe(true);
    expect(stored.todoStates['n5-w1-daily-rush']).toBeDefined();
    expect(stored.todoStates['n5-w1-daily-rush'].weekNumber).toBe(1);
    expect(stored.todoStates['n5-w1-daily-rush'].progress).toBe(1);
    expect(stored.todoStates['n5-w1-daily-rush'].target).toBe(7);

    // buildWeeklyTodoBoard should now show the daily-rush todo as completed.
    const plan = n5w1Plan();
    const board = buildWeeklyTodoBoard(1, plan, stored.todoStates, true, 'all');
    const rushTodo = board.todos.find(t => t.todo.id === 'n5-w1-daily-rush');
    expect(rushTodo).toBeDefined();
    expect(rushTodo!.progress).toBe(1);
    expect(rushTodo!.target).toBe(7);
    expect(rushTodo!.completed).toBe(false);
  });

  it('d. repeated Rush days keep the one-point participation floor without stage evidence', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    await store.recordDailyRushComplete(1, '2026-07-01');
    await store.recordDailyRushComplete(1, '2026-07-02');

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    // Both dates persisted (de-duped, no double-log).
    expect(stored.todoEventCounts.dailyRushDates[1]).toEqual(['2026-07-01', '2026-07-02']);
    expect(stored.todoStates['n5-w1-daily-rush'].progress).toBe(1);
    expect(stored.todoStates['n5-w1-daily-rush'].target).toBe(7);

    // Re-completing the SAME date is also a no-op on the date list and the
    // todo state (idempotency).
    await store.recordDailyRushComplete(1, '2026-07-02');
    const reread = await store.getProgress() as unknown as { todoEventCounts: TodoEventCounts };
    expect(reread.todoEventCounts.dailyRushDates[1]).toEqual(['2026-07-01', '2026-07-02']);
  });

  it('e. same-date repeat rush completion does NOT bump the todo above 1 (de-duped log)', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    await store.recordDailyRushComplete(1, '2026-07-01');
    await store.recordDailyRushComplete(1, '2026-07-01');
    await store.recordDailyRushComplete(1, '2026-07-01');

    const stored = await store.getProgress() as unknown as {
      todoEventCounts: TodoEventCounts;
      todoStates: Record<string, TodoState>;
    };
    // De-duped: only one entry for 2026-07-01.
    expect(stored.todoEventCounts.dailyRushDates[1]).toEqual(['2026-07-01']);
    expect(stored.todoStates['n5-w1-daily-rush'].progress).toBe(1);
  });

  it('f. recordDailyRushComplete is no-op when repo lacks saveExtendedProgress (legacy repo)', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    // Strip saveExtendedProgress to simulate a legacy in-memory repo.
    const stripped = repo as unknown as { saveExtendedProgress?: (...args: unknown[]) => Promise<void> };
    delete stripped.saveExtendedProgress;

    // Should not throw.
    await expect(store.recordDailyRushComplete(1, '2026-07-01')).resolves.toBeDefined();
  });

  it('g. serializes answer-card writes before the final Rush completion snapshot', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const originalSave = repo.saveExtendedProgress!.bind(repo);
    let saveCall = 0;
    repo.saveExtendedProgress = async snapshot => {
      const call = saveCall++;
      if (call === 0) await new Promise(resolve => setTimeout(resolve, 25));
      await originalSave(snapshot);
    };
    const store = createPracticeProgressStore(repo);

    const answerWrite = store.recordFlashcardReview(1, 'lesson-n5-w1-d1-card-1');
    const completionWrite = store.recordDailyRushComplete(1, '2026-07-01');
    await Promise.all([answerWrite, completionWrite]);

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.todoEventCounts.dailyRushDates[1]).toEqual(['2026-07-01']);
    expect(stored.todoStates['n5-w1-daily-rush'].progress).toBe(1);
  });

  it('h. advances Daily Rush todo progress from distinct card-stage transitions', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    for (const refId of ['advanced-a', 'advanced-b', 'advanced-c']) {
      await store.recordCardStageAdvanced(1, refId, 'memorized');
    }
    await store.recordCardStageAdvanced(1, 'advanced-a', 'recognized');

    const stored = await store.getProgress() as unknown as {
      todoStates: Record<string, TodoState>;
      todoEventCounts: TodoEventCounts;
    };
    expect(stored.todoEventCounts.seenStageAdvancedRefIds[1]).toEqual([
      'advanced-a',
      'advanced-b',
      'advanced-c',
    ]);
    expect(stored.todoStates['n5-w1-daily-rush'].progress).toBe(3);
    expect(stored.todoStates['n5-w1-daily-rush'].target).toBe(7);
  });

  it('i. clamps cumulative stage progress and restores it on cold start', async () => {
    setTodoFeatureEnabled(true);
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    for (let index = 0; index < 10; index += 1) {
      await store.recordCardStageAdvanced(1, `advanced-${index}`, 'memorized');
    }
    expect(store.getExtendedProgress().todoStates['n5-w1-daily-rush'].progress).toBe(7);

    const reloaded = createPracticeProgressStore(repo);
    await reloaded.ready();
    expect(reloaded.getExtendedProgress().todoStates['n5-w1-daily-rush'].progress).toBe(7);
  });
});
