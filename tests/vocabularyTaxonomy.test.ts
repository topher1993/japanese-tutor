import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAllLessons } from '../src/services/lessonService';
import { createFlashcardDeck } from '../src/services/flashcardService';
import { buildCandidateFlashcardCards } from '../src/services/candidateFlashcardAdapter';
import { buildDailyFlashcardRush } from '../src/services/dailyFlashcardRushService';
import { buildReviewSession } from '../src/services/reviewModeService';
import {
  classifyVocabulary,
  VOCABULARY_LEARNING_GROUPS,
} from '../src/services/vocabularyTaxonomyService';

describe('Japanese vocabulary taxonomy', () => {
  it('distinguishes verb groups and reliable transitivity metadata', () => {
    expect(classifyVocabulary({ japanese: '食べる', reading: 'たべる', romaji: 'taberu', english: 'to eat', category: 'verbs' }))
      .toMatchObject({ partOfSpeech: 'verb', learningGroup: 'verb', verbGroup: 'ichidan', transitivity: 'transitive' });
    expect(classifyVocabulary({ japanese: '帰る', reading: 'かえる', romaji: 'kaeru', english: 'to return home', category: 'verbs' }))
      .toMatchObject({ verbGroup: 'godan', transitivity: 'intransitive' });
    expect(classifyVocabulary({ japanese: '来る', reading: 'くる', romaji: 'kuru', english: 'to come', category: 'verbs' }))
      .toMatchObject({ verbGroup: 'irregular', transitivity: 'intransitive' });
  });

  it('separates Japanese adjective types and grammatical vocabulary', () => {
    expect(classifyVocabulary({ japanese: '新しい', reading: 'あたらしい', romaji: 'atarashii', english: 'new', category: 'adjectives' }).partOfSpeech).toBe('i-adjective');
    expect(classifyVocabulary({ japanese: '綺麗', reading: 'きれい', romaji: 'kirei', english: 'pretty', category: 'adjectives' }).partOfSpeech).toBe('na-adjective');
    expect(classifyVocabulary({ japanese: 'は', romaji: 'wa', english: 'topic particle', category: 'grammar' }).partOfSpeech).toBe('particle');
    expect(classifyVocabulary({ japanese: '本', romaji: 'hon', english: 'counter for long things', category: 'counters' }).partOfSpeech).toBe('counter');
    expect(classifyVocabulary({ japanese: 'なぜ', romaji: 'naze', english: 'why', category: 'demonstratives' }).partOfSpeech).toBe('adverb');
  });

  it('classifies every production flashcard', async () => {
    const base = createFlashcardDeck(getAllLessons());
    const candidates = await buildCandidateFlashcardCards('N3');
    const cards = [...base.cards, ...candidates];

    expect(base.cards).toHaveLength(415);
    expect(candidates.length).toBeGreaterThanOrEqual(2200);
    expect(cards).toHaveLength(base.cards.length + candidates.length);
    expect(cards.every(card => card.partOfSpeech && card.learningGroup && card.classificationConfidence)).toBe(true);
    expect(cards.filter(card => card.partOfSpeech === 'verb').every(card => card.verbGroup && card.dictionaryForm)).toBe(true);
    for (const group of VOCABULARY_LEARNING_GROUPS) {
      expect(cards.some(card => card.learningGroup === group), `missing ${group} cards`).toBe(true);
    }
  });

  it('separates lexical lesson words from complete lesson expressions', () => {
    const cards = createFlashcardDeck(getAllLessons()).cards;
    expect(cards.find(card => card.id === 'card-item-week3-yuubin')?.partOfSpeech).toBe('noun');
    expect(cards.find(card => card.id === 'card-item-n4-potential-verb')?.partOfSpeech).toBe('expression');
  });

  it('balances Daily Rush across available word groups and prefers same-group distractors', async () => {
    const base = createFlashcardDeck(getAllLessons());
    const candidates = await buildCandidateFlashcardCards('N3');
    const cards = [...base.cards, ...candidates];
    const rush = buildDailyFlashcardRush({ ...base, cards }, { date: '2026-07-11', supportLanguage: 'en', count: 10 });
    const byId = new Map(cards.map(card => [card.id, card]));

    expect(new Set(rush.cards.map(item => item.card.learningGroup))).toEqual(new Set(VOCABULARY_LEARNING_GROUPS));
    for (const item of rush.cards) {
      const distractorGroups = item.choices
        .filter(choice => !choice.correct)
        .map(choice => byId.get(choice.cardId)?.learningGroup);
      expect(distractorGroups.every(group => group === item.card.learningGroup)).toBe(true);
    }
  });

  it('filters Review Mode by learner-facing word group', () => {
    for (const group of VOCABULARY_LEARNING_GROUPS) {
      const session = buildReviewSession(undefined, group);
      expect(session.items.length).toBeGreaterThan(0);
      expect(session.items.every(item => item.learningGroup === group)).toBe(true);
    }
  });

  it('wires word-type filters and labels into learner-facing screens', () => {
    const flashcards = readFileSync('src/screens/FlashcardsScreen.tsx', 'utf8');
    const rush = readFileSync('src/screens/DailyRushScreen.tsx', 'utf8');
    const review = readFileSync('src/screens/ReviewModePanel.tsx', 'utf8');
    expect(flashcards).toContain('Word type');
    expect(flashcards).toContain('taxonomyDetailLabel');
    expect(rush).toContain('taxonomyDetailLabel');
    expect(review).toContain('VOCABULARY_LEARNING_GROUPS');
  });
});
