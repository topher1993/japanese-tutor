import { supplementalFlashcards } from '../data/supplementalFlashcards';
import type { LessonCategory, SenseiLesson } from '../types/lesson';
import type { FlashcardAnswer, FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';
import { createVocabularyEntryFromLessonItem, createVocabularyEntry, flashcardContentFromVocabulary } from './vocabularyEntryService';
import { addLocalDateDays, localDateKey } from '../utils/localDate';

function interval(answer: FlashcardAnswer): number { return answer === 'again' ? 1 : answer === 'good' ? 3 : 7; }
/**
 * Phase 25 / P2-1: today's date as YYYY-MM-DD. Replaces the prior hardcoded
 * `'2026-06-18'` literal that made every fresh-install flashcard appear due
 * (or not due) on the wrong day relative to wall-clock time.
 */
export function createFlashcardDeck(lessons: SenseiLesson[]): FlashcardDeck {
  const today = localDateKey();
  // Phase 37d-2: backfill `kind: 'vocab'` for every card produced here so the
  // weekly-todo gate (`flashcards` kind in proposal §5 row 'flashcards') can
  // resolve a pool of distinct card ids. Kanji cards will arrive in 37d-3.
  const lessonCards: FlashcardReviewCard[] = lessons.flatMap(lesson => lesson.items.map(item => {
    const vocabulary = item.vocabulary ?? createVocabularyEntryFromLessonItem(item, lesson.level);
    return {
      id: `card-${item.id}`,
      lessonId: lesson.id,
      category: item.category,
      ...flashcardContentFromVocabulary(vocabulary),
      reviewCount: 0,
      nextReviewDate: today,
      translationReviewStatus: item.translationReviewStatus,
      kind: 'vocab' as const,
    };
  }));
  const supplementalCards: FlashcardReviewCard[] = supplementalFlashcards.map(item => {
    const vocabulary = createVocabularyEntry({
      id: item.id,
      japanese: item.japanese,
      romaji: item.romaji,
      english: item.english,
      vietnamese: item.vietnamese,
      filipino: item.filipino,
      category: item.category,
      topics: [item.category],
      sourceKind: 'supplemental',
    });
    return {
      id: `card-${item.id}`,
      lessonId: 'supplemental-flashcards',
      category: item.category,
      ...flashcardContentFromVocabulary(vocabulary),
      reviewCount: 0,
      nextReviewDate: today,
      translationReviewStatus: item.translationReviewStatus,
      kind: 'vocab' as const,
    };
  });
  return { id: 'deck-workplace-survival', title: 'Workplace Survival Flashcards', cards: [...lessonCards, ...supplementalCards] };
}

export function answerFlashcard(deck: FlashcardDeck, cardId: string, answer: FlashcardAnswer, date: string): FlashcardDeck { return { ...deck, cards: deck.cards.map(card => card.id === cardId ? { ...card, reviewCount: card.reviewCount + 1, nextReviewDate: addLocalDateDays(date, interval(answer)) } : card) }; }
export function getDueFlashcards(deck: FlashcardDeck, date: string): FlashcardReviewCard[] { return deck.cards.filter(card => card.nextReviewDate <= date); }
export function filterFlashcardsByCategory(deck: FlashcardDeck, category: LessonCategory): FlashcardReviewCard[] { return deck.cards.filter(card => card.category === category); }
export function getFlashcardStudySummary(deck: FlashcardDeck, date: string) { const categories = Array.from(new Set(deck.cards.map(card => card.category))).sort(); return { totalCards: deck.cards.length, dueToday: getDueFlashcards(deck, date).length, categories }; }
