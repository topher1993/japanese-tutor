import { describe, expect, it } from 'vitest';

import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';

type ProgressRow = {
  id: string;
  lesson_id: string;
  completed: number;
  completed_at: string | null;
  score: number | null;
  todo_states?: string;
  week_todos_initialized?: string;
  todo_event_counts?: string;
};

function createLegacyNativeDb(): SqliteLikeDatabase & { progressRows: ProgressRow[]; columns: Set<string>; executedSql: string[] } {
  const columns = new Set(['id', 'lesson_id', 'completed', 'completed_at', 'score']);
  const progressRows: ProgressRow[] = [];
  const executedSql: string[] = [];

  return {
    progressRows,
    columns,
    executedSql,
    async execAsync(sql: string) {
      executedSql.push(sql);
      const addColumn = sql.match(/ALTER TABLE progress ADD COLUMN\s+(\w+)/i)?.[1];
      if (addColumn) {
        columns.add(addColumn);
        for (const row of progressRows) {
          if (addColumn === 'todo_states') row.todo_states = row.todo_states ?? '{}';
          if (addColumn === 'week_todos_initialized') row.week_todos_initialized = row.week_todos_initialized ?? '{}';
          if (addColumn === 'todo_event_counts') row.todo_event_counts = row.todo_event_counts ?? '{}';
        }
      }
    },
    async runAsync(sql: string, ...params: unknown[]) {
      executedSql.push(sql);
      if (/^INSERT OR REPLACE INTO schema_meta/i.test(sql.trim())) {
        return { changes: 1 };
      }
      if (/^INSERT OR REPLACE INTO progress VALUES/i.test(sql.trim())) {
        const required = ['todo_states', 'week_todos_initialized', 'todo_event_counts'];
        const missing = required.filter(column => !columns.has(column));
        if (missing.length > 0) {
          throw new Error(`table progress has no column named ${missing[0]}`);
        }
        const [id, lessonId, completed, completedAt, score, todoStates, weekTodosInitialized, todoEventCounts] = params;
        const row: ProgressRow = {
          id: String(id),
          lesson_id: String(lessonId),
          completed: Number(completed),
          completed_at: completedAt == null ? null : String(completedAt),
          score: score == null ? null : Number(score),
          todo_states: String(todoStates),
          week_todos_initialized: String(weekTodosInitialized),
          todo_event_counts: String(todoEventCounts),
        };
        const idx = progressRows.findIndex(existing => existing.id === row.id);
        if (idx >= 0) progressRows[idx] = row;
        else progressRows.push(row);
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    async getAllAsync<T>(sql: string): Promise<T[]> {
      executedSql.push(sql);
      if (/PRAGMA table_info\(progress\)/i.test(sql)) {
        return Array.from(columns).map(name => ({ name }) as T);
      }
      if (/FROM progress/i.test(sql)) {
        return progressRows.map(row => ({
          lesson_id: row.lesson_id,
          completed: row.completed,
          completed_at: row.completed_at,
          score: row.score,
          todo_states: row.todo_states ?? '{}',
          week_todos_initialized: row.week_todos_initialized ?? '{}',
          todo_event_counts: row.todo_event_counts ?? '{}',
        }) as T);
      }
      return [];
    },
  };
}

describe('Phase 40 — native progress schema migration', () => {
  it('initialize() ALTERs legacy 5-column progress tables before lesson completion writes', async () => {
    const db = createLegacyNativeDb();
    const repo = createSqliteLearningRepository(db);

    await repo.initialize();
    await repo.saveCompletedLesson('lesson-schedule-time', 100, '2026-07-01');

    expect(db.columns.has('todo_states')).toBe(true);
    expect(db.columns.has('week_todos_initialized')).toBe(true);
    expect(db.columns.has('todo_event_counts')).toBe(true);
    expect(db.executedSql.some(sql => /ALTER TABLE progress ADD COLUMN todo_states/i.test(sql))).toBe(true);
    expect(db.progressRows).toHaveLength(1);
    // Phase 42 / P1-5: writes are versioned envelopes.
    expect(db.progressRows[0]).toMatchObject({
      lesson_id: 'lesson-schedule-time',
      completed: 1,
      todo_states: '{"schema_version":1,"data":{}}',
      week_todos_initialized: '{"schema_version":1,"data":{}}',
      todo_event_counts: '{"schema_version":1,"data":{}}',
    });
  });

  it('native getProgress() rehydrates completedLessonIds from persisted progress rows', async () => {
    const db = createLegacyNativeDb();
    const repo = createSqliteLearningRepository(db);

    await repo.initialize();
    await repo.saveCompletedLesson('lesson-schedule-time', 100, '2026-07-01');

    // New repo over the same native DB shape simulates app cold start.
    const repoAfterRestart = createSqliteLearningRepository(db);
    await repoAfterRestart.initialize();
    const progress = await repoAfterRestart.getProgress();

    expect(progress.completedLessonIds).toContain('lesson-schedule-time');
  });
});
