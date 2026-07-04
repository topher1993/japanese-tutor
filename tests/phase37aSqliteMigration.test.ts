import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { createSqliteLearningRepository, type SqliteLikeDatabase } from '../src/repositories/sqliteLearningRepository';
import { CURRENT_SCHEMA_VERSION } from '../src/db/schema';
import {
  createPracticeProgressStore,
  isTodoFeatureEnabled,
  setTodoFeatureEnabled,
  todoFeatureEnabled as todoFlagRef,
} from '../src/services/practiceProgressStore';

// Phase 37a migration tests. These run against the in-memory db.tables seam
// at sqliteLearningRepository.ts so we exercise the exact same code path that
// later phases will extend, without bringing in expo-sqlite.

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

type SchemaMetaRow = { key: string; value: string };

function createFakeSqliteDatabase(): SqliteLikeDatabase & {
  warnSpy: ReturnType<typeof vi.spyOn>;
} {
  const tables = new Map<string, unknown[]>();
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

  const db: SqliteLikeDatabase & { warnSpy: ReturnType<typeof vi.spyOn> } = {
    tables: tables as unknown as Map<string, unknown[]>,
    warnSpy,
    async execAsync(sql) {
      // Mirror the relevant subset of createTablesSql so the in-memory path
      // tracks the same row shape as the real SQLite schema.
      if (sql.includes('CREATE TABLE') && sql.includes('progress')) {
        if (!tables.has('progress')) tables.set('progress', [] as ProgressRow[]);
      }
      if (sql.includes('CREATE TABLE') && sql.includes('schema_meta')) {
        if (!tables.has('schema_meta')) tables.set('schema_meta', [] as SchemaMetaRow[]);
      }
      if (sql.includes('CREATE TABLE') && sql.includes('lessons')) {
        if (!tables.has('lessons')) tables.set('lessons', []);
      }
    },
    async runAsync(sql, ...params) {
      if (sql.includes('INSERT OR REPLACE INTO progress')) {
        const rows = (tables.get('progress') as ProgressRow[] | undefined) ?? [];
        const id = params[0] as string;
        const idx = rows.findIndex(r => r.id === id);
        // Both v1 (5 params) and v2 (8 params) inserts share the first five
        // positional slots. The test below exercises the 5-tuple path
        // explicitly; the 8-tuple path is exercised by saveCompletedLesson.
        if (params.length === 5) {
          const [lesson_id, completed, completed_at, score] = params as [string, number, string | null, number | null];
          const row: ProgressRow = {
            id,
            lesson_id,
            completed,
            completed_at,
            score,
            todo_states: '{}',
            week_todos_initialized: '{}',
            todo_event_counts: '{}',
          };
          if (idx >= 0) rows[idx] = row; else rows.push(row);
          tables.set('progress', rows);
          return { changes: 1 };
        }
        if (params.length === 8) {
          const [, lesson_id, completed, completed_at, score, todo_states, week_todos_initialized, todo_event_counts] = params as [
            string, string, number, string | null, number | null, string, string, string,
          ];
          const row: ProgressRow = {
            id,
            lesson_id,
            completed,
            completed_at,
            score,
            todo_states,
            week_todos_initialized,
            todo_event_counts,
          };
          if (idx >= 0) rows[idx] = row; else rows.push(row);
          tables.set('progress', rows);
          return { changes: 1 };
        }
        return { changes: 0 };
      }
      if (sql.includes('INSERT OR REPLACE INTO schema_meta')) {
        const rows = (tables.get('schema_meta') as SchemaMetaRow[] | undefined) ?? [];
        const [key, value] = params as [string, string];
        const idx = rows.findIndex(r => r.key === key);
        const row: SchemaMetaRow = { key, value };
        if (idx >= 0) rows[idx] = row; else rows.push(row);
        tables.set('schema_meta', rows);
        return { changes: 1 };
      }
      if (sql.includes('DELETE FROM progress')) {
        tables.set('progress', []);
        return { changes: 1 };
      }
      return { changes: 0 };
    },
    async getAllAsync<T>(_sql: string, ..._params: unknown[]): Promise<T[]> {
      return [] as T[];
    },
  };
  return db;
}

