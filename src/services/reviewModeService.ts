import { buildCandidateReviewItems } from './candidateReviewAdapter';
import type { JapanesePartOfSpeech, VocabularyLearningGroup } from './vocabularyTaxonomyService';

export type ReviewLevel = 'N5' | 'N4';

export interface ReviewItem {
  id: string;
  vocabularyId?: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
  jlptLevel: ReviewLevel;
  category: string;
  partOfSpeech: JapanesePartOfSpeech;
  learningGroup: VocabularyLearningGroup;
}

export interface ReviewSessionResult {
  correctCount: number;
  percent: number;
}

export interface ReviewSession {
  items: ReviewItem[];
  totalCount: number;
  score(responses: number[]): ReviewSessionResult;
}

export function buildReviewSession(level?: ReviewLevel, group?: VocabularyLearningGroup): ReviewSession {
  const items = buildCandidateReviewItems(level, group);
  return {
    items,
    totalCount: items.length,
    score(responses: number[]) {
      let correct = 0;
      for (let i = 0; i < items.length; i += 1) {
        if (responses[i] === items[i].correctIndex) correct += 1;
      }
      const percent = items.length === 0 ? 0 : Math.round((correct / items.length) * 100);
      return { correctCount: correct, percent };
    },
  };
}
