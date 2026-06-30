import type { PersistentLearningRepository } from '../repositories/sqliteLearningRepository';
import { getAllLessons } from './lessonService';
import { buildProgressDashboard } from './progressDashboardService';

export type PracticeProgressStore = ReturnType<typeof createPracticeProgressStore>;

// Phase 37a (P1-4 fix): the weekly-todo gate is OFF by default until phase
// 37c wires the UI. Both `createPracticeProgressStore` and `LessonsScreen`
// need to read this same flag, so it is exported as a named binding rather
// than buried inside the factory closure. Mutate via setTodoFeatureEnabled()
// — the store rebuilds its own derived state lazily on the next call.
export let todoFeatureEnabled = false;
export function setTodoFeatureEnabled(next: boolean): void {
  todoFeatureEnabled = next;
}
export function isTodoFeatureEnabled(): boolean {
  return todoFeatureEnabled;
}

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

    // -------------------------------------------------------------------
    // Phase 37a stubs. These are no-ops while todoFeatureEnabled is false.
    // Phase 37b will replace the bodies with the real weeklyTodoService
    // calls; phase 37c will flip todoFeatureEnabled to true.
    // -------------------------------------------------------------------

    /** Phase 37a stub. Phase 37b will seed the current week's todos. */
    async ensureWeekTodosInitialized() {
      if (!todoFeatureEnabled) return null;
      // Phase 37b: call weeklyTodoService.ensureSeeded(weekNumber, progress).
      return null;
    },

    /** Phase 37a stub. Phase 37b will compute per-todo completion. */
    async getWeekTodoState(_weekNumber: number) {
      if (!todoFeatureEnabled) return null;
      // Phase 37b: return weeklyTodoService.computeState(weekNumber, progress).
      return null;
    },

    /** Phase 37a stub. Phase 37b will return the gate verdict (allDone / canAdvance). */
    async canAdvanceToNextWeek() {
      if (!todoFeatureEnabled) return true;
      // Phase 37b: return weeklyTodoService.canAdvance(progress).
      return true;
    },
  };
}