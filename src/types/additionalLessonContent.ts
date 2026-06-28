import type { LessonCategoryCardId } from '../services/lessonCategoryService';

export type AdditionalLessonCategoryId = Exclude<LessonCategoryCardId, 'workplace'>;

export type TranslationReviewStatus = 'approved' | 'draft';

export interface AdditionalLessonPhrase {
  id: string;
  japanese: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  usageNote: string;
  translationReviewStatus: TranslationReviewStatus;
}

export interface AdditionalLessonCategoryContent {
  id: AdditionalLessonCategoryId;
  title: string;
  description: string;
  coachTip: string;
  phrases: AdditionalLessonPhrase[];
}
