import { describe, expect, it } from 'vitest';

import { mockSenseiLessons } from '../src/data/mockSenseiLessons';
import { survivalPhrases } from '../src/data/workplaceSurvivalPhrases';
import { quickQuiz } from '../src/data/quizzes';

describe('Phase 16B Week 2 content expansion', () => {
  it('adds a complete five-lesson Week 2 workplace survival pack', () => {
    const week2Lessons = mockSenseiLessons.filter(lesson => lesson.week === 2);

    expect(week2Lessons).toHaveLength(5);
    expect(week2Lessons.map(lesson => lesson.title)).toEqual([
      'Workplace Requests and Clarifying Instructions',
      'Schedule, Time, and Shift Questions',
      'Tools, Equipment, and Broken Items',
      'Health, Safety Problems, and Supervisor Help',
      'Simple Polite Conversation at Work',
    ]);

    for (const lesson of week2Lessons) {
      expect(lesson.level).toBe('N5');
      expect(lesson.items.length).toBeGreaterThanOrEqual(4);
      for (const item of lesson.items) {
        expect(item.japanese).toBeTruthy();
        expect(item.romaji).toBeTruthy();
        expect(item.english).toBeTruthy();
        expect(item.vietnamese).toBeTruthy();
        expect(item.filipino).toBeTruthy();
        expect(item.exampleJapanese).toBeTruthy();
        expect(item.exampleEnglish).toBeTruthy();
      }
    }
  });

  it('expands survival phrases to at least forty practical multilingual entries', () => {
    expect(survivalPhrases.length).toBeGreaterThanOrEqual(40);

    const requiredCategories = ['emergency', 'safety', 'help', 'schedule', 'tools', 'health', 'directions', 'polite'] as const;
    const categoryIds = new Set(survivalPhrases.map(phrase => phrase.categoryId));

    for (const category of requiredCategories) {
      expect(categoryIds.has(category)).toBe(true);
    }

    const uniqueJapanese = new Set(survivalPhrases.map(phrase => phrase.japanese));
    expect(uniqueJapanese.size).toBe(survivalPhrases.length);

    for (const phrase of survivalPhrases) {
      expect(phrase.japanese).toBeTruthy();
      expect(phrase.romaji).toBeTruthy();
      expect(phrase.english).toBeTruthy();
      expect(phrase.vietnamese).toBeTruthy();
      expect(phrase.filipino).toBeTruthy();
      expect(phrase.usageNote).toBeTruthy();
    }
  });

  it('expands the quick quiz to at least fifteen questions with exactly one valid answer each', () => {
    expect(quickQuiz.questions.length).toBeGreaterThanOrEqual(15);

    const questionIds = new Set(quickQuiz.questions.map(question => question.id));
    expect(questionIds.size).toBe(quickQuiz.questions.length);

    for (const question of quickQuiz.questions) {
      expect(question.prompt).toBeTruthy();
      expect(question.choices).toHaveLength(4);
      expect(question.choices.map(choice => choice.id).sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(question.choices.some(choice => choice.id === question.correctChoice)).toBe(true);
      expect(question.explanation).toBeTruthy();
    }
  });
});
