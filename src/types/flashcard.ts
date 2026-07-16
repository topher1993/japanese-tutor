import type { ClassificationConfidence, JapanesePartOfSpeech, JapaneseVerbGroup, VerbTransitivity, VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';
export type FlashcardAnswer = 'again' | 'good' | 'easy';
export type FlashcardJlptLevel = 'N5' | 'N4' | 'N3';
export type TranslationReviewStatus = 'approved' | 'draft';
export interface FlashcardReviewCard { id: string; lessonId: string; category: string; japanese: string; /** Canonical kana reading when the source provides one. */ reading?: string; romaji: string; english: string; vietnamese: string; filipino: string; reviewCount: number; nextReviewDate: string; translationReviewStatus: TranslationReviewStatus;
  /** Reference to the learner-independent vocabulary content object. */
  vocabularyId?: string;
  /** Canonical topic tags such as `food`, `workplace`, or `travel`. */
  topics?: string[];
  /** JLPT course level for vocabulary cards; absent for supplemental content without a course level. */
  jlptLevel?: FlashcardJlptLevel;
  /** Normalized learning taxonomy. Optional only for legacy/test fixtures; every production deck adapter supplies it. */
  partOfSpeech?: JapanesePartOfSpeech;
  learningGroup?: VocabularyLearningGroup;
  dictionaryForm?: string;
  verbGroup?: JapaneseVerbGroup;
  transitivity?: VerbTransitivity;
  classificationConfidence?: ClassificationConfidence;
  /**
   * Phase 37d-2: optional kind tag used by the weekly-todo gate to distinguish
   * vocab cards from kanji cards (proposal §5 row `kanji`). Default `vocab`
   * for everything constructed via `createFlashcardDeck` and the candidate
   * adapters. Optional so older constructions stay valid; consumers should
   * default to `'vocab'` when undefined.
   */
  kind?: 'vocab' | 'kanji'; }
export interface FlashcardDeck { id: string; title: string; cards: FlashcardReviewCard[]; }
