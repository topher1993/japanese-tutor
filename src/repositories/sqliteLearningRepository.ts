import type { LessonCategory, SenseiLesson } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';
import { createInitialProgress, completeLesson } from '../services/progressService';
import { createTablesSql, CURRENT_SCHEMA_VERSION } from '../db/schema';

export interface SqliteLikeDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: unknown[]): Promise<{ changes?: number }>;
  getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  tables?: Map<string, unknown[]>;
}

export interface PersistentLearningRepository {
  initialize(): Promise<void>;
  saveLessons(lessons: SenseiLesson[]): Promise<void>;
  getLessons(): Promise<SenseiLesson[]>;
  findLessonsByCategory(category: LessonCategory): Promise<SenseiLesson[]>;
  saveCompletedLesson(lessonId: string, score: number, date: string): Promise<void>;
  getProgress(): Promise<LearnerProgress>;
  /** Phase 25 / P0-2: wipe every persisted lesson-completion + reset progress to initial state. */
  deleteAllProgress(): Promise<void>;
  /**
   * Phase 37b (additive — does not change any signature above): persist the
   * three todo JSON-blob fields without creating a new lesson-completion row.
   * Writes to the most recent progress row if one exists, otherwise appends a
   * synthetic placeholder row. Used by `practiceProgressStore` after
   * `recomputeTodoStatesForWeek` to flush the recomputed state to disk so the
   * next `getProgress()` (after a cold start, for example) sees it.
   */
  saveExtendedProgress?(snapshot: ExtendedLearnerProgress): Promise<void>;
}

// Phase 37a: the three new JSON-blob fields attached to LearnerProgress for
// weekly-todo gating. They live as optional fields on the extended view because
// `src/types/progress.ts` is owned by an earlier phase and we cannot widen it
// from here; consumers should treat them as `Record<string, unknown>` /
// `Record<number, boolean>` per the proposal §3.3 contract.
export interface TodoStateMap { [todoId: string]: unknown; }
export interface WeekTodosInitializedMap { [weekNumber: number]: boolean; }
export interface TodoEventCountsMap { [eventKey: string]: unknown; }

export interface ExtendedLearnerProgress extends LearnerProgress {
  todoStates: TodoStateMap;
  weekTodosInitialized: WeekTodosInitializedMap;
  todoEventCounts: TodoEventCountsMap;
}

const SCHEMA_META_KEY_PROGRESS = 'progress';

type ProgressSqlRow = Record<string, unknown>;

const PROGRESS_TODO_COLUMNS = [
  { name: 'todo_states', sql: "ALTER TABLE progress ADD COLUMN todo_states TEXT NOT NULL DEFAULT '{}'" },
  { name: 'week_todos_initialized', sql: "ALTER TABLE progress ADD COLUMN week_todos_initialized TEXT NOT NULL DEFAULT '{}'" },
  { name: 'todo_event_counts', sql: "ALTER TABLE progress ADD COLUMN todo_event_counts TEXT NOT NULL DEFAULT '{}'" },
] as const;

// Safe JSON parse: returns the provided fallback on any parse error and warns.
// Per the Phase 37a work card P0-1, parse failures must NEVER throw — they
// degrade to an empty object so the rest of the app keeps working.
function safeParseJson<T>(raw: unknown, fallback: T, warnContext: string): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return fallback;
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed == null ? fallback : parsed;
  } catch (error) {
    if (__DEV__) console.warn(`[phase37a] failed to parse ${warnContext}; falling back to ${JSON.stringify(fallback)}`, error);
    return fallback;
  }
}

// Apply empty defaults for the three todo JSON-blob fields added in Phase 37a
// WITHOUT overwriting any values that already exist on the input. The function
// name is misleading if you read it as "force defaults" — it is actually
// "fill in defaults only where missing". This matters for saveCompletedLesson,
// which calls withTodoDefaults(completeLesson(...)) on every lesson completion:
// a prior 37b todo-update path must not be wiped by a subsequent lesson-complete
// event. The QC round-1 finding flagged this; the spread below preserves truthy
// values and only fills in `{}` when a field is undefined.
//
// Note: `LearnerProgress` itself does not declare the todo fields yet — that
// widening belongs to phase 37b when the todo service is introduced. Until then,
// callers that pass an extended shape (which only this repo does) preserve their
// values via the cast below; callers that pass the plain v1 shape get the
// default `{}` per field, matching the previous behaviour.
function withTodoDefaults(progress: LearnerProgress): ExtendedLearnerProgress {
  const extended = progress as ExtendedLearnerProgress;
  return {
    ...progress,
    todoStates: extended.todoStates ?? {},
    weekTodosInitialized: extended.weekTodosInitialized ?? {},
    todoEventCounts: extended.todoEventCounts ?? {},
  };
}

