import type { UserProfile } from '../../../types/userProfile';
import type { LearnerProgress, QuizScore } from '../../../types/progress';
import type { TodoEventCounts } from '../../../types/weeklyTodo';
import type { KoiLearningSummary } from '../api/gateway';
import { KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION } from '../data';

export interface KoiLearningSummaryInput {
  revision: number;
  dueCount: number;
  progress: LearnerProgress;
  events: Partial<TodoEventCounts>;
  profile: UserProfile | null;
  now?: number;
}

const clampInteger = (value: number, minimum: number, maximum: number): number => (
  Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? Math.floor(value) : minimum))
);

function validScores(scores: readonly QuizScore[]): QuizScore[] {
  return scores.filter(score => (
    typeof score.lessonId === 'string'
    && score.lessonId.trim().length >= 1
    && score.lessonId.length <= 160
    && Number.isFinite(score.score)
  ));
}

function recentActiveDays(
  progress: LearnerProgress,
  events: Partial<TodoEventCounts>,
  now: number,
): number {
  const dayMs = 24 * 60 * 60 * 1_000;
  const cutoff = now - (29 * dayMs);
  const activeDates = new Set<string>();
  const addDate = (value: string | undefined) => {
    if (!value) return;
    const dateKey = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
    const timestamp = Date.parse(`${dateKey}T00:00:00.000Z`);
    if (Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now + dayMs) activeDates.add(dateKey);
  };
  Object.keys(events.dailyActivity ?? {}).forEach(addDate);
  progress.quizScores.forEach(score => addDate(score.completedAt));
  addDate(progress.streak.lastStudyDate);
  return Math.min(30, activeDates.size);
}

function placementLevel(profile: UserProfile | null): 'N5' | 'N4' | 'N3' | undefined {
  const placement = profile?.dynamic.placement?.level;
  if (placement === 'N4' || placement === 'N3') return placement;
  if (placement === 'N5' || placement === 'absolute-beginner') return 'N5';
  if (placement === 'N3-or-above') return 'N3';
  return undefined;
}

/**
 * Builds the deliberately bounded, prompt-free summary approved by the
 * detailed-progress toggle. It never includes quiz answers, lesson text,
 * microphone data, chat content, or raw mastery evidence.
 */
export function buildKoiLearningSummary(input: KoiLearningSummaryInput): KoiLearningSummary {
  const scores = validScores(input.progress.quizScores);
  const latestScores = scores.slice(-10);
  const latestByLesson = new Map<string, number>();
  for (const score of scores) latestByLesson.set(score.lessonId.trim(), score.score);
  const weakTopicIds = Array.from(latestByLesson.entries())
    .filter(([, score]) => score < 80)
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))
    .slice(0, 20)
    .map(([lessonId]) => lessonId);
  const recentQuizAverage = latestScores.length > 0
    ? latestScores.reduce((total, score) => total + Math.min(100, Math.max(0, score.score)), 0) / latestScores.length
    : undefined;
  const completedLessonIds = new Set(input.progress.completedLessonIds.filter(id => (
    typeof id === 'string' && id.trim().length >= 1 && id.length <= 160
  )));
  const mastered = scores.filter(score => score.score >= 80).length;
  const developing = scores.filter(score => score.score >= 50 && score.score < 80).length;
  const needsReview = scores.filter(score => score.score < 50).length;
  const latestQuiz = scores
    .slice()
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
    .at(-1);

  return {
    revision: clampInteger(input.revision, 0, Number.MAX_SAFE_INTEGER),
    consentVersion: KOI_CURRENT_DETAILED_PROGRESS_POLICY_VERSION,
    supportLanguage: input.profile?.static.supportLanguage ?? 'en',
    ...(input.profile?.static.jlptTarget ? { jlptTarget: input.profile.static.jlptTarget } : {}),
    ...(placementLevel(input.profile) ? { placementLevel: placementLevel(input.profile) } : {}),
    ...(input.profile?.static.studyGoal ? { studyGoalId: input.profile.static.studyGoal } : {}),
    ...(latestQuiz ? { currentLessonId: latestQuiz.lessonId.trim() } : {}),
    dueCount: clampInteger(input.dueCount, 0, 100_000),
    streakDays: clampInteger(input.progress.streak.currentStreak, 0, 100_000),
    completionCounts: {
      lessons: Math.min(100_000, completedLessonIds.size),
      quizzes: Math.min(100_000, scores.length),
    },
    weakTopicIds,
    masteryBuckets: {
      mastered: Math.min(100_000, mastered),
      developing: Math.min(100_000, developing),
      needs_review: Math.min(100_000, needsReview),
    },
    ...(recentQuizAverage === undefined ? {} : { recentQuizAverage }),
    recentActiveDays: recentActiveDays(input.progress, input.events, input.now ?? Date.now()),
  };
}
