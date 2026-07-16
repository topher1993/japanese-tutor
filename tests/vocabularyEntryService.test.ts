import { describe, expect, it } from 'vitest';
import { createVocabularyEntry, flashcardContentFromVocabulary } from '../src/services/vocabularyEntryService';
import { createFlashcardDeck } from '../src/services/flashcardService';
import { mockSenseiLessons } from '../src/data/mockSenseiLessons';
import { grammarLessons } from '../src/data/grammarLessons';
import { buildCandidateReviewItems } from '../src/services/candidateReviewAdapter';

describe('canonical vocabulary entries', () => {
  it('normalizes level, taxonomy, topics, meanings, and source metadata', () => {
    const vocabulary = createVocabularyEntry({
      id: 'vocab-iku',
      japanese: '行く',
      kana: 'いく',
      romaji: 'iku',
      english: 'to go',
      vietnamese: 'đi',
      filipino: 'pumunta',
      jlptLevel: 'N5',
      topics: ['daily-life', 'travel'],
      sourcePartOfSpeech: 'verb',
      sourceKind: 'candidate-n5',
      reviewStatus: 'approved-for-beta',
    });

    expect(vocabulary).toMatchObject({
      id: 'vocab-iku',
      jlptLevel: 'N5',
      partOfSpeech: 'verb',
      learningGroup: 'verb',
      topics: ['daily-life', 'travel'],
      reviewStatus: 'approved-for-beta',
    });
    expect(vocabulary.meanings).toEqual({ en: ['to go'], vi: ['đi'], tl: ['pumunta'] });
    expect(vocabulary).not.toHaveProperty('reviewCount');
    expect(vocabulary).not.toHaveProperty('nextReviewDate');
  });

  it('keeps learner review state in the flashcard adapter output', () => {
    const vocabulary = createVocabularyEntry({
      id: 'vocab-taberu',
      japanese: '食べる',
      kana: 'たべる',
      romaji: 'taberu',
      english: 'to eat',
      jlptLevel: 'N5',
      sourceKind: 'lesson',
    });
    const card = {
      id: `card-${vocabulary.id}`,
      lessonId: 'lesson-n5',
      category: 'daily-life',
      ...flashcardContentFromVocabulary(vocabulary),
      reviewCount: 0,
      nextReviewDate: '2099-01-01',
      translationReviewStatus: 'draft' as const,
      kind: 'vocab' as const,
    };

    expect(card.vocabularyId).toBe(vocabulary.id);
    expect(card.jlptLevel).toBe('N5');
    expect(card.topics).toEqual([]);
    expect(card.reviewCount).toBe(0);
    expect(card.nextReviewDate).toBe('2099-01-01');
  });

  it('attaches canonical ids and levels to lesson-derived flashcards', () => {
    const n3Lesson = mockSenseiLessons.find(lesson => lesson.level === 'N3');
    expect(n3Lesson).toBeDefined();
    const deck = createFlashcardDeck([n3Lesson!]);

    expect(deck.cards.length).toBeGreaterThan(0);
    const lessonCards = deck.cards.filter(card => card.lessonId === n3Lesson!.id);
    expect(lessonCards.every(card => card.vocabularyId)).toBe(true);
    expect(lessonCards.every(card => card.jlptLevel === 'N3')).toBe(true);
  });

  it('hydrates every app lesson item and review item with canonical vocabulary', () => {
    const lessonItems = [...mockSenseiLessons, ...grammarLessons].flatMap(lesson => lesson.items);
    expect(lessonItems.length).toBeGreaterThan(0);
    expect(lessonItems.every(item => item.vocabulary)).toBe(true);
    expect(lessonItems.every(item => item.vocabulary?.topics.length)).toBe(true);

    const reviewItems = buildCandidateReviewItems('N4');
    expect(reviewItems.length).toBeGreaterThan(0);
    expect(reviewItems.every(item => item.vocabularyId)).toBe(true);
  });
});
