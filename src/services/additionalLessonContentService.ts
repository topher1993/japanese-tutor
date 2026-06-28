import { additionalLessonCategoryContent } from '../data/additionalLessonCategoryContent';
import type { AdditionalLessonCategoryContent, AdditionalLessonCategoryId, AdditionalLessonPhrase } from '../types/additionalLessonContent';
import type { LearnerLanguage } from '../types/onboarding';
import { getSecondaryTranslations, getSupportTranslation, type SupportTranslation } from './supportLanguageService';

export interface LocalizedAdditionalLessonPhrase extends AdditionalLessonPhrase {
  primaryTranslation: SupportTranslation;
  secondaryTranslations: SupportTranslation[];
}

export interface AdditionalLessonContentSummary {
  totalCategories: number;
  totalPhrases: number;
  categoryIds: AdditionalLessonCategoryId[];
}

export function getAllAdditionalLessonCategoryContent(): AdditionalLessonCategoryContent[] {
  return additionalLessonCategoryContent;
}

export function getAdditionalLessonCategoryContent(id: AdditionalLessonCategoryId): AdditionalLessonCategoryContent {
  const content = additionalLessonCategoryContent.find(category => category.id === id);
  if (!content) throw new Error(`Unknown additional lesson category: ${id}`);
  return content;
}

export function getAdditionalLessonCategoryContentSummary(): AdditionalLessonContentSummary {
  return {
    totalCategories: additionalLessonCategoryContent.length,
    totalPhrases: additionalLessonCategoryContent.reduce((total, category) => total + category.phrases.length, 0),
    categoryIds: additionalLessonCategoryContent.map(category => category.id),
  };
}

export function getLocalizedAdditionalLessonPhrase(phrase: AdditionalLessonPhrase, language: LearnerLanguage): LocalizedAdditionalLessonPhrase {
  return {
    ...phrase,
    primaryTranslation: getSupportTranslation(phrase, language),
    secondaryTranslations: getSecondaryTranslations(phrase, language),
  };
}
