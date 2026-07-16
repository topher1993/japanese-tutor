import type { VocabularyLearningGroup } from '../services/vocabularyTaxonomyService';

export type MasteryModality = 'recognition' | 'reading' | 'listening' | 'production';
export type MasteryLevel = 'new' | 'learning' | 'familiar' | 'mastered';
export type MasteryEvidenceSource =
  | 'flashcards'
  | 'daily-rush'
  | 'quiz'
  | 'sentence-lab'
  | 'listening'
  | 'shadowing';

export interface MasteryEvidence {
  id: string;
  refId: string;
  modality: MasteryModality;
  /** Normalized outcome from 0 (failed) to 1 (independent success). */
  score: number;
  source: MasteryEvidenceSource;
  occurredAt: string;
}

export interface MasteryDimensionScores {
  recognition: number;
  reading: number;
  listening: number;
  production: number;
}

export interface MasteryItem {
  refId: string;
  japanese: string;
  reading: string;
  english: string;
  topic: string;
  learningGroup: VocabularyLearningGroup;
  scores: MasteryDimensionScores;
  overallScore: number;
  level: MasteryLevel;
  evidenceCount: number;
  lastPracticedAt?: string;
}

export interface MasteryGroupSummary {
  group: VocabularyLearningGroup;
  score: number;
  itemCount: number;
  attemptedCount: number;
  masteredCount: number;
  weakestModality: MasteryModality;
  scores: MasteryDimensionScores;
}

export interface MasteryTopicSummary {
  topic: string;
  score: number;
  itemCount: number;
  attemptedCount: number;
  masteredCount: number;
  weakestModality: MasteryModality;
}

export interface MasterySnapshot {
  date: string;
  overallScore: number;
  groupScores: Partial<Record<VocabularyLearningGroup, number>>;
}

export interface MasteryMap {
  items: MasteryItem[];
  groups: MasteryGroupSummary[];
  topics: MasteryTopicSummary[];
  scores: MasteryDimensionScores;
  overallScore: number;
  levelCounts: Record<MasteryLevel, number>;
  weakestGroup?: VocabularyLearningGroup;
  weakestModality: MasteryModality;
  weeklyChange: number;
  generatedAt: string;
}

export interface MasteryPrerequisiteResult {
  allowed: boolean;
  score: number;
  attemptedCount: number;
  reason: string;
}
