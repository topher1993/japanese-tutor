import type { LearnerProgress } from '../types/progress';
import type { PlacementLevel } from './placementTestService';
import { getPhraseLessons } from './lessonService';
import { buildLessonInteractionPath } from './lessonInteractionPathService';

const EMPTY_PROGRESS: LearnerProgress = {
  startedAt: '',
  completedLessonIds: [],
  quizScores: [],
  streak: { currentStreak: 0, longestStreak: 0 },
};

/** Resolve the phrase-curriculum week that should receive study activity. */
export function resolveActivePhraseWeek(
  progress: LearnerProgress | null | undefined,
  placementLevel?: PlacementLevel | null,
): number {
  const path = buildLessonInteractionPath(
    getPhraseLessons(),
    progress ?? EMPTY_PROGRESS,
    placementLevel,
  );
  return path.currentLesson?.week ?? path.currentWeek.week ?? 1;
}
