import type { LearnerLanguage } from '../types/onboarding';
import type { FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';
import type { UserProfile, UserProfilePatch } from '../types/userProfile';
import type { ReviewCard, ReviewRating } from './spacedRepetitionService';
import { getSupportTranslation } from './supportLanguageService';
import { learningGroupFor, VOCABULARY_LEARNING_GROUPS, type VocabularyLearningGroup } from './vocabularyTaxonomyService';
import { localCalendarDayDifference, localDateKey } from '../utils/localDate';

export type DailyRushAnswerLabel = 'good' | 'again';

export interface DailyRushChoice {
  id: string;
  cardId: string;
  text: string;
  correct: boolean;
}

export interface DailyRushCard {
  id: string;
  position: number;
  card: FlashcardReviewCard;
  choices: DailyRushChoice[];
}

export interface DailyFlashcardRush {
  id: string;
  date: string;
  cards: DailyRushCard[];
}

export interface DailyRushAnswerResult {
  /** Identifies this appearance when a missed card is requeued. */
  appearanceId?: string;
  cardId: string;
  selectedChoiceId: string;
  correctChoiceId: string;
  correct: boolean;
  label: DailyRushAnswerLabel;
  xpEarned: number;
}

export interface DailyRushSummary {
  total: number;
  good: number;
  again: number;
  xpEarned: number;
  accuracyPercent: number;
}

export interface DailyRushRetryDecision {
  appearanceCount: number;
  requeue: boolean;
  capped: boolean;
}

export interface SrsReviewTelemetryProperties extends Record<string, unknown> {
  card_id: string;
  rating: ReviewRating;
  pre_ease: number;
  post_ease: number;
  pre_interval: number;
  post_interval: number;
  reps: number;
  overdue_days: number;
  overdue_state: 'on_time' | 'recent_overdue' | 'catch_up_handled';
}

/**
 * Persist the todo side before the profile/XP side. This ordering makes the
 * result screen truthful: once XP is written there are no later completion
 * writes left that can fail. Both operations are idempotent at their stores,
 * so retrying after a partial failure is safe.
 */
export async function persistDailyRushCompletionWrites({
  persistTodo,
  persistProfile,
}: {
  persistTodo?: () => Promise<void>;
  persistProfile: () => Promise<void>;
}): Promise<void> {
  if (persistTodo) await persistTodo();
  await persistProfile();
}

/** Decide whether a just-answered appearance should be appended once more. */
export function getDailyRushRetryDecision(
  correct: boolean,
  previousAppearanceCount: number,
  maxAppearances: number,
): DailyRushRetryDecision {
  const safeMaximum = Math.max(1, Math.floor(maxAppearances));
  const appearanceCount = Math.max(0, Math.floor(previousAppearanceCount)) + 1;
  const missed = !correct;
  return {
    appearanceCount,
    requeue: missed && appearanceCount < safeMaximum,
    capped: missed && appearanceCount >= safeMaximum,
  };
}

/**
 * Build a fresh queue item for a missed card. Rotating the choices prevents
 * the retry from exposing the same correct-answer position.
 */
export function buildDailyRushRetryCard(
  card: DailyRushCard,
  position: number,
  appearanceNumber: number,
): DailyRushCard {
  const choices = card.choices.length > 1
    ? [...card.choices.slice(1), card.choices[0]]
    : [...card.choices];
  return {
    ...card,
    id: `${card.id}-retry-${Math.max(2, Math.floor(appearanceNumber))}`,
    position,
    choices,
  };
}

/** Build the must-have per-review analytics payload from actual SRS rows. */
export function buildSrsReviewTelemetry(
  cardId: string,
  rating: ReviewRating,
  before: ReviewCard,
  after: ReviewCard,
  today = localDateKey(),
): SrsReviewTelemetryProperties {
  const overdueDays = Math.max(0, localCalendarDayDifference(today, before.dueOn));
  const catchUpThresholdCrossed = before.intervalDays > 1 && overdueDays >= 2 * before.intervalDays;
  return {
    card_id: cardId,
    rating,
    pre_ease: before.easeFactor,
    post_ease: after.easeFactor,
    pre_interval: before.intervalDays,
    post_interval: after.intervalDays,
    reps: after.repetitions,
    overdue_days: overdueDays,
    overdue_state: catchUpThresholdCrossed
      ? 'catch_up_handled'
      : overdueDays > 0
        ? 'recent_overdue'
        : 'on_time',
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededScore(seed: string, id: string): number {
  return hashSeed(`${seed}:${id}`);
}

function getChoiceText(card: FlashcardReviewCard, supportLanguage: LearnerLanguage): string {
  const translated = getSupportTranslation(card, supportLanguage).text;
  return translated && !translated.toLowerCase().includes('pending') ? translated : card.english;
}

function dedupeByChoiceText(cards: FlashcardReviewCard[], supportLanguage: LearnerLanguage): FlashcardReviewCard[] {
  const seen = new Set<string>();
  const out: FlashcardReviewCard[] = [];
  for (const card of cards) {
    const key = getChoiceText(card, supportLanguage).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(card);
  }
  return out;
}

function cardLearningGroup(card: FlashcardReviewCard): VocabularyLearningGroup {
  return card.learningGroup ?? (card.partOfSpeech ? learningGroupFor(card.partOfSpeech) : 'expression');
}

/** Round-robin parts of speech while retaining each group's due-date order. */
export function selectBalancedRushCards(
  sortedCards: FlashcardReviewCard[],
  count: number,
  seed: string,
): FlashcardReviewCard[] {
  const start = hashSeed(seed) % VOCABULARY_LEARNING_GROUPS.length;
  const groupOrder = VOCABULARY_LEARNING_GROUPS.map((_, index) => (
    VOCABULARY_LEARNING_GROUPS[(start + index) % VOCABULARY_LEARNING_GROUPS.length]
  ));
  const buckets = new Map(groupOrder.map(group => [group, sortedCards.filter(card => cardLearningGroup(card) === group)]));
  const selected: FlashcardReviewCard[] = [];
  while (selected.length < Math.min(count, sortedCards.length)) {
    let added = false;
    for (const group of groupOrder) {
      const next = buckets.get(group)?.shift();
      if (!next) continue;
      selected.push(next);
      added = true;
      if (selected.length >= count) break;
    }
    if (!added) break;
  }
  return selected;
}

function choiceSetFor(
  card: FlashcardReviewCard,
  pool: FlashcardReviewCard[],
  seed: string,
  supportLanguage: LearnerLanguage,
  previousCorrectIndex?: number,
): DailyRushChoice[] {
  const targetGroup = cardLearningGroup(card);
  const distractors = pool
    .filter(candidate => candidate.id !== card.id)
    .sort((a, b) => {
      const aSame = cardLearningGroup(a) === targetGroup ? 0 : 1;
      const bSame = cardLearningGroup(b) === targetGroup ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return seededScore(`${seed}:choice:${card.id}`, a.id) - seededScore(`${seed}:choice:${card.id}`, b.id);
    })
    .slice(0, 3);
  const rawCorrectIndex = seededScore(`${seed}:correct-position`, card.id) % 4;
  // Never repeat the previous card's correct-answer slot. This prevents a
  // learner from succeeding by memorizing a screen position rather than the
  // Japanese prompt, while retaining deterministic choices for a given seed.
  const correctIndex = previousCorrectIndex === undefined || rawCorrectIndex !== previousCorrectIndex
    ? rawCorrectIndex
    : (rawCorrectIndex + 1 + (seededScore(`${seed}:rotate`, card.id) % 3)) % 4;
  const choices = [...distractors];
  choices.splice(correctIndex, 0, card);
  return choices.map(candidate => ({
      id: `${card.id}-choice-${candidate.id}`,
      cardId: candidate.id,
      text: getChoiceText(candidate, supportLanguage),
      correct: candidate.id === card.id,
    }));
}

export function buildDailyFlashcardRush(
  deck: FlashcardDeck,
  options: {
    date: string;
    supportLanguage: LearnerLanguage;
    count?: number;
    eligibleCardIds?: ReadonlySet<string>;
    /** Changes distractors and answer order without changing the daily card set. */
    choiceSeed?: string;
  },
): DailyFlashcardRush {
  const count = options.count ?? 10;
  const pool = dedupeByChoiceText(deck.cards, options.supportLanguage)
    .filter(card => !options.eligibleCardIds || options.eligibleCardIds.has(card.id));
  const dueFirst = [...pool].sort((a, b) => {
    const due = a.nextReviewDate.localeCompare(b.nextReviewDate);
    if (due !== 0) return due;
    return seededScore(options.date, a.id) - seededScore(options.date, b.id);
  });
  const selected = selectBalancedRushCards(dueFirst, Math.min(count, dueFirst.length), options.date);
  let previousCorrectIndex: number | undefined;
  const cards = selected.map((card, index) => {
    const choices = choiceSetFor(
      card,
      pool,
      `${options.choiceSeed ?? options.date}:${index}`,
      options.supportLanguage,
      previousCorrectIndex,
    );
    previousCorrectIndex = choices.findIndex(choice => choice.correct);
    return {
      id: `${options.date}-${index + 1}-${card.id}`,
      position: index + 1,
      card,
      choices,
    };
  });
  return {
    id: `daily-rush-${options.date}`,
    date: options.date,
    cards,
  };
}

export function answerDailyRushCard(card: DailyRushCard, selectedChoiceId: string): DailyRushAnswerResult {
  const selected = card.choices.find(choice => choice.id === selectedChoiceId);
  const correct = card.choices.find(choice => choice.correct);
  if (!selected || !correct) {
    throw new Error(`Invalid Daily Rush answer for ${card.card.id}`);
  }
  const isCorrect = selected.id === correct.id;
  return {
    appearanceId: card.id,
    cardId: card.card.id,
    selectedChoiceId,
    correctChoiceId: correct.id,
    correct: isCorrect,
    label: isCorrect ? 'good' : 'again',
    xpEarned: isCorrect ? 12 : 4,
  };
}

export function timeOutDailyRushCard(card: DailyRushCard): DailyRushAnswerResult {
  const correct = card.choices.find(choice => choice.correct);
  if (!correct) {
    throw new Error(`Invalid Daily Rush timeout for ${card.card.id}`);
  }
  return {
    appearanceId: card.id,
    cardId: card.card.id,
    selectedChoiceId: 'timeout',
    correctChoiceId: correct.id,
    correct: false,
    label: 'again',
    xpEarned: 4,
  };
}

export function summarizeDailyRush(results: DailyRushAnswerResult[]): DailyRushSummary {
  const uniqueResults = Array.from(
    results.reduce((byCardId, result) => {
      if (!byCardId.has(result.cardId)) byCardId.set(result.cardId, result);
      return byCardId;
    }, new Map<string, DailyRushAnswerResult>()).values(),
  );
  const good = uniqueResults.filter(result => result.label === 'good').length;
  const again = uniqueResults.filter(result => result.label === 'again').length;
  const xpEarned = uniqueResults.reduce((sum, result) => sum + result.xpEarned, 0);
  return {
    total: uniqueResults.length,
    good,
    again,
    xpEarned,
    accuracyPercent: uniqueResults.length ? Math.round((good / uniqueResults.length) * 100) : 0,
  };
}

export function buildDailyRushProfilePatch(profile: UserProfile, summary: DailyRushSummary, date: string): UserProfilePatch {
  const existing = profile.dynamic.dailyRush;
  if (existing.lastCompletedDate === date) {
    return {
      dynamic: {
        xp: profile.dynamic.xp,
        dailyRush: existing,
        lastStudyActivityAt: profile.dynamic.lastStudyActivityAt,
      },
    };
  }

  return {
    dynamic: {
      xp: profile.dynamic.xp + summary.xpEarned,
      lastStudyActivityAt: `${date}T00:00:00.000Z`,
      dailyRush: {
        totalRuns: existing.totalRuns + 1,
        totalGood: existing.totalGood + summary.good,
        totalAgain: existing.totalAgain + summary.again,
        totalXpEarned: existing.totalXpEarned + summary.xpEarned,
        lastCompletedDate: date,
        lastSummary: summary,
      },
    },
  };
}
