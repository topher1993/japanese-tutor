export type N4ReviewStatus = 'candidate' | 'sensei-review-needed' | 'approved-for-beta' | 'rejected';

export interface N4Source {
  id: string;
  sourceId?: string;
  license: string;
}

export interface N4VocabularyCandidateEntry {
  id: string;
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  partOfSpeech: string;
  level: 'N4';
  source: N4Source;
  reviewStatus: N4ReviewStatus;
}

export interface N4KanjiCandidateEntry {
  id: string;
  kanji: string;
  onyomi: string[];
  kunyomi: string[];
  meanings: string[];
  jlptLevel: 'N4';
  reviewStatus: N4ReviewStatus;
}

import { n4VocabularyCandidateData } from './n4VocabularyCandidateData';
import { n4KanjiCandidateData } from './n4KanjiCandidateData';
import { getVerbVocabularyCandidatePack } from './verbVocabularyCandidatePack';

export function getN4VocabularyCandidatePack(): N4VocabularyCandidateEntry[] {
  return [
    ...n4VocabularyCandidateData,
    ...getVerbVocabularyCandidatePack('N4'),
  ];
}

export function getN4KanjiCandidatePack(): N4KanjiCandidateEntry[] {
  return n4KanjiCandidateData;
}
