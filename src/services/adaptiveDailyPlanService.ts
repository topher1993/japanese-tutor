import type { FlashcardReviewCard } from '../types/flashcard';
import type { DailyTodoActivity } from '../types/weeklyTodo';
import type { DailyStudyMinutes } from '../types/userProfile';
import type { MasteryMap } from '../types/mastery';
import type { ReviewCard } from './spacedRepetitionService';
import { learningGroupLabel, VOCABULARY_LEARNING_GROUPS, type VocabularyLearningGroup } from './vocabularyTaxonomyService';

export type AdaptivePlanRoute =
  | 'flashcards-due'
  | 'flashcards-weak'
  | 'sentence-lab'
  | 'lesson'
  | 'daily-rush'
  | 'quiz'
  | 'new-vocabulary';

export interface AdaptiveDailyPlanTask {
  id: string;
  route: AdaptivePlanRoute;
  title: string;
  reason: string;
  minutes: number;
  target: number;
  unit: string;
  ctaLabel: string;
  learningGroup?: VocabularyLearningGroup;
}

export interface AdaptiveDailyPlan {
  date: string;
  budgetMinutes: number;
  plannedMinutes: number;
  tasks: AdaptiveDailyPlanTask[];
  weakestGroup: VocabularyLearningGroup | null;
  dueFlashcards: number;
  dueSentenceMistakes: number;
  explanation: string;
}

export interface AdaptiveDailyPlanInput {
  date: string;
  budgetMinutes: DailyStudyMinutes | number;
  srsCards: readonly ReviewCard[];
  flashcards: readonly FlashcardReviewCard[];
  dailyActivity?: DailyTodoActivity;
  lessonTitle?: string;
  courseComplete?: boolean;
  masteryMap?: MasteryMap;
}

interface CandidateTask extends Omit<AdaptiveDailyPlanTask, 'minutes' | 'target'> {
  preferredMinutes: number;
  minimumMinutes: number;
  targetPerMinute: number;
  maxTarget: number;
}

function isSentenceCard(card: ReviewCard): boolean {
  return card.refId.startsWith('sentence-lab:');
}

function todayLocalIso(date: string): string {
  return date;
}

