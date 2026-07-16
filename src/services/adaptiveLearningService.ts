import type { ReviewCard } from './spacedRepetitionService';
import { localDateKey } from '../utils/localDate';

export interface AdaptiveLearningSnapshot {
  totalCards: number;
  dueCards: number;
  weakCards: number;
  recognizedCards: number;
  memorizedCards: number;
  retentionPercent: number;
  recommendation: 'review-due' | 'strengthen-weak' | 'learn-new';
}

/**
 * Summarise the learner's current SRS state into a small, explainable plan.
 * Weak cards are cards still in the learning pipeline (seen/recognized) or
 * cards with a low ease factor. This deliberately uses persisted card state
 * only, so the dashboard remains stable across app restarts and offline use.
 */
export function buildAdaptiveLearningSnapshot(cards: ReviewCard[], now: Date = new Date()): AdaptiveLearningSnapshot {
  // Sentence Lab mistakes have their own review surface and must not inflate
  // the Flashcards plan or route learners to a deck that cannot display them.
  cards = cards.filter(card => !card.refId.startsWith('sentence-lab:'));
  const today = localDateKey(now);
  const dueCards = cards.filter(card => card.stage === 'memorized' && card.dueOn <= today).length;
  const weakCards = cards.filter(card => card.stage !== 'memorized' || card.easeFactor < 2.2).length;
  const recognizedCards = cards.filter(card => card.stage === 'recognized').length;
  const memorizedCards = cards.filter(card => card.stage === 'memorized').length;
  const reviewedCards = cards.filter(card => card.repetitions > 0);
  const successfulCards = reviewedCards.filter(card => card.stage === 'memorized' && card.easeFactor >= 2.2);
  const retentionPercent = reviewedCards.length
    ? Math.round((successfulCards.length / reviewedCards.length) * 100)
    : 0;

  return {
    totalCards: cards.length,
    dueCards,
    weakCards,
    recognizedCards,
    memorizedCards,
    retentionPercent,
    recommendation: dueCards > 0 ? 'review-due' : weakCards > 0 ? 'strengthen-weak' : 'learn-new',
  };
}
