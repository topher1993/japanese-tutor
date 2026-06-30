import { describe, expect, it } from 'vitest';

import { getAllLessons } from '../src/services/lessonService';
import { createFlashcardDeck } from '../src/services/flashcardService';
import { buildCandidateFlashcardCards } from '../src/services/candidateFlashcardAdapter';
import { getSupportTranslation, getVisibleTranslations } from '../src/services/supportLanguageService';

const PLACEHOLDER = /pending|review needed|todo|tbd|placeholder/i;

function isMissing(value: string): boolean {
  return !value || value.trim().length === 0 || PLACEHOLDER.test(value);
}

describe('Phase 33 helper language translations across learner lessons', () => {
  it('every lesson item has real Vietnamese and Filipino helper-language text', () => {
    const missing = getAllLessons()
      .flatMap(lesson => lesson.items.map(item => ({ lessonId: lesson.id, item })))
      .filter(({ item }) => isMissing(item.vietnamese) || isMissing(item.filipino))
      .map(({ lessonId, item }) => ({ lessonId, itemId: item.id, english: item.english, vietnamese: item.vietnamese, filipino: item.filipino }));

    expect(missing).toEqual([]);
  });

  it('lesson-backed flashcards expose helper-language translations without falling back to pending text', () => {
    const deck = createFlashcardDeck(getAllLessons());
    const missing = deck.cards
      .filter(card => card.lessonId.startsWith('lesson-n4-'))
      .filter(card => isMissing(getSupportTranslation(card, 'vi').text) || isMissing(getSupportTranslation(card, 'tl').text))
      .map(card => ({ id: card.id, english: card.english, vietnamese: card.vietnamese, filipino: card.filipino }));

    expect(missing).toEqual([]);
  });

  it('candidate flashcards never surface pending helper-language placeholders through the app path', async () => {
    const cards = await buildCandidateFlashcardCards();
    const surfacedPending = cards
      .flatMap(card => [
        getSupportTranslation(card, 'vi'),
        getSupportTranslation(card, 'tl'),
        ...getVisibleTranslations(card, 'vi'),
        ...getVisibleTranslations(card, 'tl'),
      ])
      .filter(translation => PLACEHOLDER.test(translation.text));

    expect(surfacedPending).toEqual([]);
  });

  it('candidate N4 flashcards with missing helper translations fall back with the English label', async () => {
    const n4Card = (await buildCandidateFlashcardCards()).find(card => card.lessonId === 'candidate-n4');
    expect(n4Card).toBeDefined();
    if (!n4Card) return;

    expect(n4Card.vietnamese).toBe('');
    expect(n4Card.filipino).toBe('');
    expect(getSupportTranslation(n4Card, 'vi')).toEqual({ label: 'English', text: n4Card.english });
    expect(getSupportTranslation(n4Card, 'tl')).toEqual({ label: 'English', text: n4Card.english });
    expect(getVisibleTranslations(n4Card, 'vi')).toEqual([{ label: 'English', text: n4Card.english }]);
    expect(getVisibleTranslations(n4Card, 'tl')).toEqual([{ label: 'English', text: n4Card.english }]);
  });
});
