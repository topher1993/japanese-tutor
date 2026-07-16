import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';

type ProgressRow = {
  id: string;
  lesson_id: string;
  completed: number;
  completed_at: string | null;
  score: number | null;
  todo_states: string;
  week_todos_initialized: string;
  todo_event_counts: string;
};

function createInMemoryDb(): SqliteLikeDatabase & { rows: ProgressRow[]; executedSql: string[] } {
  const rows: ProgressRow[] = [];
  const executedSql: string[] = [];
  const tables = new Map<string, unknown[]>();
  tables.set('progress', rows);

  return {
    rows,
    executedSql,
    tables: tables as unknown as Map<string, unknown[]>,
    async execAsync(sql) {
      executedSql.push(sql);
    },
    async runAsync(sql, ...params) {
      executedSql.push(sql);
      if (/INSERT OR REPLACE INTO schema_meta/i.test(sql.trim())) return { changes: 1 };
      if (/^INSERT OR REPLACE INTO progress/i.test(sql.trim())) {
        const [id, lessonId, completed, completedAt, score, todoStates, weekTodosInitialized, todoEventCounts] = params as [
          string, string, number, string | null, number | null, string, string, string,
        ];
        const row: ProgressRow = {
          id: String(id), lesson_id: String(lessonId), completed: Number(completed),
          completed_at: completedAt == null ? null : String(completedAt),
          score: score == null ? null : Number(score),
          todo_states: String(todoStates),
          week_todos_initialized: String(weekTodosInitialized),
          todo_event_counts: String(todoEventCounts),
        };
        const idx = rows.findIndex(r => r.id === row.id);
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        return { changes: 1 };
      }
      if (/^INSERT INTO progress/i.test(sql.trim())) {
        // saveExtendedProgress synthetic placeholder insert
        const [id, lessonId, completed, completedAt, score, todoStates, weekTodosInitialized, todoEventCounts] = params as [
          string, string, number, string | null, number | null, string, string, string,
        ];
        const row: ProgressRow = {
          id: String(id), lesson_id: String(lessonId), completed: Number(completed),
          completed_at: completedAt == null ? null : String(completedAt),
          score: score == null ? null : Number(score),
          todo_states: String(todoStates),
          week_todos_initialized: String(weekTodosInitialized),
          todo_event_counts: String(todoEventCounts),
        };
        const idx = rows.findIndex(r => r.id === row.id);
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        return { changes: 1 };
      }
      if (/UPDATE progress SET todo_states/i.test(sql.trim())) {
        // saveExtendedProgress: update the last row's blobs
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          last.todo_states = String(params[0]);
          last.week_todos_initialized = String(params[1]);
          last.todo_event_counts = String(params[2]);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (/DELETE FROM progress/i.test(sql.trim())) {
        rows.length = 0;
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      executedSql.push(sql);
      if (/FROM progress/i.test(sql)) {
        return rows.map(r => ({
          lesson_id: r.lesson_id, completed: r.completed, completed_at: r.completed_at, score: r.score,
          todo_states: r.todo_states, week_todos_initialized: r.week_todos_initialized, todo_event_counts: r.todo_event_counts,
        }) as unknown as T);
      }
      return [];
    },
  };
}

describe('Phase 42 — todo blob schema-version envelope', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('writes new todo blobs as versioned envelopes (schema_version: 1)', async () => {
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    await repo.saveCompletedLesson('lesson-a', 100, '2026-07-04');

    const row = db.rows[0];
    expect(row).toBeDefined();
    for (const col of ['todo_states', 'week_todos_initialized', 'todo_event_counts'] as const) {
      const parsed = JSON.parse(row[col]);
      expect(parsed).toHaveProperty('schema_version', 1);
      expect(parsed).toHaveProperty('data');
      expect(parsed.data).toEqual({});
    }
  });

  it('reads v1 (legacy) raw-map blobs without an envelope — backwards compatible', async () => {
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();

    // Plant a v1-shape row directly (no envelope, plain map)
    db.rows.push({
      id: 'legacy:2026-07-04',
      lesson_id: 'legacy',
      completed: 1,
      completed_at: '2026-07-04',
      score: 95,
      todo_states: '{"n5-w1-lessons":{"progress":3,"target":3,"weekNumber":1}}',
      week_todos_initialized: '{"1":true,"2":true}',
      todo_event_counts: '{"flashcardReviews":{"1":["card-a","card-b"]}}',
    });

    const progress = (await repo.getProgress()) as unknown as {
      todoStates: Record<string, unknown>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: Record<string, unknown>;
    };

    // Legacy v1 data is read as-is — no fallback to {}.
    expect(progress.todoStates).toEqual({ 'n5-w1-lessons': { progress: 3, target: 3, weekNumber: 1 } });
    expect(progress.weekTodosInitialized).toEqual({ 1: true, 2: true });
    expect(progress.todoEventCounts).toEqual({ flashcardReviews: { 1: ['card-a', 'card-b'] } });
  });

  it('rejects blobs with a future schema_version, falling back to empty default', async () => {
    const db = createInMemoryDb();
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();

    // Plant a v3-shape blob (forward-compat scenario)
    db.rows.push({
      id: 'future:2026-07-04',
      lesson_id: 'future',
      completed: 1,
      completed_at: '2026-07-04',
      score: 95,
      todo_states: '{"schema_version":99,"data":{"future":true}}',
      week_todos_initialized: '{"1":true}',
      todo_event_counts: '{}',
    });

    const progress = (await repo.getProgress()) as unknown as {
      todoStates: Record<string, unknown>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: Record<string, unknown>;
    };

    // Mismatched schema_version resets the affected field to default;
    // sibling fields (in this case weekTodosInitialized) are still parsed
    // correctly because each blob is validated independently.
    expect(progress.todoStates).toEqual({});
    expect(progress.todoEventCounts).toEqual({});
    // weekTodosInitialized is v1 (no envelope) so it's accepted as-is
    expect(progress.weekTodosInitialized).toEqual({ 1: true });

    // The mismatch produced a warning that identifies the field and the version
    const warnMessages = warnSpy.mock.calls.map((c: unknown[]) => String(c[0] ?? ''));
    expect(warnMessages.some((m: string) => m.includes('progress.todo_states') && m.includes('99'))).toBe(true);
  });

  it('round-trips a populated todo blob across save + cold-start', async () => {
    const db1 = createInMemoryDb();
    const repo1 = createSqliteLearningRepository(db1);
    await repo1.initialize();

    // First seed a real completed lesson so saveExtendedProgress has a
    // row with completed=1 to update (matches production flow: complete
    // a lesson before the todo service runs).
    await repo1.saveCompletedLesson('lesson-z', 100, '2026-07-04');

    // Then saveExtendedProgress with non-empty todo data
    const snapshot = {
      completedLessonIds: ['lesson-z'],
      quizScores: [],
      dailyRushDates: [],
      todos: { 'n5-w1-quiz': { todoId: 'n5-w1-quiz', weekNumber: 1, progress: 5, target: 5 } },
      todoStates: { 'n5-w1-quiz': { todoId: 'n5-w1-quiz', weekNumber: 1, progress: 5, target: 5, completedAt: 1700000000000 } },
      weekTodosInitialized: { 1: true, 2: false },
      todoEventCounts: { flashcardReviews: { 1: ['c1', 'c2', 'c3'] }, quizAttempts: { 1: 95 } },
    };
    await repo1.saveExtendedProgress!(snapshot as never);

    // Cold start: fresh repo over the same underlying DB
    const db2 = createInMemoryDb();
    db2.rows.push(...db1.rows);
    const repo2 = createSqliteLearningRepository(db2);
    await repo2.initialize();
    const restored = (await repo2.getProgress()) as unknown as {
      todoStates: Record<string, unknown>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: Record<string, unknown>;
    };

    expect(restored.todoStates).toEqual(snapshot.todoStates);
    expect(restored.weekTodosInitialized).toEqual(snapshot.weekTodosInitialized);
    expect(restored.todoEventCounts).toEqual(snapshot.todoEventCounts);
  });

  it('persists and hydrates a todo-only snapshot before any lesson is completed', async () => {
    const db = createInMemoryDb();
    delete db.tables; // exercise the native SQLite path (UPDATE changes=0)
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();
    const snapshot = {
      startedAt: '2026-07-10',
      completedLessonIds: [],
      quizScores: [],
      streak: { currentStreak: 0, longestStreak: 0 },
      todoStates: { 'n5-w1-daily-rush': { todoId: 'n5-w1-daily-rush', weekNumber: 1, progress: 1, target: 1 } },
      weekTodosInitialized: { 1: true },
      todoEventCounts: { dailyRushDates: { 1: ['2026-07-10'] } },
      weeklyReviewCompletions: [],
    };

    await repo.saveExtendedProgress!(snapshot as never);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].completed).toBe(0);

    const coldRepo = createSqliteLearningRepository(db);
    await coldRepo.initialize();
    const restored = await coldRepo.getProgress() as unknown as typeof snapshot;
    expect(restored.completedLessonIds).toEqual([]);
    expect(restored.todoStates['n5-w1-daily-rush']).toMatchObject({ progress: 1, target: 1 });
    expect(restored.todoEventCounts).toEqual(snapshot.todoEventCounts);
  });
});
