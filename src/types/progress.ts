export interface QuizScore { lessonId: string; score: number; completedAt: string; }
export interface LearnerProgress { startedAt: string; completedLessonIds: string[]; quizScores: QuizScore[]; streak: StreakState; }
export interface StreakState { currentStreak: number; longestStreak: number; lastStudyDate?: string; }
