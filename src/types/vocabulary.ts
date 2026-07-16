export type VocabularyJlptLevel = 'N5' | 'N4' | 'N3';

export type VocabularySourceKind = 'candidate-n5' | 'candidate-n4' | 'candidate-n3' | 'lesson' | 'supplemental';

export type VocabularyContentReviewStatus =
  | 'candidate'
  | 'sensei-review-needed'
  | 'approved-for-beta'
  | 'approved'
  | 'draft'
  | 'rejected';

export type VocabularySourceUsage = 'vocabulary' | 'kanji' | 'example-sentence';

export interface VocabularySourceReference {
  source: string;
  sourceId: string;
  license: string;
  usage: VocabularySourceUsage;
}

export type JapanesePartOfSpeech =
  | 'noun'
  | 'verb'
  | 'i-adjective'
  | 'na-adjective'
  | 'adjectival-expression'
  | 'adverb'
  | 'particle'
  | 'pronoun'
  | 'determiner'
  | 'counter'
  | 'conjunction'
  | 'expression';

export type VocabularyLearningGroup = 'noun' | 'verb' | 'adjective' | 'expression';
export type JapaneseVerbGroup = 'godan' | 'ichidan' | 'irregular';
export type VerbTransitivity = 'transitive' | 'intransitive';
export type ClassificationConfidence = 'source' | 'rule' | 'inferred';

export interface VocabularyTaxonomy {
  partOfSpeech: JapanesePartOfSpeech;
  learningGroup: VocabularyLearningGroup;
  dictionaryForm?: string;
  verbGroup?: JapaneseVerbGroup;
  transitivity?: VerbTransitivity;
  classificationConfidence: ClassificationConfidence;
}

export interface VocabularyTaxonomyInput {
  japanese: string;
  reading?: string;
  romaji: string;
  english: string;
  category?: string;
  sourcePartOfSpeech?: string;
  sourceKind?: VocabularySourceKind;
}

export interface VocabularyMeanings {
  en: string[];
  vi: string[];
  tl: string[];
}

export interface VocabularyExample {
  japanese: string;
  romaji?: string;
  en?: string;
  vi?: string;
  tl?: string;
}

/** Shared, learner-independent vocabulary content. SRS state belongs elsewhere. */
export interface VocabularyEntry extends VocabularyTaxonomy {
  id: string;
  japanese: string;
  kana?: string;
  romaji: string;
  meanings: VocabularyMeanings;
  jlptLevel?: VocabularyJlptLevel;
  topics: string[];
  examples?: VocabularyExample[];
  sourceRefs?: VocabularySourceReference[];
  reviewStatus?: VocabularyContentReviewStatus;
}
