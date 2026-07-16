export type AdjectiveReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface AdjectiveSource {
  id: 'jmdict-edrdg';
  license: 'CC BY-SA 4.0';
}

export interface AdjectiveVocabularyCandidateEntry {
  id: string;
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  partOfSpeech: string;
  level: 'N3' | 'N2' | 'N1';
  source: AdjectiveSource;
  reviewStatus: AdjectiveReviewStatus;
}

import { adjectiveVocabularyCandidateData } from './adjectiveVocabularyCandidateData';

export function getAdjectiveVocabularyCandidatePack(): AdjectiveVocabularyCandidateEntry[] {
  return adjectiveVocabularyCandidateData;
}