function weakGroupSummary(
  srsCards: readonly ReviewCard[],
  flashcards: readonly FlashcardReviewCard[],
): { group: VocabularyLearningGroup | null; count: number } {
  const cardById = new Map(flashcards.map(card => [card.id, card]));
  const counts = new Map<VocabularyLearningGroup, number>(VOCABULARY_LEARNING_GROUPS.map(group => [group, 0]));
  for (const row of srsCards) {
    if (isSentenceCard(row)) continue;
    if (row.stage === 'memorized' && row.easeFactor >= 2.2) continue;
    const group = cardById.get(row.refId)?.learningGroup;
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const ranked = VOCABULARY_LEARNING_GROUPS
    .map(group => ({ group, count: counts.get(group) ?? 0 }))
    .sort((a, b) => b.count - a.count || VOCABULARY_LEARNING_GROUPS.indexOf(a.group) - VOCABULARY_LEARNING_GROUPS.indexOf(b.group));
  return ranked[0]?.count ? ranked[0] : { group: null, count: 0 };
}

function allocateTask(candidate: CandidateTask, remaining: number, date: string): AdaptiveDailyPlanTask | null {
  if (remaining < candidate.minimumMinutes) return null;
  const minutes = Math.min(candidate.preferredMinutes, remaining);
  return {
    id: `${date}-${candidate.id}`,
    route: candidate.route,
    title: candidate.title,
    reason: candidate.reason,
    minutes,
    target: Math.min(candidate.maxTarget, Math.max(1, Math.floor(minutes * candidate.targetPerMinute))),
    unit: candidate.unit,
    ctaLabel: candidate.ctaLabel,
    learningGroup: candidate.learningGroup,
  };
}

export function buildAdaptiveDailyPlan(input: AdaptiveDailyPlanInput): AdaptiveDailyPlan {
  const budgetMinutes = Math.max(2, Math.min(30, Math.round(input.budgetMinutes)));
  const activity = input.dailyActivity ?? {};
  const today = todayLocalIso(input.date);
  const flashcardRows = input.srsCards.filter(card => !isSentenceCard(card));
  const sentenceRows = input.srsCards.filter(isSentenceCard);
  const dueFlashcards = flashcardRows.filter(card => card.stage === 'memorized' && card.dueOn <= today).length;
  const dueSentenceMistakes = sentenceRows.filter(card => card.dueOn <= today).length;
  const derivedWeak = weakGroupSummary(flashcardRows, input.flashcards);
  const masteryWeakGroup = input.masteryMap?.weakestGroup;
  const masteryWeakSummary = masteryWeakGroup
    ? input.masteryMap?.groups.find(group => group.group === masteryWeakGroup && group.attemptedCount > 0)
    : undefined;
  const masteryWeakCount = masteryWeakGroup
    ? input.masteryMap?.items.filter(item => item.learningGroup === masteryWeakGroup && item.level !== 'mastered').length ?? 0
    : 0;
  const weak = masteryWeakSummary && masteryWeakGroup
    ? { group: masteryWeakGroup, count: masteryWeakCount, masteryScore: masteryWeakSummary.score, weakestModality: masteryWeakSummary.weakestModality }
    : { ...derivedWeak, masteryScore: undefined, weakestModality: undefined };
  const lessonDone = (activity.lessonIds?.length ?? 0) > 0;
  const rushDone = activity.dailyRushCompleted === true;
  const dailyFlashcardsDone = Math.min(activity.flashcardReviewIds?.length ?? 0, 5);
  const quizDone = activity.quizCompleted === true;

  const candidates: CandidateTask[] = [];
  // Retrieval obligations always come first.
  if (dueFlashcards > 0) {
    candidates.push({
      id: 'due-flashcards', route: 'flashcards-due', title: 'Review scheduled flashcards',
      reason: `${dueFlashcards} card${dueFlashcards === 1 ? ' is' : 's are'} due today. Reviews come before new material.`,
      preferredMinutes: Math.min(5, Math.max(1, Math.ceil(dueFlashcards / 4))), minimumMinutes: 1,
      targetPerMinute: 4, maxTarget: dueFlashcards, unit: 'cards', ctaLabel: 'Review due cards',
    });
  }
  if (dueSentenceMistakes > 0) {
    candidates.push({
      id: 'sentence-mistakes', route: 'sentence-lab', title: 'Revisit listening mistakes',
      reason: `${dueSentenceMistakes} Sentence Lab mistake${dueSentenceMistakes === 1 ? ' is' : 's are'} ready for retrieval.`,
      preferredMinutes: Math.min(4, Math.max(1, Math.ceil(dueSentenceMistakes / 2))), minimumMinutes: 1,
      targetPerMinute: 2, maxTarget: dueSentenceMistakes, unit: 'sentences', ctaLabel: 'Review mistakes',
    });
  }
  if (weak.group && weak.count > 0) {
    candidates.push({
      id: `weak-${weak.group}`, route: 'flashcards-weak', title: `Strengthen ${learningGroupLabel(weak.group).toLowerCase()} recall`,
      reason: weak.masteryScore == null
        ? `${learningGroupLabel(weak.group)} is currently your weakest word type with ${weak.count} card${weak.count === 1 ? '' : 's'} still strengthening.`
        : `${learningGroupLabel(weak.group)} mastery is ${weak.masteryScore}%; ${weak.weakestModality} is the weakest skill dimension.`,
      preferredMinutes: 2, minimumMinutes: 1, targetPerMinute: 3, maxTarget: weak.count,
      unit: 'cards', ctaLabel: `Practice ${learningGroupLabel(weak.group).toLowerCase()}s`, learningGroup: weak.group,
    });
  }

  // Unfinished daily commitments replace tasks already completed today.
  if (!lessonDone && !input.courseComplete) {
    candidates.push({
      id: 'lesson', route: 'lesson', title: input.lessonTitle ? `Continue: ${input.lessonTitle}` : "Complete today's lesson",
      reason: "Today's lesson Todo is still open, so the plan keeps one guided content step.",
      preferredMinutes: 4, minimumMinutes: 2, targetPerMinute: 1, maxTarget: 1,
      unit: 'lesson', ctaLabel: 'Open lesson',
    });
  }
  if (!rushDone) {
    candidates.push({
      id: 'daily-rush', route: 'daily-rush', title: 'Complete Daily Flashcard Rush',
      reason: 'Daily Rush is still unfinished and checks fast active recall across word types.',
      preferredMinutes: 2, minimumMinutes: 2, targetPerMinute: 1, maxTarget: 1,
      unit: 'rush', ctaLabel: 'Start Daily Rush',
    });
  }
  if (dailyFlashcardsDone < 5 && dueFlashcards === 0 && !weak.group) {
    candidates.push({
      id: 'daily-flashcards', route: 'new-vocabulary', title: 'Review daily flashcards',
      reason: `${5 - dailyFlashcardsDone} review${5 - dailyFlashcardsDone === 1 ? '' : 's'} remain in today's flashcard Todo.`,
      preferredMinutes: 2, minimumMinutes: 1, targetPerMinute: 3, maxTarget: 5 - dailyFlashcardsDone,
      unit: 'cards', ctaLabel: 'Open flashcards',
    });
  }
  if (!quizDone) {
    candidates.push({
      id: 'quiz', route: 'quiz', title: 'Run a focused quiz check',
      reason: 'No quiz attempt is recorded today; choose multiple choice, listening, sentence building, or fill-in-the-blank.',
      preferredMinutes: 2, minimumMinutes: 1, targetPerMinute: 1, maxTarget: 1,
      unit: 'test', ctaLabel: 'Open quiz',
    });
  }
  // New material is deliberately last.
  candidates.push({
    id: 'new-vocabulary', route: 'new-vocabulary', title: 'Preview new vocabulary',
    reason: 'Required review work is covered first, so the remaining time can safely introduce something new.',
    preferredMinutes: 2, minimumMinutes: 1, targetPerMinute: 2, maxTarget: 4,
    unit: 'cards', ctaLabel: 'Learn new cards', learningGroup: weak.group ?? undefined,
  });
  candidates.push({
    id: 'extended-review', route: 'flashcards-weak', title: 'Mixed retention practice',
    reason: 'Your core plan is covered; the remaining study time reinforces a mixed set without adding more required new material.',
    preferredMinutes: 30, minimumMinutes: 1, targetPerMinute: 3, maxTarget: 50,
    unit: 'cards', ctaLabel: 'Continue mixed review',
  });

  const tasks: AdaptiveDailyPlanTask[] = [];
  let remaining = budgetMinutes;
  for (const candidate of candidates) {
    const task = allocateTask(candidate, remaining, input.date);
    if (!task) continue;
    tasks.push(task);
    remaining -= task.minutes;
    if (remaining <= 0) break;
  }

  const plannedMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  return {
    date: input.date,
    budgetMinutes,
    plannedMinutes,
    tasks,
    weakestGroup: weak.group,
    dueFlashcards,
    dueSentenceMistakes,
    explanation: tasks.length
      ? `Built from your live recall state and today's completed activities. ${plannedMinutes} of ${budgetMinutes} minutes planned.`
      : 'Everything currently required is complete. Optional review is still available.',
  };
}
