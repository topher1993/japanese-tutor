import type { LearnerProgress, StreakState } from '../types/progress';

function toDay(date: string): number { return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86_400_000); }

export function createInitialProgress(startedAt: string): LearnerProgress {
  return { startedAt, completedLessonIds: [], quizScores: [], streak: { currentStreak: 0, longestStreak: 0 } };
}

export function calculateNextStreak(previous: StreakState, studyDate: string): StreakState {
  if (!previous.lastStudyDate) return { currentStreak: 1, longestStreak: Math.max(1, previous.longestStreak), lastStudyDate: studyDate };
  const gap = toDay(studyDate) - toDay(previous.lastStudyDate);
  const currentStreak = gap === 0 ? previous.currentStreak : gap === 1 ? previous.currentStreak + 1 : 1;
  return { currentStreak, longestStreak: Math.max(previous.longestStreak, currentStreak), lastStudyDate: studyDate };
}

export function completeLesson(progress: LearnerProgress, lessonId: string, score: number, completedAt: string): LearnerProgress {
  const completedLessonIds = progress.completedLessonIds.includes(lessonId) ? progress.completedLessonIds : [...progress.completedLessonIds, lessonId];
  return { ...progress, completedLessonIds, quizScores: [...progress.quizScores, { lessonId, score, completedAt }], streak: calculateNextStreak(progress.streak, completedAt) };
}
