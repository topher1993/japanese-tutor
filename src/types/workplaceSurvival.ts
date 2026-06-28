export type SurvivalCategoryId = 'greetings' | 'help' | 'safety' | 'schedule' | 'tools' | 'breaks' | 'absence' | 'emergency' | 'health' | 'directions' | 'polite' | 'meetings' | 'phone' | 'office';
export type SurvivalPriority = 'core' | 'important' | 'emergency';
export type TranslationReviewStatus = 'approved' | 'draft';
export interface SurvivalPhrase { id: string; categoryId: SurvivalCategoryId; japanese: string; romaji: string; english: string; vietnamese: string; filipino: string; priority: SurvivalPriority; usageNote: string; translationReviewStatus: TranslationReviewStatus; }
export interface SurvivalCategory { id: SurvivalCategoryId; title: string; description: string; phraseCount: number; priority: SurvivalPriority; }
export interface SurvivalTopicDetail extends SurvivalCategory { coachTip: string; phrases: SurvivalPhrase[]; }
