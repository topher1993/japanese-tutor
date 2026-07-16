import { describe, expect, it } from 'vitest';

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
  weekly_review_completions: string;
};

/**
 * Simulates a fresh install (post-Phase 37): CREATE TABLE IF NOT EXISTS has
 * already created the 9-column progress table. The test asserts that
 * `initialize()` does NOT issue ALTER TABLE SQL (no work to do) and that
 * `saveCompletedLesson` + cold-start `getProgress()` work as expected.
 */
function createFreshInstallDb(): SqliteLikeDatabase & { progressRows: ProgressRow[]; columns: Set<string>; executedSql: string[] } {
  // Fresh install: all 9 columns present from CREATE TABLE IF NOT EXISTS.
  const columns = new Set([
    'id',
    'lesson_id',
    'completed',
    'completed_at',
    'score',
    'todo_states',
    'week_todos_initialized',
    'todo_event_counts',
    'weekly_review_completions',
  ]);
  const progressRows: ProgressRow[] = [];
  const executedSql: string[] = [];

  return {
    progressRows,
    columns,
    executedSql,
    async execAsync(sql: string) {
      executedSql.push(sql);
      // Fresh install should never need ALTER — but if the runner does try,
      // record it so the test can fail loudly.
      const addColumn = sql.match(/ALTER TABLE progress ADD COLUMN\s+(\w+)/i)?.[1];
      if (addColumn) columns.add(addColumn);
    },
    async runAsync(sql: string, ...params: unknown[]) {
      executedSql.push(sql);
      if (/^INSERT OR REPLACE INTO schema_meta/i.test(sql.trim())) {
        return { changes: 1 };
      }
      if (/^INSERT OR REPLACE INTO progress VALUES/i.test(sql.trim())) {
              const [id, lessonId, completed, completedAt, score, todoStates, weekTodosInitialized, todoEventCounts, weeklyReviewCompletions] = params;
              const row: ProgressRow = {
                id: String(id),
                lesson_id: String(lessonId),
                completed: Number(completed),
                completed_at: completedAt == null ? null : String(completedAt),
                score: score == null ? null : Number(score),
                todo_states: String(todoStates),
                week_todos_initialized: String(weekTodosInitialized),
                todo_event_counts: String(todoEventCounts),
                weekly_review_completions: weeklyReviewCompletions == null ? '[]' : String(weeklyReviewCompletions),
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
                todo_states: row.todo_states,
                week_todos_initialized: row.week_todos_initialized,
                todo_event_counts: row.todo_event_counts,
                weekly_review_completions: row.weekly_review_completions,
              }) as T);
            }
      return [];
    },
  };
}

describe('Phase 41 — cold-start new-install migration (no-op path)', () => {
  it('initialize() does NOT issue ALTER TABLE when all 9 columns are already present', async () => {
    const db = createFreshInstallDb();
    const repo = createSqliteLearningRepository(db);

    await repo.initialize();

    const alterCalls = db.executedSql.filter(sql =>
      /ALTER TABLE progress ADD COLUMN/i.test(sql)
    );
    expect(alterCalls).toEqual([]);
    // PRAGMA should have been called to inspect, but no mutation should follow.
    expect(db.executedSql.some(sql => /PRAGMA table_info\(progress\)/i.test(sql))).toBe(true);
  });

  it('saveCompletedLesson works on a fresh install without re-issuing ALTER', async () => {
    const db = createFreshInstallDb();
    const repo = createSqliteLearningRepository(db);

    await repo.initialize();
    await repo.saveCompletedLesson('lesson-fresh-1', 100, '2026-07-04');

    expect(db.progressRows).toHaveLength(1);
    // Phase 42 / P1-5: writes are versioned envelopes.
    expect(db.progressRows[0]).toMatchObject({
      lesson_id: 'lesson-fresh-1',
      completed: 1,
      todo_states: '{"schema_version":1,"data":{}}',
      week_todos_initialized: '{"schema_version":1,"data":{}}',
      todo_event_counts: '{"schema_version":1,"data":{}}',
    });
    // The INSERT itself should be present; ALTERs should remain absent.
    expect(db.executedSql.some(sql => /^INSERT OR REPLACE INTO progress VALUES/i.test(sql.trim()))).toBe(true);
    expect(db.executedSql.filter(sql => /ALTER TABLE progress ADD COLUMN/i.test(sql))).toEqual([]);
  });

  it('cold-start getProgress rehydrates from a fresh-install row written by a previous repo instance', async () => {
    const db = createFreshInstallDb();
    const firstRepo = createSqliteLearningRepository(db);
    await firstRepo.initialize();
    await firstRepo.saveCompletedLesson('lesson-fresh-2', 95, '2026-07-04');

    // Simulate app restart: new repo instance over the same underlying DB.
    const restartedRepo = createSqliteLearningRepository(db);
    await restartedRepo.initialize();

    const progress = await restartedRepo.getProgress();
    expect(progress.completedLessonIds).toContain('lesson-fresh-2');
  });
});
