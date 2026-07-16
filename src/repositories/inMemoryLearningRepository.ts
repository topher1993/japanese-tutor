import type { LessonCategory, SenseiLesson } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';
import { completeLesson, createInitialProgress } from '../services/progressService';
import { localDateKey } from '../utils/localDate';
export interface LearningRepository {
  saveLessons(lessons: SenseiLesson[]): Promise<void>;
  getLessons(): Promise<SenseiLesson[]>;
  findLessonsByCategory(category: LessonCategory): Promise<SenseiLesson[]>;
  saveCompletedLesson(lessonId: string, score: number, date: string): Promise<void>;
  getProgress(): Promise<LearnerProgress>;
  /** Phase 25 / P0-2: wipe every persisted lesson-completion + reset progress to initial state. */
  deleteAllProgress(): Promise<void>;
}
export function createInMemoryLearningRepository(): LearningRepository {
  let lessons: SenseiLesson[] = [];
  let progress = createInitialProgress(localDateKey());
  return {
    async saveLessons(next) { lessons = [...next]; },
    async getLessons() { return lessons; },
    async findLessonsByCategory(category) { return lessons.filter(lesson => lesson.category === category); },
    async saveCompletedLesson(lessonId, score, date) { progress = completeLesson(progress, lessonId, score, date); },
    async getProgress() { return progress; },
    async deleteAllProgress() { progress = createInitialProgress(localDateKey()); },
  };
}
