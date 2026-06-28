import { describe, expect, it } from 'vitest';

import { getAdditionalLessonCategoryContent, getAdditionalLessonCategoryContentSummary } from '../src/services/additionalLessonContentService';
import { getLessonCategoryCards } from '../src/services/lessonCategoryService';

const additionalCategoryIds = [
  'daily-conversation',
  'shopping',
  'safety-emergency',
  'directions',
  'grammar-basics',
] as const;

describe('Phase 16F additional lesson content', () => {
  it('marks every non-workplace lesson category as available content instead of planned placeholders', () => {
    const categories = getLessonCategoryCards();

    for (const id of additionalCategoryIds) {
      const category = categories.find(item => item.id === id);
      expect(category, `${id} should exist`).toBeDefined();
      expect(category?.status).toBe('available');
      expect(category?.phraseCount).toBeGreaterThanOrEqual(8);
      expect(category?.lessonCount).toBeGreaterThanOrEqual(1);
    }

    expect(categories.filter(category => category.status === 'planned')).toHaveLength(0);
  });

  it('provides learner-facing Japanese, romaji, English, Vietnamese, and Filipino content for each new category', () => {
    for (const id of additionalCategoryIds) {
      const content = getAdditionalLessonCategoryContent(id);

      expect(content.title.length).toBeGreaterThan(0);
      expect(content.coachTip.length).toBeGreaterThan(0);
      expect(content.phrases.length).toBeGreaterThanOrEqual(8);

      for (const phrase of content.phrases) {
        expect(phrase.japanese.length).toBeGreaterThan(0);
        expect(phrase.romaji.length).toBeGreaterThan(0);
        expect(phrase.english.length).toBeGreaterThan(0);
        expect(phrase.vietnamese.length).toBeGreaterThan(0);
        expect(phrase.filipino.length).toBeGreaterThan(0);
        expect(phrase.usageNote.length).toBeGreaterThan(0);
      }
    }
  });

  it('summarizes the additional content pack for visible Lessons cards', () => {
    const summary = getAdditionalLessonCategoryContentSummary();

    expect(summary.totalCategories).toBe(5);
    expect(summary.totalPhrases).toBeGreaterThanOrEqual(40);
    expect(summary.categoryIds).toEqual(additionalCategoryIds);
  });
});
