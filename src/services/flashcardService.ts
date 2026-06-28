import { supplementalFlashcards } from '../data/supplementalFlashcards';
import type { LessonCategory, SenseiLesson } from '../types/lesson';
import type { FlashcardAnswer, FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';

function addDays(date: string, days: number): string { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
function interval(answer: FlashcardAnswer): number { return answer === 'again' ? 1 : answer === 'good' ? 3 : 7; }
/**
 * Phase 25 / P2-1: today's date as YYYY-MM-DD. Replaces the prior hardcoded
 * `'2026-06-18'` literal that made every fresh-install flashcard appear due
 * (or not due) on the wrong day relative to wall-clock time.
 */
function todayIso(): string { return new Date().toISOString().slice(0, 10); }

export function createFlashcardDeck(lessons: SenseiLesson[]): FlashcardDeck {
  const today = todayIso();
  const lessonCards: FlashcardReviewCard[] = lessons.flatMap(lesson => lesson.items.map(item => ({ id: `card-${item.id}`, lessonId: lesson.id, category: item.category, japanese: item.japanese, romaji: item.romaji, english: item.english, vietnamese: item.vietnamese, filipino: item.filipino, reviewCount: 0, nextReviewDate: today, translationReviewStatus: item.translationReviewStatus })));
  const supplementalCards: FlashcardReviewCard[] = supplementalFlashcards.map(item => ({ id: `card-${item.id}`, lessonId: 'supplemental-flashcards', category: item.category, japanese: item.japanese, romaji: item.romaji, english: item.english, vietnamese: item.vietnamese, filipino: item.filipino, reviewCount: 0, nextReviewDate: today, translationReviewStatus: item.translationReviewStatus }));
  return { id: 'deck-workplace-survival', title: 'Workplace Survival Flashcards', cards: [...lessonCards, ...supplementalCards] };
}

export function answerFlashcard(deck: FlashcardDeck, cardId: string, answer: FlashcardAnswer, date: string): FlashcardDeck { return { ...deck, cards: deck.cards.map(card => card.id === cardId ? { ...card, reviewCount: card.reviewCount + 1, nextReviewDate: addDays(date, interval(answer)) } : card) }; }
export function getDueFlashcards(deck: FlashcardDeck, date: string): FlashcardReviewCard[] { return deck.cards.filter(card => card.nextReviewDate <= date); }
export function filterFlashcardsByCategory(deck: FlashcardDeck, category: LessonCategory): FlashcardReviewCard[] { return deck.cards.filter(card => card.category === category); }
export function getFlashcardStudySummary(deck: FlashcardDeck, date: string) { const categories = Array.from(new Set(deck.cards.map(card => card.category))).sort(); return { totalCards: deck.cards.length, dueToday: getDueFlashcards(deck, date).length, categories }; }
