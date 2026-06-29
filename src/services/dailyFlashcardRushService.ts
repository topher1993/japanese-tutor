import type { LearnerLanguage } from '../types/onboarding';
import type { FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';
import type { UserProfile, UserProfilePatch } from '../types/userProfile';
import { getSupportTranslation } from './supportLanguageService';

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

function choiceSetFor(card: FlashcardReviewCard, pool: FlashcardReviewCard[], seed: string, supportLanguage: LearnerLanguage): DailyRushChoice[] {
  const distractors = pool
    .filter(candidate => candidate.id !== card.id)
    .sort((a, b) => seededScore(`${seed}:choice:${card.id}`, a.id) - seededScore(`${seed}:choice:${card.id}`, b.id))
    .slice(0, 3);
  return [card, ...distractors]
    .sort((a, b) => seededScore(`${seed}:order:${card.id}`, a.id) - seededScore(`${seed}:order:${card.id}`, b.id))
    .map(candidate => ({
      id: `${card.id}-choice-${candidate.id}`,
      cardId: candidate.id,
      text: getChoiceText(candidate, supportLanguage),
      correct: candidate.id === card.id,
    }));
}

export function buildDailyFlashcardRush(
  deck: FlashcardDeck,
  options: { date: string; supportLanguage: LearnerLanguage; count?: number },
): DailyFlashcardRush {
  const count = options.count ?? 10;
  const pool = dedupeByChoiceText(deck.cards, options.supportLanguage);
  const dueFirst = [...pool].sort((a, b) => {
    const due = a.nextReviewDate.localeCompare(b.nextReviewDate);
    if (due !== 0) return due;
    return seededScore(options.date, a.id) - seededScore(options.date, b.id);
  });
  const selected = dueFirst.slice(0, Math.min(count, dueFirst.length));
  return {
    id: `daily-rush-${options.date}`,
    date: options.date,
    cards: selected.map((card, index) => ({
      id: `${options.date}-${index + 1}-${card.id}`,
      position: index + 1,
      card,
      choices: choiceSetFor(card, pool, `${options.date}:${index}`, options.supportLanguage),
    })),
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
    cardId: card.card.id,
    selectedChoiceId,
    correctChoiceId: correct.id,
    correct: isCorrect,
    label: isCorrect ? 'good' : 'again',
    xpEarned: isCorrect ? 12 : 4,
  };
}

export function summarizeDailyRush(results: DailyRushAnswerResult[]): DailyRushSummary {
  const good = results.filter(result => result.label === 'good').length;
  const again = results.filter(result => result.label === 'again').length;
  const xpEarned = results.reduce((sum, result) => sum + result.xpEarned, 0);
  return {
    total: results.length,
    good,
    again,
    xpEarned,
    accuracyPercent: results.length ? Math.round((good / results.length) * 100) : 0,
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
