import type { SenseiLesson } from '../types/lesson';
import type { LearnerProgress } from '../types/progress';

export interface ProgressDashboard {
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  currentStreak: number;
  longestStreak: number;
  averageQuizScore: number;
  nextRecommendedLesson?: SenseiLesson;
}

export function buildProgressDashboard(progress: LearnerProgress, lessons: SenseiLesson[]): ProgressDashboard {
  const validLessonIds = new Set(lessons.map(lesson => lesson.id));
  const completed = new Set(progress.completedLessonIds.filter(id => validLessonIds.has(id)));
  const scores = progress.quizScores.map(score => score.score);
  const averageQuizScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  return {
    completedLessons: completed.size,
    totalLessons: lessons.length,
    completionPercent: lessons.length ? Math.round((completed.size / lessons.length) * 100) : 0,
    currentStreak: progress.streak.currentStreak,
    longestStreak: progress.streak.longestStreak,
    averageQuizScore,
    nextRecommendedLesson: lessons.find(lesson => !completed.has(lesson.id)),
  };
}
