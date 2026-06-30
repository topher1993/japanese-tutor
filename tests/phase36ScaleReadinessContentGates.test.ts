import { describe, expect, it } from 'vitest';

import { getAllLessons } from '../src/services/lessonService';
import { createFlashcardDeck } from '../src/services/flashcardService';
import { buildCandidateFlashcardCards } from '../src/services/candidateFlashcardAdapter';
import { buildDailyFlashcardRush } from '../src/services/dailyFlashcardRushService';
import { getQuickQuiz } from '../src/services/quizService';
import { buildReviewSession } from '../src/services/reviewModeService';
import { buildKanjiSection, mergeKanjiCardPool } from '../src/services/kanjiSectionService';
import { buildCandidateKanjiSection } from '../src/services/candidateKanjiAdapter';
import { getVisibleTranslations, getSupportTranslation } from '../src/services/supportLanguageService';

const pendingPattern = /pending|review needed|todo|tbd|placeholder/i;

function expectUniqueIds(ids: string[], label: string) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  expect(Array.from(new Set(duplicates)), `${label} duplicate ids`).toEqual([]);
}

describe('Phase 36 scale readiness — learner content quality gates', () => {
  it('lesson content has unique ids and complete learner-facing Japanese/romaji/English/example fields', () => {
    const lessons = getAllLessons();
    expect(lessons.length).toBeGreaterThanOrEqual(36);
    expectUniqueIds(lessons.map(lesson => lesson.id), 'lesson');

    const itemIds = lessons.flatMap(lesson => lesson.items.map(item => item.id));
    expectUniqueIds(itemIds, 'lesson item');

    for (const lesson of lessons) {
      expect(lesson.title.trim(), `${lesson.id} title`).not.toBe('');
      expect(lesson.objective?.trim() ?? '', `${lesson.id} objective`).not.toBe('');
      expect(lesson.summary.trim(), `${lesson.id} summary`).not.toBe('');
      for (const item of lesson.items) {
        expect(item.japanese.trim(), `${item.id} japanese`).not.toBe('');
        expect(item.romaji.trim(), `${item.id} romaji`).not.toBe('');
        expect(item.english.trim(), `${item.id} english`).not.toBe('');
        expect(item.exampleJapanese?.trim() ?? '', `${item.id} exampleJapanese`).not.toBe('');
        expect(item.exampleEnglish?.trim() ?? '', `${item.id} exampleEnglish`).not.toBe('');
      }
    }
  });

  it('normal learner helper-language display never exposes pending placeholders', () => {
    const phrases = getAllLessons().flatMap(lesson => lesson.items);
    for (const phrase of phrases) {
      for (const language of ['en', 'vi', 'tl'] as const) {
        const visible = getVisibleTranslations(phrase, language);
        expect(visible.length, `${phrase.id} ${language} visible translation count`).toBeGreaterThan(0);
        for (const translation of visible) {
          expect(translation.text, `${phrase.id} ${language} text`).not.toMatch(pendingPattern);
        }
      }
    }
  });

  it('Flashcards and Daily Rush pools keep unique ids and learner-safe visible helper text', async () => {
    const baseDeck = createFlashcardDeck(getAllLessons());
    const candidateCards = await buildCandidateFlashcardCards();
    const fullDeck = { ...baseDeck, cards: [...baseDeck.cards, ...candidateCards] };
    expect(fullDeck.cards.length).toBeGreaterThan(1500);
    expectUniqueIds(fullDeck.cards.map(card => card.id), 'flashcard');

    for (const card of fullDeck.cards.slice(0, 200)) {
      for (const language of ['en', 'vi', 'tl'] as const) {
        const translation = getSupportTranslation(card, language);
        expect(translation.text, `${card.id} ${language}`).not.toMatch(pendingPattern);
      }
    }

    const rush = buildDailyFlashcardRush(fullDeck, { date: '2026-06-30', supportLanguage: 'en' });
    expect(rush.cards.length).toBe(10);
    expectUniqueIds(rush.cards.map(card => card.card.id), 'daily rush visible card');
    for (const card of rush.cards) {
      expect(card.choices.length, `${card.card.id} choice count`).toBe(4);
      expect(new Set(card.choices.map(choice => choice.text.trim().toLowerCase())).size, `${card.card.id} unique choices`).toBe(4);
      expect(card.choices.filter(choice => choice.correct).length, `${card.card.id} correct choice`).toBe(1);
    }
  });

  it('Quiz and Review Mode choices stay unique and have one valid answer', () => {
    const quiz = getQuickQuiz();
    expect(quiz.questions.length).toBeGreaterThan(300);
    expectUniqueIds(quiz.questions.map(question => question.id), 'quiz question');
    for (const question of quiz.questions) {
      expect(question.prompt.trim(), `${question.id} prompt`).not.toBe('');
      expect(question.choices.length, `${question.id} choice count`).toBeGreaterThanOrEqual(4);
      expect(new Set(question.choices.map(choice => choice.text.trim().toLowerCase())).size, `${question.id} unique choices`).toBe(question.choices.length);
      expect(question.choices.some(choice => choice.id === question.correctChoice), `${question.id} correct choice exists`).toBe(true);
    }

    const review = buildReviewSession();
    expect(review.items.length).toBeGreaterThan(1000);
    expectUniqueIds(review.items.map(item => item.id), 'review item');
    for (const item of review.items) {
      expect(item.prompt.trim(), `${item.id} prompt`).not.toBe('');
      expect(item.choices.length, `${item.id} choice count`).toBeGreaterThanOrEqual(4);
      expect(new Set(item.choices.map(choice => choice.trim().toLowerCase())).size, `${item.id} unique choices`).toBe(item.choices.length);
      expect(item.correctIndex, `${item.id} correctIndex lower`).toBeGreaterThanOrEqual(0);
      expect(item.correctIndex, `${item.id} correctIndex upper`).toBeLessThan(item.choices.length);
    }
  });

  it('Kanji visible pool has unique cards with examples before scaling content further', async () => {
    const base = buildKanjiSection();
    const candidate = await buildCandidateKanjiSection();
    const cards = mergeKanjiCardPool([...base.cards, ...candidate.cards]);
    expect(cards.length).toBeGreaterThan(900);
    expectUniqueIds(cards.map(card => card.id), 'kanji card');
    for (const card of cards) {
      expect(card.kanji.trim(), `${card.id} kanji`).not.toBe('');
      expect(card.meanings.length, `${card.id} meanings`).toBeGreaterThan(0);
      expect(card.exampleWords.length, `${card.id} examples`).toBeGreaterThan(0);
    }
  });
});