export function createSqliteLearningRepository(db: SqliteLikeDatabase): PersistentLearningRepository {
  let lessonsCache: SenseiLesson[] = [];
  let progressCache: ExtendedLearnerProgress = withTodoDefaults(createInitialProgress('2026-06-18'));
  const memoryTables = db.tables;

  async function readSchemaVersion(tableKey: string): Promise<number> {
    if (!memoryTables) return 1; // native path always reads via SQL — handled below by caller's getAllAsync
    const rows = (memoryTables.get('schema_meta') ?? []) as Array<{ key: string; value: string }>;
    const row = rows.find(r => r.key === tableKey);
    if (!row) return 1;
    const parsed = Number.parseInt(row.value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  async function writeSchemaVersion(tableKey: string, version: number): Promise<void> {
    if (memoryTables) {
      const rows = (memoryTables.get('schema_meta') ?? []) as Array<{ key: string; value: string }>;
      const idx = rows.findIndex(r => r.key === tableKey);
      const row = { key: tableKey, value: String(version) };
      if (idx >= 0) rows[idx] = row; else rows.push(row);
      memoryTables.set('schema_meta', rows);
    }
    await db.runAsync('INSERT OR REPLACE INTO schema_meta VALUES (?, ?)', tableKey, String(version));
  }

  function hydrateProgressFromRows(rows: ProgressSqlRow[]): void {
    if (rows.length === 0) return;
    const completedLessonIds: string[] = [];
    for (const row of rows) {
      const isCompleted = Number(row.completed ?? 0) === 1;
      const lessonId = (row.lesson_id ?? row.lessonId) as string | undefined;
      if (isCompleted && lessonId && !completedLessonIds.includes(lessonId)) {
        completedLessonIds.push(lessonId);
      }
    }
    let lastRealRow: ProgressSqlRow | null = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (Number(rows[i].completed ?? 0) === 1) {
        lastRealRow = rows[i];
        break;
      }
    }
    const row = lastRealRow ?? rows[rows.length - 1];
    const newProgressCache = {
      ...progressCache,
      completedLessonIds,
      todoStates: safeParseJson<TodoStateMap>(row.todo_states ?? row.todoStates, {}, 'progress.todo_states'),
      weekTodosInitialized: safeParseJson<WeekTodosInitializedMap>(row.week_todos_initialized ?? row.weekTodosInitialized, {}, 'progress.week_todos_initialized'),
      todoEventCounts: safeParseJson<TodoEventCountsMap>(row.todo_event_counts ?? row.todoEventCounts, {}, 'progress.todo_event_counts'),
    };
    if (lastRealRow !== null || completedLessonIds.length > 0) {
      progressCache = newProgressCache;
    }
  }

  async function migrateProgressTodoColumns(): Promise<void> {
    if (memoryTables) return;
    try {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(progress)');
      const names = new Set(columns.map(column => column.name));
      for (const column of PROGRESS_TODO_COLUMNS) {
        if (!names.has(column.name)) {
          await db.execAsync(column.sql);
        }
      }
    } catch (err) {
      if (__DEV__) console.warn('[sqliteLearningRepository] failed to migrate progress todo columns', err);
    }
  }

  return {
    async initialize() {
      for (const sql of createTablesSql) await db.execAsync(sql);
      if (memoryTables && !memoryTables.has('lessons')) memoryTables.set('lessons', []);
      if (memoryTables && !memoryTables.has('progress_events')) memoryTables.set('progress_events', []);
      if (memoryTables && !memoryTables.has('schema_meta')) memoryTables.set('schema_meta', []);

      // Phase 40 native bugfix: existing phone installs can already have the
      // legacy 5-column progress table. CREATE TABLE IF NOT EXISTS will not add
      // Phase-37 todo columns, and the 8-value insert then fails inside
      // NativeDatabase.prepareAsync. Explicitly ALTER missing columns first.
      await migrateProgressTodoColumns();

      // Phase 37a migration: record CURRENT_SCHEMA_VERSION for the progress
      // table on first run. v1 rows already in the DB keep working because the
      // CREATE TABLE statement above defaults the new columns to '{}'.
      const existing = await readSchemaVersion(SCHEMA_META_KEY_PROGRESS);
      if (existing < CURRENT_SCHEMA_VERSION) {
        await writeSchemaVersion(SCHEMA_META_KEY_PROGRESS, CURRENT_SCHEMA_VERSION);
      }
    },
    async saveLessons(lessons) {
      lessonsCache = [...lessons];
      if (memoryTables) memoryTables.set('lessons', lessonsCache);
      for (const lesson of lessons) await db.runAsync('INSERT OR REPLACE INTO lessons VALUES (?, ?, ?, ?, ?, ?, ?, ?)', lesson.id, lesson.title, lesson.category, lesson.level, lesson.week, lesson.day, lesson.summary, new Date().toISOString());
    },
    async getLessons() {
      if (memoryTables?.has('lessons')) return [...(memoryTables.get('lessons') as SenseiLesson[])];
      const rows = await db.getAllAsync<SenseiLesson>('SELECT * FROM lessons ORDER BY week, day');
      return rows.length ? rows : lessonsCache;
    },
    async findLessonsByCategory(category) { return (await this.getLessons()).filter(lesson => lesson.category === category); },
    async saveCompletedLesson(lessonId, score, date) {
      progressCache = withTodoDefaults(completeLesson(progressCache, lessonId, score, date));
      if (memoryTables) memoryTables.set('progress_events', progressCache.quizScores);
      // Phase 37a: 5-tuple → 8-tuple. The three new JSON-blob columns are
      // populated from progressCache so any caller that reads them back via
      // getProgress() sees the same values.
      const todoStates = JSON.stringify(progressCache.todoStates ?? {});
      const weekTodosInitialized = JSON.stringify(progressCache.weekTodosInitialized ?? {});
      const todoEventCounts = JSON.stringify(progressCache.todoEventCounts ?? {});
      await db.runAsync(
        'INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        `${lessonId}:${date}`,
        lessonId,
        1,
        date,
        score,
        todoStates,
        weekTodosInitialized,
        todoEventCounts,
      );
    },
    async getProgress() {
      // Phase 40 native parity: use the same persisted-row hydration for the
      // in-memory test seam and native SQLite. Before this, native cold starts
      // returned only the empty in-memory cache, while tests passed through
      // `db.tables`.
      if (memoryTables?.has('progress')) {
        hydrateProgressFromRows((memoryTables.get('progress') as ProgressSqlRow[] | undefined) ?? []);
      } else if (!memoryTables) {
        const rows = await db.getAllAsync<ProgressSqlRow>(
          'SELECT lesson_id, completed, completed_at, score, todo_states, week_todos_initialized, todo_event_counts FROM progress ORDER BY rowid ASC',
        );
        hydrateProgressFromRows(rows);
      }
      return progressCache;
    },
    async deleteAllProgress() {
      // Native: DROP + recreate the progress table so indexes and FKs reset
      // cleanly. In-memory mirror is also wiped via createInitialProgress().
      progressCache = withTodoDefaults(createInitialProgress('2026-06-18'));
      if (memoryTables) memoryTables.set('progress_events', []);
      try {
        await db.runAsync('DELETE FROM progress');
      } catch {
        // Table may not exist yet (fresh install) — recreate defensively.
        for (const sql of createTablesSql) await db.execAsync(sql);
      }
    },
    async saveExtendedProgress(snapshot: ExtendedLearnerProgress) {
      // Phase 37b: persist the three todo JSON-blob fields without creating a
      // new lesson-completion row. Strategy:
      //   - Update the in-memory progressCache so the next getProgress() in
      //     this session returns the new todo state.
      //   - In the test in-memory path: append (or update last) a row in the
      //     `progress` table mirroring the existing 8-tuple shape, with the
      //     recomputed todo blobs. This is what 37c's smoke test reads back.
      //   - In the native SQLite path: best-effort UPDATE of the most recent
      //     progress row by rowid. If no row exists (fresh learner, never
      //     completed a lesson) we create a synthetic placeholder so the blobs
      //     are persisted.
      progressCache = withTodoDefaults(snapshot);
      const todoStates = JSON.stringify(snapshot.todoStates ?? {});
      const weekTodosInitialized = JSON.stringify(snapshot.weekTodosInitialized ?? {});
      const todoEventCounts = JSON.stringify(snapshot.todoEventCounts ?? {});

      if (memoryTables) {
        const rows = (memoryTables.get('progress') ?? []) as Array<Record<string, unknown>>;
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          rows[rows.length - 1] = {
            ...last,
            todo_states: todoStates,
            week_todos_initialized: weekTodosInitialized,
            todo_event_counts: todoEventCounts,
          };
          memoryTables.set('progress', rows);
        } else {
          rows.push({
            id: 'todo-snapshot',
            lesson_id: '',
            completed: 0,
            completed_at: null,
            score: null,
            todo_states: todoStates,
            week_todos_initialized: weekTodosInitialized,
            todo_event_counts: todoEventCounts,
          });
          memoryTables.set('progress', rows);
        }
      }

      try {
        await db.runAsync(
          'UPDATE progress SET todo_states = ?, week_todos_initialized = ?, todo_event_counts = ? WHERE rowid = (SELECT MAX(rowid) FROM progress)',
          todoStates,
          weekTodosInitialized,
          todoEventCounts,
        );
      } catch {
        // No progress row exists yet — create a synthetic one so the blobs
        // survive the next getProgress() read.
        await db.runAsync(
          'INSERT INTO progress (id, lesson_id, completed, completed_at, score, todo_states, week_todos_initialized, todo_event_counts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          'todo-snapshot',
          '',
          0,
          null,
          null,
          todoStates,
          weekTodosInitialized,
          todoEventCounts,
        );
      }
    },
  };
}
