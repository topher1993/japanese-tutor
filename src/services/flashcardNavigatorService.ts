import type { FlashcardDeck, FlashcardReviewCard } from '../types/flashcard';

export interface FlashcardNavigatorState {
  deck: FlashcardDeck;
  currentIndex: number;
  currentCard: FlashcardReviewCard;
  cardNumber: string;
  next(): FlashcardNavigatorState;
  previous(): FlashcardNavigatorState;
}

export function getRandomFlashcardIndex(cardCount: number, random: () => number = Math.random): number {
  if (cardCount <= 0) return 0;
  const value = Math.max(0, Math.min(0.999999, random()));
  return Math.floor(value * cardCount);
}

export function getNextRandomFlashcardIndex(currentIndex: number, cardCount: number, random: () => number = Math.random): number {
  if (cardCount <= 1) return 0;
  const candidate = getRandomFlashcardIndex(cardCount, random);
  if (candidate !== currentIndex) return candidate;
  return currentIndex === cardCount - 1 ? currentIndex - 1 : currentIndex + 1;
}

export function moveToNextFlashcard(currentIndex: number, cardCount: number): number {
  if (cardCount <= 0) return 0;
  return (currentIndex + 1) % cardCount;
}

export function moveToPreviousFlashcard(currentIndex: number, cardCount: number): number {
  if (cardCount <= 0) return 0;
  return (currentIndex - 1 + cardCount) % cardCount;
}

export function createFlashcardNavigator(deck: FlashcardDeck, currentIndex = getRandomFlashcardIndex(deck.cards.length)): FlashcardNavigatorState {
  const safeIndex = deck.cards.length === 0 ? 0 : Math.max(0, Math.min(currentIndex, deck.cards.length - 1));
  const currentCard = deck.cards[safeIndex];

  return {
    deck,
    currentIndex: safeIndex,
    currentCard,
    cardNumber: deck.cards.length === 0 ? '0 / 0' : `${safeIndex + 1} / ${deck.cards.length}`,
    next: () => createFlashcardNavigator(deck, moveToNextFlashcard(safeIndex, deck.cards.length)),
    previous: () => createFlashcardNavigator(deck, moveToPreviousFlashcard(safeIndex, deck.cards.length)),
  };
}
