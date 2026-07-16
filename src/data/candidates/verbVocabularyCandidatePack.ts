export type VerbVocabularyLevel = 'N5' | 'N4' | 'N3';

export interface VerbVocabularySource {
  id: 'jmdict-edrdg';
  sourceId: `JMdict:${string}`;
  license: 'CC BY-SA 4.0';
}

export interface VerbVocabularyCandidateEntry {
  id: string;
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  partOfSpeech: string;
  level: VerbVocabularyLevel;
  levelSource: 'japanese-tutor-curation';
  placementEvidence: 'curated-n5-verb-list' | 'curated-n4-verb-list' | 'jmdict-priority-n3-candidate';
  source: VerbVocabularySource;
  reviewStatus: 'approved-for-beta';
}

import { verbVocabularyCandidateData } from './verbVocabularyCandidateData';

export function getVerbVocabularyCandidatePack<L extends VerbVocabularyLevel>(
  level: L,
): Array<VerbVocabularyCandidateEntry & { level: L }>;
export function getVerbVocabularyCandidatePack(): VerbVocabularyCandidateEntry[];
export function getVerbVocabularyCandidatePack(
  level?: VerbVocabularyLevel,
): VerbVocabularyCandidateEntry[] {
  return level
    ? verbVocabularyCandidateData.filter(entry => entry.level === level)
    : verbVocabularyCandidateData;
}
