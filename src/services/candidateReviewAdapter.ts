import { getN5VocabularyCandidatePack } from '../data/candidates/n5VocabularyCandidatePack';
import { getN4VocabularyCandidatePack } from '../data/candidates/n4CandidatePack';
import type { ReviewItem, ReviewLevel } from './reviewModeService';

interface CandidateVocab {
  id: string;
  japanese: string;
  english: string;
  category: string;
  level: ReviewLevel;
  reviewStatus: string;
}

function approvedVocabulary(): CandidateVocab[] {
  const n5: CandidateVocab[] = getN5VocabularyCandidatePack()
    .filter(entry => entry.reviewStatus === 'approved-for-beta')
    .map(entry => ({
      id: entry.id,
      japanese: entry.japanese,
      english: entry.english,
      category: entry.category,
      level: 'N5',
      reviewStatus: entry.reviewStatus,
    }));
  const n4: CandidateVocab[] = getN4VocabularyCandidatePack()
    .filter(entry => entry.reviewStatus === 'approved-for-beta')
    .map(entry => ({
      id: entry.id,
      japanese: entry.japanese,
      english: entry.english,
      category: entry.partOfSpeech || 'n4-vocab',
      level: 'N4',
      reviewStatus: entry.reviewStatus,
    }));
  return [...n5, ...n4];
}

function normalizeChoice(value: string): string {
  return value.trim().toLowerCase();
}

function choicesFor(entry: CandidateVocab, pool: CandidateVocab[], index: number): { choices: string[]; correctIndex: number } {
  const seen = new Set<string>([normalizeChoice(entry.english)]);
  const distractors: string[] = [];
  const candidates = pool
    .filter(candidate => candidate.id !== entry.id)
    .slice(index + 1)
    .concat(pool.filter(candidate => candidate.id !== entry.id).slice(0, index + 1));
  for (const candidate of candidates) {
    const key = normalizeChoice(candidate.english);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distractors.push(candidate.english);
    if (distractors.length === 3) break;
  }
  const raw = [entry.english, ...distractors].slice(0, 4);
  while (raw.length < 4) raw.push(`Review option ${raw.length + 1}`);
  const offset = index % 4;
  const choices = raw.map((_, choiceIndex) => raw[(choiceIndex + offset) % 4]);
  return { choices, correctIndex: choices.indexOf(entry.english) };
}

export function buildCandidateReviewItems(level?: ReviewLevel): ReviewItem[] {
  const pool = approvedVocabulary();
  const filtered = level === 'N5'
    ? pool.filter(entry => entry.level === 'N5')
    : level === 'N4'
      ? pool.filter(entry => entry.level === 'N5' || entry.level === 'N4')
      : pool;
  return filtered.map((entry, index) => {
    const { choices, correctIndex } = choicesFor(entry, pool, index);
    return {
      id: `candidate-review-${entry.id}`,
      prompt: `Meaning of 「${entry.japanese}」`,
      choices,
      correctIndex,
      jlptLevel: entry.level,
      category: entry.category,
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