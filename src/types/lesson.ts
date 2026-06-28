export type SupportLanguage = 'en' | 'vi' | 'tl';
export type LessonCategory = 'workplace' | 'safety' | 'daily-life' | 'hr' | 'emergency' | 'grammar';
export type TranslationReviewStatus = 'approved' | 'draft';

export interface LessonItem {
  id: string;
  japanese: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  category: LessonCategory;
  exampleJapanese: string;
  exampleEnglish: string;
  translationReviewStatus: TranslationReviewStatus;
}

export interface SenseiLesson {
  id: string;
  title: string;
  level: 'Beginner' | 'N5' | 'N4';
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
