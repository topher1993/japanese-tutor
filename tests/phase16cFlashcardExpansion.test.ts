import { describe, expect, it } from 'vitest';

import { createFlashcardDeck, getFlashcardStudySummary } from '../src/services/flashcardService';
import { getAllLessons } from '../src/services/lessonService';
import { localDateKey } from '../src/utils/localDate';

const requiredCategories = ['workplace', 'safety', 'daily-life', 'hr', 'emergency'] as const;

describe('Phase 16C flashcard expansion', () => {
  it('builds a 100+ card beginner deck with multilingual support', () => {
    const deck = createFlashcardDeck(getAllLessons());
    expect(deck.cards.length).toBeGreaterThanOrEqual(100);

    const japaneseValues = new Set<string>();
    for (const card of deck.cards) {
      expect(card.japanese).toBeTruthy();
      expect(card.romaji).toBeTruthy();
      expect(card.english).toBeTruthy();
      expect(card.vietnamese).toBeTruthy();
      expect(card.filipino).toBeTruthy();
      // Phase 25 / P2-1: nextReviewDate is now todayIso(), not a hardcoded literal.
      const today = localDateKey();
      expect(card.nextReviewDate).toBe(today);
      expect(card.reviewCount).toBe(0);
      japaneseValues.add(card.japanese);
    }
    expect(japaneseValues.size).toBe(deck.cards.length);
  });

  it('covers the main beginner workplace categories in the deck summary', () => {
    const deck = createFlashcardDeck(getAllLessons());
    // Phase 25 / P2-1: query the summary for today (when cards are due), not a
    // frozen historical date that would mismatch the new dynamic nextReviewDate.
    const today = localDateKey();
    const summary = getFlashcardStudySummary(deck, today);

    expect(summary.totalCards).toBeGreaterThanOrEqual(100);
    expect(summary.dueToday).toBe(summary.totalCards);
    for (const category of requiredCategories) {
      expect(summary.categories).toContain(category);
    }
  });
});
