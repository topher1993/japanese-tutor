import type { SupportLanguage } from '../../types/lesson';

export type VocabularyReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface VocabularySource {
  id: string;
  sourceId?: string;
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
  partOfSpeech?: string;
  level: 'N5' | 'N4';
  source: VocabularySource;
  reviewStatus: VocabularyReviewStatus;
  pendingTranslations: SupportLanguage[];
}

import { n5VocabularyCandidatePack } from './n5VocabularyCandidateData';
import { getVerbVocabularyCandidatePack } from './verbVocabularyCandidatePack';

export function getN5VocabularyCandidatePack(): VocabularyCandidateEntry[] {
  const sourceBackedVerbs: VocabularyCandidateEntry[] = getVerbVocabularyCandidatePack('N5').map(entry => ({
    ...entry,
    vietnamese: '(pending vi review)',
    filipino: '(pending tl review)',
    category: 'verbs',
    pendingTranslations: ['vi', 'tl'],
  }));
  return [...n5VocabularyCandidatePack, ...sourceBackedVerbs];
}
