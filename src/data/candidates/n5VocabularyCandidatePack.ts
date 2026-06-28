import type { SupportLanguage } from '../../types/lesson';

export type VocabularyReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface VocabularySource {
  id: string;
  license: string;
}

export interface VocabularyCandidateEntry {
  id: string;
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  category: string;
  level: 'N5' | 'N4';
  source: VocabularySource;
  reviewStatus: VocabularyReviewStatus;
  pendingTranslations: SupportLanguage[];
}

import { n5VocabularyCandidatePack } from './n5VocabularyCandidateData';

export function getN5VocabularyCandidatePack(): VocabularyCandidateEntry[] {
  return n5VocabularyCandidatePack;
}