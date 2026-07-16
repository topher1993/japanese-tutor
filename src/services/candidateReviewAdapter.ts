import { getN5VocabularyCandidatePack } from '../data/candidates/n5VocabularyCandidatePack';
import { getN4VocabularyCandidatePack } from '../data/candidates/n4CandidatePack';
import type { ReviewItem, ReviewLevel } from './reviewModeService';
import { createVocabularyEntryFromCandidate } from './vocabularyEntryService';
import type { JapanesePartOfSpeech, VocabularyLearningGroup } from '../types/vocabulary';

interface CandidateVocab {
  id: string;
  vocabularyId: string;
  japanese: string;
  english: string;
  category: string;
  level: ReviewLevel;
  reviewStatus: string;
  partOfSpeech: JapanesePartOfSpeech;
  learningGroup: VocabularyLearningGroup;
}

function approvedVocabulary(): CandidateVocab[] {
  const n5: CandidateVocab[] = getN5VocabularyCandidatePack()
    .filter(entry => entry.reviewStatus === 'approved-for-beta')
    .map(entry => {
      const vocabulary = createVocabularyEntryFromCandidate({
        id: entry.id,
        japanese: entry.japanese,
        kana: entry.kana,
        romaji: entry.romaji,
        english: entry.english,
        vietnamese: entry.vietnamese,
        filipino: entry.filipino,
        jlptLevel: entry.level === 'N4' ? 'N4' : 'N5',
        category: entry.category,
        sourcePartOfSpeech: entry.partOfSpeech,
        sourceKind: 'candidate-n5',
        source: entry.source.id,
        sourceId: entry.source.sourceId,
        license: entry.source.license,
        reviewStatus: entry.reviewStatus,
      });
      return {
        id: vocabulary.id,
        vocabularyId: vocabulary.id,
        japanese: vocabulary.japanese,
        english: vocabulary.meanings.en.join('; '),
        category: entry.category,
        level: vocabulary.jlptLevel === 'N4' ? 'N4' : 'N5',
        reviewStatus: entry.reviewStatus,
        partOfSpeech: vocabulary.partOfSpeech,
        learningGroup: vocabulary.learningGroup,
      };
    });
  const n4: CandidateVocab[] = getN4VocabularyCandidatePack()
    .filter(entry => entry.reviewStatus === 'approved-for-beta')
    .map(entry => {
      const vocabulary = createVocabularyEntryFromCandidate({
        id: entry.id,
        japanese: entry.japanese,
        kana: entry.kana,
        romaji: entry.romaji,
        english: entry.english,
        jlptLevel: 'N4',
        category: 'n4-vocab',
        sourcePartOfSpeech: entry.partOfSpeech,
        sourceKind: 'candidate-n4',
        source: entry.source.id,
        sourceId: entry.source.sourceId,
        license: entry.source.license,
        reviewStatus: entry.reviewStatus,
      });
      return {
        id: vocabulary.id,
        vocabularyId: vocabulary.id,
        japanese: vocabulary.japanese,
        english: vocabulary.meanings.en.join('; '),
        category: entry.partOfSpeech || 'n4-vocab',
        level: 'N4',
        reviewStatus: entry.reviewStatus,
        partOfSpeech: vocabulary.partOfSpeech,
        learningGroup: vocabulary.learningGroup,
      };
    });
  return [...n5, ...n4];
}

function normalizeChoice(value: string): string {
  return value.trim().toLowerCase();
}

function choicesFor(entry: CandidateVocab, pool: CandidateVocab[], index: number): { choices: string[]; correctIndex: number } {
  const seen = new Set<string>([normalizeChoice(entry.english)]);
  const distractors: string[] = [];
  const available = pool.filter(candidate => candidate.id !== entry.id);
  const sameGroup = available.filter(candidate => candidate.learningGroup === entry.learningGroup);
  const otherGroups = available.filter(candidate => candidate.learningGroup !== entry.learningGroup);
  const offset = sameGroup.length ? index % sameGroup.length : 0;
  const candidates = [
    ...sameGroup.slice(offset),
    ...sameGroup.slice(0, offset),
    ...otherGroups,
  ];
  for (const candidate of candidates) {
    const key = normalizeChoice(candidate.english);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distractors.push(candidate.english);
    if (distractors.length === 3) break;
  }
  const raw = [entry.english, ...distractors].slice(0, 4);
  while (raw.length < 4) raw.push(`Review option ${raw.length + 1}`);
  const answerOffset = index % 4;
  const choices = raw.map((_, choiceIndex) => raw[(choiceIndex + answerOffset) % 4]);
  return { choices, correctIndex: choices.indexOf(entry.english) };
}

export function buildCandidateReviewItems(level?: ReviewLevel, group?: VocabularyLearningGroup): ReviewItem[] {
  const pool = approvedVocabulary();
  const levelFiltered = level === 'N5'
    ? pool.filter(entry => entry.level === 'N5')
    : level === 'N4'
      ? pool.filter(entry => entry.level === 'N5' || entry.level === 'N4')
      : pool;
  const filtered = group ? levelFiltered.filter(entry => entry.learningGroup === group) : levelFiltered;
  return filtered.map((entry, index) => {
    const { choices, correctIndex } = choicesFor(entry, pool, index);
    return {
      id: `candidate-review-${entry.id}`,
      vocabularyId: entry.vocabularyId,
      prompt: `Meaning of 「${entry.japanese}」`,
      choices,
      correctIndex,
      jlptLevel: entry.level,
      category: entry.category,
      partOfSpeech: entry.partOfSpeech,
      learningGroup: entry.learningGroup,
    };
  });
}

/**
 * Counts of approved-for-beta vocabulary available to the Review Mode pool.
 */
export function getCandidateReviewCounts(): { n5: number; n4: number; total: number } {
  const pool = approvedVocabulary();
  const n5 = pool.filter(e => e.level === 'N5').length;
  const n4 = pool.filter(e => e.level === 'N4').length;
  return { n5, n4, total: n5 + n4 };
}
