import { adjectiveVocabularyCandidateData } from './adjectiveVocabularyCandidateData';
import { getVerbVocabularyCandidatePack } from './verbVocabularyCandidatePack';

export type N3VocabularyReviewStatus = 'approved-for-beta';

export interface N3VocabularySource {
  id: 'jmdict-edrdg';
  sourceId?: string;
  license: 'CC BY-SA 4.0';
}

export interface N3VocabularyCandidateEntry {
  id: string;
  japanese: string;
  kana: string;
  romaji: string;
  english: string;
  vietnamese: string;
  filipino: string;
  partOfSpeech: string;
  level: 'N3';
  source: N3VocabularySource;
  reviewStatus: N3VocabularyReviewStatus;
}

const helperTranslations: Record<string, { vietnamese: string; filipino: string }> = {
  'jmdict-adj-0001': { vietnamese: 'cứng', filipino: 'matigas' },
  'jmdict-adj-0002': { vietnamese: 'nhanh; sớm', filipino: 'mabilis; maaga' },
  'jmdict-adj-0004': { vietnamese: 'đủ; đầy đủ', filipino: 'sapat' },
  'jmdict-adj-0005': { vietnamese: 'chính xác', filipino: 'tumpak' },
  'jmdict-adj-0007': { vietnamese: 'phóng đại', filipino: 'pinalabis' },
  'jmdict-adj-0010': { vietnamese: 'quý giá', filipino: 'mahalaga' },
  'jmdict-adj-0011': { vietnamese: 'độc đáo', filipino: 'natatangi' },
  'jmdict-adj-0012': { vietnamese: 'đại khái; sơ sài', filipino: 'pangkalahatan; magaspang' },
  'jmdict-adj-0013': { vietnamese: 'cô đơn', filipino: 'malungkot; nag-iisa' },
  'jmdict-adj-0014': { vietnamese: 'cảm ơn vì đã làm việc vất vả', filipino: 'salamat sa pagsisikap' },
  'jmdict-adj-0015': { vietnamese: 'thay thế', filipino: 'kapalit' },
  'jmdict-adj-0016': { vietnamese: 'trung bình', filipino: 'karaniwan' },
  'jmdict-adj-0017': { vietnamese: 'bình thường', filipino: 'karaniwan' },
  'jmdict-adj-0018': { vietnamese: 'không thích', filipino: 'ayaw' },
  'jmdict-adj-0019': { vietnamese: 'tròn', filipino: 'bilog' },
  'jmdict-adj-0020': { vietnamese: 'gấp đôi', filipino: 'doble' },
  'jmdict-adj-0022': { vietnamese: 'hợp tác; chung', filipino: 'pagtutulungan; sama-sama' },
  'jmdict-adj-0023': { vietnamese: 'bị động', filipino: 'pasibo' },
  'jmdict-adj-0024': { vietnamese: 'duy nhất', filipino: 'nag-iisa' },
  'jmdict-adj-0025': { vietnamese: 'dạng cố định', filipino: 'nakapirming anyo' },
};

const n3AdjectiveCandidateData: N3VocabularyCandidateEntry[] = adjectiveVocabularyCandidateData
  .filter(entry => entry.level === 'N3' && entry.source.id === 'jmdict-edrdg')
  .map(sourceEntry => {
  const id = sourceEntry.id;
  const translations = helperTranslations[id] ?? { vietnamese: '', filipino: '' };

  return {
    id: sourceEntry.id,
    japanese: sourceEntry.japanese,
    kana: sourceEntry.kana,
    romaji: sourceEntry.romaji,
    english: sourceEntry.english,
    vietnamese: translations.vietnamese,
    filipino: translations.filipino,
    partOfSpeech: sourceEntry.partOfSpeech,
    level: 'N3',
    source: sourceEntry.source,
    reviewStatus: 'approved-for-beta',
  };
  });

const n3VerbCandidateData: N3VocabularyCandidateEntry[] = getVerbVocabularyCandidatePack('N3')
  .map(entry => ({
    ...entry,
    vietnamese: '',
    filipino: '',
  }));

export const n3VocabularyCandidateData: N3VocabularyCandidateEntry[] = [
  ...n3AdjectiveCandidateData,
  ...n3VerbCandidateData,
];

export function getN3VocabularyCandidatePack(): N3VocabularyCandidateEntry[] {
  return n3VocabularyCandidateData;
}