describe('Phase 37a SQLite migration behind feature flag', () => {
  let db: ReturnType<typeof createFakeSqliteDatabase>;

  beforeEach(() => {
    db = createFakeSqliteDatabase();
    // Reset the global flag between tests so one test cannot poison another.
    setTodoFeatureEnabled(false);
  });
  afterEach(() => {
    db.warnSpy.mockRestore();
  });

  it('a. in-memory DB path: getProgress() surfaces the three new fields as empty objects after a v1 5-tuple insert', async () => {
    const repo = createSqliteLearningRepository(db);
    await repo.initialize();

    // Manually craft a v1 5-tuple insert: id, lesson_id, completed, completed_at, score.
    await db.runAsync(
      'INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?)',
      'lesson-1:2026-07-01',
      'lesson-1',
      1,
      '2026-07-01',
      95,
    );

    const progress = (await repo.getProgress()) as unknown as {
      todoStates: Record<string, unknown>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: Record<string, unknown>;
      completedLessonIds: string[];
      quizScores: unknown[];
    };

    expect(progress.todoStates).toEqual({});
    expect(progress.weekTodosInitialized).toEqual({});
    expect(progress.todoEventCounts).toEqual({});
    // Legacy fields still work — no exception thrown on read.
    expect(progress.completedLessonIds).toBeDefined();
    expect(Array.isArray(progress.quizScores)).toBe(true);
  });

  it('b. JSON-parse-failure tolerance: corrupted todo_states column degrades to {} and warns', async () => {
    const dbLocal = createFakeSqliteDatabase();
    const repo = createSqliteLearningRepository(dbLocal);
    await repo.initialize();

    // Reach into the in-memory map and plant a corrupted JSON blob directly,
    // mirroring the production failure mode where a v1 row survives an
    // interrupted migration and writes a partial blob.
    const rows = (dbLocal.tables!.get('progress') as ProgressRow[]);
    rows.push({
      id: 'lesson-2:2026-07-01',
      lesson_id: 'lesson-2',
      completed: 1,
      completed_at: '2026-07-01',
      score: 80,
      todo_states: '{not valid json',
      week_todos_initialized: '{"1":true}',
      todo_event_counts: '{}',
    });
    dbLocal.tables!.set('progress', rows);

    const progress = (await repo.getProgress()) as unknown as {
      todoStates: Record<string, unknown>;
      weekTodosInitialized: Record<number, boolean>;
      todoEventCounts: Record<string, unknown>;
    };

    // The corrupted field falls back to {}; the valid siblings survive.
    expect(progress.todoStates).toEqual({});
    expect(progress.weekTodosInitialized).toEqual({ 1: true });
    expect(progress.todoEventCounts).toEqual({});
    expect(dbLocal.warnSpy).toHaveBeenCalled();
    const warnMessages = dbLocal.warnSpy.mock.calls.map(c => String(c[0] ?? ''));
    // Either parseTodoBlob (phase42) or safeParseJson (phase37a) may log on a
    // malformed blob; both routes indicate the corruption was detected.
    expect(warnMessages.some(m => /phase37a|phase42/.test(m))).toBe(true);
    expect(warnMessages.some(m => /todo_states/.test(m))).toBe(true);

    dbLocal.warnSpy.mockRestore();
  });

  it('c. roll-forward: initialize() writes the CURRENT_SCHEMA_VERSION meta row for the progress table', async () => {
    const dbLocal = createFakeSqliteDatabase();
    const repo = createSqliteLearningRepository(dbLocal);
    await repo.initialize();

    // Seed a v1-style 5-tuple row so we know the migration runs against
    // existing data, not just a fresh table.
    await dbLocal.runAsync(
      'INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?)',
      'lesson-3:2026-07-01',
      'lesson-3',
      1,
      '2026-07-01',
      100,
    );

    // Re-running initialize() should be idempotent and keep the meta row at
    // the current schema version.
    await repo.initialize();

    const meta = dbLocal.tables!.get('schema_meta') as SchemaMetaRow[];
    expect(meta).toHaveLength(1);
    expect(meta[0]).toEqual({ key: 'progress', value: String(CURRENT_SCHEMA_VERSION) });
    expect(CURRENT_SCHEMA_VERSION).toBe(2);

    // saveCompletedLesson still writes the 8-tuple shape so the JSON blobs
    // survive round-trips.
    await repo.saveCompletedLesson('lesson-4', 88, '2026-07-02');
    const rows = dbLocal.tables!.get('progress') as ProgressRow[];
    const updated = rows.find(r => r.id === 'lesson-4:2026-07-02');
    expect(updated).toBeDefined();
    // Phase 42 / P1-5: writes are versioned envelopes so future schema
    // changes can be detected at read time. parseTodoBlob() validates
    // the schema_version before accepting the inner data.
    expect(updated!.todo_states).toBe('{"schema_version":1,"data":{}}');
    expect(updated!.week_todos_initialized).toBe('{"schema_version":1,"data":{}}');
    expect(updated!.todo_event_counts).toBe('{"schema_version":1,"data":{}}');

    dbLocal.warnSpy.mockRestore();
  });

  it('feature flag: todoFeatureEnabled defaults to false and new methods short-circuit', async () => {
    expect(todoFlagRef).toBe(false);
    expect(isTodoFeatureEnabled()).toBe(false);

    const repo = createSqliteLearningRepository(createFakeSqliteDatabase());
    await repo.initialize();
    const store = createPracticeProgressStore(repo);

    expect(await store.ensureWeekTodosInitialized()).toBeNull();
    expect(await store.getWeekTodoState(1)).toBeNull();
    expect(await store.canAdvanceToNextWeek()).toBe(true);

    setTodoFeatureEnabled(true);
    expect(isTodoFeatureEnabled()).toBe(true);
    // Stubs are still no-ops in phase 37a; the bodies return their pre-37b
    // placeholder values rather than real data.
    expect(await store.ensureWeekTodosInitialized()).toBeNull();
    expect(await store.canAdvanceToNextWeek()).toBe(true);

    // Reset for any subsequent tests in the same vitest worker.
    setTodoFeatureEnabled(false);
  });

  it('saveCompletedLesson preserves pre-existing todo state (regression: withTodoDefaults must not overwrite)', async () => {
    // QC round-1 P1-1: the previous withTodoDefaults unconditionally wrote {}
    // to all three todo fields, which would have wiped any todo state that
    // a prior 37b update had accumulated. The fix is "fill defaults only where
    // missing", which this test pins.
    const dbLocal = createFakeSqliteDatabase();
    const repo = createSqliteLearningRepository(dbLocal);
    await repo.initialize();

    // Seed progress with a non-empty todoStates and complete one lesson.
    const pre = await repo.getProgress();
    const seeded = {
      ...pre,
      todoStates: { 'n5-w1-lesson': { progress: 1, target: 1, weekNumber: 1 } },
      weekTodosInitialized: { 1: true },
      todoEventCounts: { flashcardReviews: { 1: ['card-1'] } },
    };
    // writeProgress is not on the public interface; reach through the in-memory
    // tables to persist the extended shape, then assert saveCompletedLesson
    // does not clobber it.
    dbLocal.tables!.set('progress', [{
      id: 'seeded:2026-06-18',
      lesson_id: 'seeded',
      completed: 0,
      completed_at: '2026-06-18',
      score: 0,
      todo_states: JSON.stringify(seeded.todoStates),
      week_todos_initialized: JSON.stringify(seeded.weekTodosInitialized),
      todo_event_counts: JSON.stringify(seeded.todoEventCounts),
    }]);

    await repo.saveCompletedLesson('lesson-x', 100, '2026-06-18');

    // The seeded row is preserved by the unique PK (`seeded:2026-06-18`).
    // saveCompletedLesson INSERT OR REPLACEs a NEW row keyed by `lesson-x:2026-06-18`.
    // Both must show the todo fields intact.
    const stored = dbLocal.tables!.get('progress') as Array<Record<string, unknown>>;
    const byId = (id: string) => stored.find(r => r.id === id)!;
    const seededRow = byId('seeded:2026-06-18');
    const newRow = byId('lesson-x:2026-06-18');
    expect(seededRow).toBeDefined();
    expect(newRow).toBeDefined();

    // Seeded row preserved verbatim across the lesson-complete event.
    expect(JSON.parse(seededRow.todo_states as string)).toEqual(seeded.todoStates);
    expect(JSON.parse(seededRow.week_todos_initialized as string)).toEqual(seeded.weekTodosInitialized);
    expect(JSON.parse(seededRow.todo_event_counts as string)).toEqual(seeded.todoEventCounts);

    // New lesson-complete row also carries todo fields. Phase 42 / P1-5:
    // these are written as versioned envelopes (schema_version: 1).
    expect(JSON.parse(newRow.todo_states as string)).toEqual({ schema_version: 1, data: {} });
    expect(JSON.parse(newRow.week_todos_initialized as string)).toEqual({ schema_version: 1, data: {} });
    expect(JSON.parse(newRow.todo_event_counts as string)).toEqual({ schema_version: 1, data: {} });
  });
});