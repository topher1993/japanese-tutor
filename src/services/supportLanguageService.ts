import type { LearnerLanguage } from '../types/onboarding';

export type TranslationField = 'english' | 'vietnamese' | 'filipino';

export interface TranslatablePhrase {
  english: string;
  vietnamese: string;
  filipino: string;
}

export interface SupportTranslation {
  label: string;
  text: string;
}

const languageConfig: Record<LearnerLanguage, { label: string; field: TranslationField }> = {
  en: { label: 'English', field: 'english' },
  vi: { label: 'Vietnamese', field: 'vietnamese' },
  tl: { label: 'Filipino/Tagalog', field: 'filipino' },
};

const visibleTranslationOrder: Record<LearnerLanguage, LearnerLanguage[]> = {
  en: ['en'],
  vi: ['vi', 'en'],
  tl: ['tl', 'en'],
};

export function getSupportLanguageDisplayName(language: LearnerLanguage): string {
  return languageConfig[language].label;
}

export function getSupportLanguageField(language: LearnerLanguage): TranslationField {
  return languageConfig[language].field;
}

export function getSupportTranslation<T extends TranslatablePhrase>(phrase: T, language: LearnerLanguage): SupportTranslation {
  const config = languageConfig[language];
  return { label: config.label, text: phrase[config.field] };
}

export function getVisibleTranslations<T extends TranslatablePhrase>(phrase: T, language: LearnerLanguage): SupportTranslation[] {
  return visibleTranslationOrder[language].map(candidate => getSupportTranslation(phrase, candidate));
}

export function getSecondaryTranslations<T extends TranslatablePhrase>(phrase: T, language: LearnerLanguage): SupportTranslation[] {
  return getVisibleTranslations(phrase, language).slice(1);
}
