import type { LearnerLanguage } from '../types/onboarding';
import type { VocabularyEntry } from '../types/vocabulary';

export type TranslationField = 'english' | 'vietnamese' | 'filipino';

export interface TranslatablePhrase {
  english: string;
  vietnamese: string;
  filipino: string;
}

export interface OptionalTranslatablePhrase {
  english: string;
  vietnamese?: string;
  filipino?: string;
}

type VocabularyTranslatablePhrase = Pick<VocabularyEntry, 'meanings'>;
type SupportedTranslatablePhrase = TranslatablePhrase | VocabularyTranslatablePhrase;

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

function hasRealTranslation(text: string): boolean {
  return Boolean(text && text.trim().length > 0 && !/pending|review needed|todo|tbd|placeholder/i.test(text));
}

function asTranslatablePhrase(phrase: SupportedTranslatablePhrase): TranslatablePhrase {
  if ('english' in phrase) return phrase;
  return {
    english: phrase.meanings.en.join('; '),
    vietnamese: phrase.meanings.vi.join('; '),
    filipino: phrase.meanings.tl.join('; '),
  };
}

export function getSupportTranslation(phrase: SupportedTranslatablePhrase, language: LearnerLanguage): SupportTranslation {
  const normalized = asTranslatablePhrase(phrase);
  const config = languageConfig[language];
  const text = normalized[config.field];
  if (language !== 'en' && !hasRealTranslation(text)) {
    return { label: 'English', text: normalized.english };
  }
  return { label: config.label, text };
}

export function getVisibleTranslations(phrase: SupportedTranslatablePhrase, language: LearnerLanguage): SupportTranslation[] {
  const translations = visibleTranslationOrder[language].map(candidate => getSupportTranslation(phrase, candidate));
  const seen = new Set<string>();
  return translations.filter(translation => {
    const key = `${translation.label}:${translation.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getVisibleOptionalTranslations<T extends OptionalTranslatablePhrase>(phrase: T, language: LearnerLanguage): SupportTranslation[] {
  return getVisibleTranslations({
    english: phrase.english,
    vietnamese: phrase.vietnamese ?? '',
    filipino: phrase.filipino ?? '',
  }, language);
}

export function getSecondaryTranslations<T extends TranslatablePhrase>(phrase: T, language: LearnerLanguage): SupportTranslation[] {
  return getVisibleTranslations(phrase, language).slice(1);
}
