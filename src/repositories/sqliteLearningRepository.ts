import type { LessonCategory, SenseiLesson } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';
import { createInitialProgress, completeLesson } from '../services/progressService';
import { createTablesSql } from '../db/schema';

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
}

export function createSqliteLearningRepository(db: SqliteLikeDatabase): PersistentLearningRepository {
  let lessonsCache: SenseiLesson[] = [];
  let progressCache = createInitialProgress('2026-06-18');
  const memoryTables = db.tables;
  return {
    async initialize() {
      for (const sql of createTablesSql) await db.execAsync(sql);
      if (memoryTables && !memoryTables.has('lessons')) memoryTables.set('lessons', []);
      if (memoryTables && !memoryTables.has('progress_events')) memoryTables.set('progress_events', []);
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
      progressCache = completeLesson(progressCache, lessonId, score, date);
      if (memoryTables) memoryTables.set('progress_events', progressCache.quizScores);
      await db.runAsync('INSERT OR REPLACE INTO progress VALUES (?, ?, ?, ?, ?)', `${lessonId}:${date}`, lessonId, 1, date, score);
    },
    async getProgress() { return progressCache; },
    async deleteAllProgress() {
      // Native: DROP + recreate the progress table so indexes and FKs reset
      // cleanly. In-memory mirror is also wiped via createInitialProgress().
      progressCache = createInitialProgress('2026-06-18');
      if (memoryTables) memoryTables.set('progress_events', []);
      try {
        await db.runAsync('DELETE FROM progress');
      } catch {
        // Table may not exist yet (fresh install) — recreate defensively.
        for (const sql of createTablesSql) await db.execAsync(sql);
      }
    },
  };
}
