export type FlashcardAnswer = 'again' | 'good' | 'easy';
export type TranslationReviewStatus = 'approved' | 'draft';
export interface FlashcardReviewCard { id: string; lessonId: string; category: string; japanese: string; romaji: string; english: string; vietnamese: string; filipino: string; reviewCount: number; nextReviewDate: string; translationReviewStatus: TranslationReviewStatus; }
export interface FlashcardDeck { id: string; title: string; cards: FlashcardReviewCard[]; }
