export type FlashcardAnswer = 'again' | 'good' | 'easy';
export type TranslationReviewStatus = 'approved' | 'draft';
export interface FlashcardReviewCard { id: string; lessonId: string; category: string; japanese: string; romaji: string; english: string; vietnamese: string; filipino: string; reviewCount: number; nextReviewDate: string; translationReviewStatus: TranslationReviewStatus; /**
   * Phase 37d-2: optional kind tag used by the weekly-todo gate to distinguish
   * vocab cards from kanji cards (proposal §5 row `kanji`). Default `vocab`
   * for everything constructed via `createFlashcardDeck` and the candidate
   * adapters. Optional so older constructions stay valid; consumers should
   * default to `'vocab'` when undefined.
   */
  kind?: 'vocab' | 'kanji'; }
export interface FlashcardDeck { id: string; title: string; cards: FlashcardReviewCard[]; }