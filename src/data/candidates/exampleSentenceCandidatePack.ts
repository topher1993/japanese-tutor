export type SentenceReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface SentenceSource {
  id: string;
  license: string;
}

export interface ExampleSentenceCandidateEntry {
  id: string;
  japanese: string;
  romaji: string;
  english: string;
  category: string;
  jlptLevel: 'N5' | 'N4';
  source: SentenceSource;
  reviewStatus: SentenceReviewStatus;
  connectedToApp: boolean;
}

import { exampleSentenceCandidatePack } from './exampleSentenceCandidateData';

export function getExampleSentenceCandidatePack(): ExampleSentenceCandidateEntry[] {
  return exampleSentenceCandidatePack;
}