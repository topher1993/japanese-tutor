import { describe, expect, it } from 'vitest';

import { getBottomNavigationTabs } from '../src/services/appNavigationService';
import { getLessonCategoryCards } from '../src/services/lessonCategoryService';

describe('Phase 16E lesson category navigation refactor', () => {
  it('uses five bottom tabs and removes Work/Survival from primary navigation', () => {
    const tabs = getBottomNavigationTabs();

    // Phase 22 audit P0-04: standardised on activity nouns.
    expect(tabs.map(tab => tab.label)).toEqual(['Home', 'Lessons', 'Flashcards', 'Quiz', 'Progress']);
    expect(tabs.map(tab => tab.id)).toEqual(['Home', 'Lessons', 'Flashcards', 'Quiz', 'Progress']);
    expect(tabs.map(tab => tab.label)).not.toContain('Work');
    expect(tabs.map(tab => tab.id)).not.toContain('Survival');
  });

  it('moves workplace learning into Lessons as the first available category', () => {
    const categories = getLessonCategoryCards();

    expect(categories.map(category => category.title)).toEqual([
      'Workplace',
      'Daily Conversation',
      'Shopping',
      'Safety / Emergency',
      'Directions',
      'Grammar Basics',
    ]);
    expect(categories[0]).toMatchObject({ id: 'workplace', status: 'available' });
    expect(categories[0].description).toContain('workplace survival');
    expect(categories[0].lessonCount).toBeGreaterThanOrEqual(10);
    expect(categories[0].phraseCount).toBeGreaterThanOrEqual(50);
  });

  it('keeps additional categories inside Lessons after they become ready content', () => {
    const categories = getLessonCategoryCards();
    const additional = categories.filter(category => category.id !== 'workplace');

    expect(additional.map(category => category.id)).toEqual([
      'daily-conversation',
      'shopping',
      'safety-emergency',
      'directions',
      'grammar-basics',
    ]);
    expect(additional.every(category => category.status === 'available')).toBe(true);
    expect(additional.every(category => category.phraseCount >= 8)).toBe(true);
  });
});
