import { describe, expect, it } from 'vitest';

import { createFlashcardDeck } from '../src/services/flashcardService';
import { getAllLessons } from '../src/services/lessonService';
import {
  createFlashcardNavigator,
  getNextRandomFlashcardIndex,
  getRandomFlashcardIndex,
  moveToNextFlashcard,
  moveToPreviousFlashcard,
} from '../src/services/flashcardNavigatorService';

describe('Phase 16D flashcard swipe and random navigation', () => {
  it('chooses a deterministic random initial card when a random source is provided', () => {
    const deck = createFlashcardDeck(getAllLessons());

    expect(getRandomFlashcardIndex(deck.cards.length, () => 0)).toBe(0);
    expect(getRandomFlashcardIndex(deck.cards.length, () => 0.5)).toBe(Math.floor(deck.cards.length / 2));
    expect(getRandomFlashcardIndex(deck.cards.length, () => 0.999)).toBe(deck.cards.length - 1);
  });

  it('chooses a random different card for swipe/random review', () => {
    const deck = createFlashcardDeck(getAllLessons());
    const n = deck.cards.length;
    expect(getNextRandomFlashcardIndex(10, n, () => 0)).toBe(0);
    expect(getNextRandomFlashcardIndex(0, n, () => 0)).toBe(1);
    expect(getNextRandomFlashcardIndex(n - 1, n, () => 0.999)).toBe(n - 2);
  });

  it('moves through cards by next and previous with wraparound', () => {
    const deck = createFlashcardDeck(getAllLessons());
    const n = deck.cards.length;
    expect(moveToNextFlashcard(0, n)).toBe(1);
    expect(moveToNextFlashcard(n - 1, n)).toBe(0);
    expect(moveToPreviousFlashcard(0, n)).toBe(n - 1);
    expect(moveToPreviousFlashcard(20, n)).toBe(19);
  });

  it('creates a navigator that exposes card number, current card, and swipe helpers', () => {
    const deck = createFlashcardDeck(getAllLessons());
    const navigator = createFlashcardNavigator(deck, 10);

    expect(navigator.currentIndex).toBe(10);
    expect(navigator.currentCard).toBe(deck.cards[10]);
    expect(navigator.cardNumber).toBe(`11 / ${deck.cards.length}`);
    expect(navigator.next().currentIndex).toBe(11);
    expect(navigator.previous().currentIndex).toBe(9);
  });
});
