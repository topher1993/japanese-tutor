export interface QuizScore { lessonId: string; score: number; completedAt: string; }
/**
 * Phase 46 — a single weekly-review completion stamp. `weekIso` is the
 * ISO-8601 week of the stamp (e.g. `'2026-W28'`). See
 * `src/services/weeklyReviewService.ts` for the producer and consumer of
 * these stamps, and JT-CARRY-FORWARD.md §2.1 for the predicate that gates
 * the JLPT N3 badge.
 */
export interface WeeklyReviewCompletion { weekIso: string; }
export interface LearnerProgress {
  startedAt: string;
  completedLessonIds: string[];
  quizScores: QuizScore[];
  streak: StreakState;
  /**
   * Phase 46 — optional for backwards compatibility with saves written
   * before this field existed. Older saves load with `undefined`; new code
   * should coalesce via `progress.weeklyReviewCompletions ?? []` before
   * passing to `consecutiveIsoWeeks`.
   */
  weeklyReviewCompletions?: WeeklyReviewCompletion[];
}
export interface StreakState { currentStreak: number; longestStreak: number; lastStudyDate?: string; }