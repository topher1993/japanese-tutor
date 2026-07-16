import type {
  VocabularyContentReviewStatus,
  VocabularyEntry,
  VocabularyJlptLevel,
  VocabularySourceReference,
} from '../types/vocabulary';
import type { LessonItem, SenseiLesson } from '../types/lesson';
import { classifyVocabulary } from './vocabularyTaxonomyService';

export interface VocabularyEntryInput {
  id: string;
  japanese: string;
  kana?: string;
  romaji: string;
  english: string;
  vietnamese?: string;
  filipino?: string;
  jlptLevel?: VocabularyJlptLevel;
  category?: string;
  topics?: string[];
  sourcePartOfSpeech?: string;
  sourceKind?: 'candidate-n5' | 'candidate-n4' | 'candidate-n3' | 'lesson' | 'supplemental';
  examples?: VocabularyEntry['examples'];
  sourceRefs?: VocabularySourceReference[];
  reviewStatus?: VocabularyContentReviewStatus;
}

export interface VocabularyCandidateInput {
  id: string;
  japanese: string;
  kana?: string;
  romaji: string;
  english: string;
  vietnamese?: string;
  filipino?: string;
  jlptLevel: VocabularyJlptLevel;
  category: string;
  sourcePartOfSpeech?: string;
  sourceKind: 'candidate-n5' | 'candidate-n4' | 'candidate-n3';
  source: string;
  sourceId?: string;
  license: string;
  reviewStatus: VocabularyContentReviewStatus;
}

function splitMeanings(value: string | undefined): string[] {
  return (value ?? '').split(/\s*;\s*/).map(part => part.trim()).filter(Boolean);
}

export function createVocabularyEntry(input: VocabularyEntryInput): VocabularyEntry {
  const taxonomy = classifyVocabulary({
    japanese: input.japanese,
    reading: input.kana,
    romaji: input.romaji,
    english: input.english,
    category: input.category,
    sourcePartOfSpeech: input.sourcePartOfSpeech,
    sourceKind: input.sourceKind,
  });

  return {
    id: input.id,
    japanese: input.japanese,
    kana: input.kana,
    romaji: input.romaji,
    meanings: {
      en: splitMeanings(input.english),
      vi: splitMeanings(input.vietnamese),
      tl: splitMeanings(input.filipino),
    },
    jlptLevel: input.jlptLevel,
    topics: input.topics ?? (input.category ? [input.category] : []),
    examples: input.examples,
    sourceRefs: input.sourceRefs,
    reviewStatus: input.reviewStatus,
    ...taxonomy,
  };
}

export function createVocabularyEntryFromLessonItem(item: LessonItem, level: SenseiLesson['level']): VocabularyEntry {
  return createVocabularyEntry({
    id: item.vocabularyId ?? item.id,
    japanese: item.japanese,
    romaji: item.romaji,
    english: item.english,
    vietnamese: item.vietnamese,
    filipino: item.filipino,
    jlptLevel: level === 'N5' || level === 'N4' || level === 'N3'
      ? level
      : undefined,
    category: item.category,
    topics: [item.category],
    sourceKind: 'lesson',
    examples: [{ japanese: item.exampleJapanese, romaji: item.exampleRomaji, en: item.exampleEnglish }],
    sourceRefs: item.sourceRefs,
  });
}

export function createVocabularyEntryFromCandidate(input: VocabularyCandidateInput): VocabularyEntry {
  return createVocabularyEntry({
    id: input.id,
    japanese: input.japanese,
    kana: input.kana,
    romaji: input.romaji,
    english: input.english,
    vietnamese: input.vietnamese,
    filipino: input.filipino,
    jlptLevel: input.jlptLevel,
    category: input.category,
    topics: [input.category],
    sourcePartOfSpeech: input.sourcePartOfSpeech,
    sourceKind: input.sourceKind,
    sourceRefs: [{ source: input.source, sourceId: input.sourceId ?? input.id, license: input.license, usage: 'vocabulary' }],
    reviewStatus: input.reviewStatus,
  });
}

export function hydrateLessonVocabulary(lessons: SenseiLesson[]): SenseiLesson[] {
  for (const lesson of lessons) {
    for (const item of lesson.items) {
      item.vocabulary ??= createVocabularyEntryFromLessonItem(item, lesson.level);
    }
  }
  return lessons;
}

/** Maps shared content into the card shape; review scheduling remains outside the entry. */
export function flashcardContentFromVocabulary(vocabulary: VocabularyEntry) {
  return {
    vocabularyId: vocabulary.id,
    japanese: vocabulary.japanese,
    reading: vocabulary.kana,
    romaji: vocabulary.romaji,
    english: vocabulary.meanings.en.join('; '),
    vietnamese: vocabulary.meanings.vi.join('; '),
    filipino: vocabulary.meanings.tl.join('; '),
    jlptLevel: vocabulary.jlptLevel,
    topics: vocabulary.topics,
    partOfSpeech: vocabulary.partOfSpeech,
    learningGroup: vocabulary.learningGroup,
    dictionaryForm: vocabulary.dictionaryForm,
    verbGroup: vocabulary.verbGroup,
    transitivity: vocabulary.transitivity,
    classificationConfidence: vocabulary.classificationConfidence,
  };
}
