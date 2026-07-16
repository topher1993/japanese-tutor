import type { VocabularyEntry, VocabularySourceReference } from './vocabulary';

export type SupportLanguage = 'en' | 'vi' | 'tl';
export type LessonCategory = 'workplace' | 'safety' | 'daily-life' | 'hr' | 'emergency' | 'grammar';
export type TranslationReviewStatus = 'approved' | 'draft';
export type LessonContentReviewStatus = 'source-backed-candidate' | 'sensei-reviewed';
export type LessonSourceReference = VocabularySourceReference;

export interface LessonItem {
  id: string;
  /** Canonical vocabulary id when this item has been migrated to the catalog. */
  vocabularyId?: string;
  /** Canonical vocabulary content used by app adapters and displays. */
  vocabulary?: VocabularyEntry;
  japanese: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  category: LessonCategory;
  exampleJapanese: string;
  exampleRomaji?: string;
  exampleEnglish: string;
  translationReviewStatus: TranslationReviewStatus;
  /** Source records used to validate vocabulary or other lesson components. */
  sourceRefs?: LessonSourceReference[];
  /** Separate from translation review: source-backed content still needs Sensei review. */
  contentReviewStatus?: LessonContentReviewStatus;
  /** Optional grammar-specific formation guidance shown on rule cards. */
  formation?: string;
  /** Optional grammar-specific warning about a common learner error. */
  commonMistake?: string;
}

export interface SenseiLesson {
  id: string;
  title: string;
  level: 'Absolute Beginner' | 'Beginner' | 'N5' | 'N4' | 'N3';
  week: number;
  day: number;
  category: LessonCategory;
  objective: string;
  summary: string;
  items: LessonItem[];
}

export interface WorkplaceSurvivalTopic {
  id: string;
  title: string;
  description: string;
  category: LessonCategory;
  priority: 'core' | 'important' | 'emergency';
}
