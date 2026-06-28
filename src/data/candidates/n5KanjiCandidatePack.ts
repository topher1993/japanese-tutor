export type KanjiReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface KanjiSource {
  id: string;
  license: string;
}

export interface KanjiCandidateEntry {
  id: string;
  kanji: string;
  meanings: string[];
  onReadings: string[];
  kunReadings: string[];
  romaji: string;
  strokeCount: number;
  jlptLevel: 'N5' | 'N4';
  vietnamese: string;
  filipino: string;
  source: KanjiSource;
  reviewStatus: KanjiReviewStatus;
}

import { n5KanjiCandidatePack } from './n5KanjiCandidateData';

export function getN5KanjiCandidatePack(): KanjiCandidateEntry[] {
  return n5KanjiCandidatePack;
}