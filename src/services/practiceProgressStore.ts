import type { PersistentLearningRepository } from '../repositories/sqliteLearningRepository';
import { getAllLessons } from './lessonService';
import { buildProgressDashboard } from './progressDashboardService';

export type PracticeProgressStore = ReturnType<typeof createPracticeProgressStore>;

async function getLessonCatalog(repo: PersistentLearningRepository) {
  const persistedLessons = await repo.getLessons();
  return persistedLessons.length ? persistedLessons : getAllLessons();
}

export function createPracticeProgressStore(repo: PersistentLearningRepository) {
  return {
    async completeCurrentLesson(lessonId: string, score: number, date: string) { await repo.saveCompletedLesson(lessonId, score, date); },
    async getDashboard() { return buildProgressDashboard(await repo.getProgress(), await getLessonCatalog(repo)); },
    /**
     * Phase 30 — expose the raw learner progress so screens (e.g. the
     * Lessons screen) can show weekly progress ("3 of 5 done this week")
     * without rebuilding the full dashboard summary on every render.
     */
    async getProgress() { return repo.getProgress(); },
    /** Phase 25 / P0-2: wipe all persisted progress + reset in-memory cache. */
    async reset() { await repo.deleteAllProgress(); },
  };
}
