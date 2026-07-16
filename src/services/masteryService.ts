import type { FlashcardReviewCard } from '../types/flashcard';
import type {
  MasteryDimensionScores,
  MasteryEvidence,
  MasteryGroupSummary,
  MasteryItem,
  MasteryLevel,
  MasteryMap,
  MasteryModality,
  MasteryPrerequisiteResult,
  MasterySnapshot,
  MasteryTopicSummary,
} from '../types/mastery';
import type { ReviewCard } from './spacedRepetitionService';
import { addLocalDateDays, localDateKey } from '../utils/localDate';
import {
  VOCABULARY_LEARNING_GROUPS,
  type VocabularyLearningGroup,
} from './vocabularyTaxonomyService';

const MODALITIES: MasteryModality[] = ['recognition', 'reading', 'listening', 'production'];
const DIMENSION_WEIGHTS: Record<MasteryModality, number> = {
  recognition: 0.4,
  reading: 0.25,
  listening: 0.2,
  production: 0.15,
};

export function masteryTopicLabel(topic: string): string {
  return topic
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => /^n[1-5]$/i.test(part) ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function clampScore(value: number): number {
  return Math.round(Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0)));
}

function dateMs(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(later: string, earlier: string): number {
  return Math.max(0, Math.floor((dateMs(later) - dateMs(earlier)) / 86_400_000));
}

export function recognitionScoreFromSrs(row: ReviewCard | undefined, now = new Date()): number {
  if (!row) return 0;
  const stageBase = row.stage === 'memorized' ? 66 : row.stage === 'recognized' ? 45 : 12;
  const scheduleStrength = Math.min(16, row.repetitions * 3) + Math.min(10, row.intervalDays * 0.5);
  const easeStrength = Math.max(-10, Math.min(10, (row.easeFactor - 2.2) * 12));
  const today = localDateKey(now);
  const overduePenalty = row.dueOn < today ? Math.min(28, daysBetween(today, row.dueOn) * 2) : 0;
  return clampScore(stageBase + scheduleStrength + easeStrength - overduePenalty);
}

function evidenceScore(evidence: MasteryEvidence[], nowIso: string): number | undefined {
  if (evidence.length === 0) return undefined;
  let weighted = 0;
  let weights = 0;
  for (const entry of evidence.slice(-12)) {
    const recencyWeight = Math.max(0.25, 1 - daysBetween(nowIso, entry.occurredAt) / 60);
    weighted += Math.min(1, Math.max(0, entry.score)) * 100 * recencyWeight;
    weights += recencyWeight;
  }
  return weights > 0 ? clampScore(weighted / weights) : undefined;
}

function blend(base: number, observed: number | undefined): number {
  if (observed == null) return clampScore(base);
  if (base <= 0) return clampScore(observed);
  return clampScore(base * 0.3 + observed * 0.7);
}

function overallScore(scores: MasteryDimensionScores): number {
  return clampScore(MODALITIES.reduce((sum, modality) => sum + scores[modality] * DIMENSION_WEIGHTS[modality], 0));
}

function levelFor(scores: MasteryDimensionScores, overall: number, evidenceCount: number): MasteryLevel {
  if (scores.recognition <= 12 && evidenceCount === 0) return 'new';
  const strongDimensions = MODALITIES.filter(modality => scores[modality] >= 60).length;
  if (overall >= 78 && scores.recognition >= 75 && strongDimensions >= 2) return 'mastered';
  if (overall >= 55 && scores.recognition >= 50) return 'familiar';
  return 'learning';
}

function weakestModality(scores: MasteryDimensionScores): MasteryModality {
  return MODALITIES.reduce((weakest, modality) => scores[modality] < scores[weakest] ? modality : weakest, MODALITIES[0]);
}

function averageScores(items: MasteryItem[]): MasteryDimensionScores {
  if (items.length === 0) return { recognition: 0, reading: 0, listening: 0, production: 0 };
  return MODALITIES.reduce((result, modality) => {
    result[modality] = clampScore(items.reduce((sum, item) => sum + item.scores[modality], 0) / items.length);
    return result;
  }, {} as MasteryDimensionScores);
}

function buildItem(
  card: FlashcardReviewCard,
  row: ReviewCard | undefined,
  evidence: MasteryEvidence[],
  now: Date,
): MasteryItem {
  const nowIso = now.toISOString();
  const recognitionBase = recognitionScoreFromSrs(row, now);
  const byModality = (modality: MasteryModality) => evidence.filter(entry => entry.modality === modality);
  const scores: MasteryDimensionScores = {
    recognition: blend(recognitionBase, evidenceScore(byModality('recognition'), nowIso)),
    reading: blend(recognitionBase * 0.72, evidenceScore(byModality('reading'), nowIso)),
    listening: blend(0, evidenceScore(byModality('listening'), nowIso)),
    production: blend(0, evidenceScore(byModality('production'), nowIso)),
  };
  const overall = overallScore(scores);
  const lastPracticedAt = evidence.reduce<string | undefined>(
    (latest, entry) => !latest || dateMs(entry.occurredAt) > dateMs(latest) ? entry.occurredAt : latest,
    row?.lastReviewedOn ?? undefined,
  );
  return {
    refId: card.id,
    japanese: card.japanese,
    reading: card.reading ?? card.romaji,
    english: card.english,
    topic: card.category || card.lessonId || 'General',
    learningGroup: card.learningGroup ?? 'expression',
    scores,
    overallScore: overall,
    level: levelFor(scores, overall, evidence.length),
    evidenceCount: evidence.length + (row?.lastReviewedOn ? 1 : 0),
    lastPracticedAt,
  };
}

function groupSummary(group: VocabularyLearningGroup, items: MasteryItem[]): MasteryGroupSummary {
  const scores = averageScores(items);
  return {
    group,
    score: overallScore(scores),
    itemCount: items.length,
    attemptedCount: items.filter(item => item.evidenceCount > 0).length,
    masteredCount: items.filter(item => item.level === 'mastered').length,
    weakestModality: weakestModality(scores),
    scores,
  };
}

function topicSummary(topic: string, items: MasteryItem[]): MasteryTopicSummary {
  const scores = averageScores(items);
  return {
    topic,
    score: overallScore(scores),
    itemCount: items.length,
    attemptedCount: items.filter(item => item.evidenceCount > 0).length,
    masteredCount: items.filter(item => item.level === 'mastered').length,
    weakestModality: weakestModality(scores),
  };
}

function changeFromSnapshots(current: number, snapshots: MasterySnapshot[], now: Date): number {
  const cutoff = addLocalDateDays(localDateKey(now), -7);
  const prior = snapshots
    .filter(snapshot => snapshot.date <= cutoff)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return prior ? current - prior.overallScore : 0;
}

export function buildMasteryMap({
  flashcards,
  srsCards,
  evidence = [],
  snapshots = [],
  now = new Date(),
}: {
  flashcards: FlashcardReviewCard[];
  srsCards: ReviewCard[];
  evidence?: MasteryEvidence[];
  snapshots?: MasterySnapshot[];
  now?: Date;
}): MasteryMap {
  const rowByRefId = new Map(srsCards.map(row => [row.refId, row]));
  const evidenceByRefId = new Map<string, MasteryEvidence[]>();
  for (const entry of evidence) {
    const current = evidenceByRefId.get(entry.refId) ?? [];
    current.push(entry);
    evidenceByRefId.set(entry.refId, current);
  }
  const uniqueCards = Array.from(new Map(flashcards.map(card => [card.id, card])).values());
  const items = uniqueCards.map(card => buildItem(card, rowByRefId.get(card.id), evidenceByRefId.get(card.id) ?? [], now));
  const groups = VOCABULARY_LEARNING_GROUPS.map(group => groupSummary(group, items.filter(item => item.learningGroup === group)));
  const topics = Array.from(new Set(items.map(item => item.topic)))
    .map(topic => topicSummary(topic, items.filter(item => item.topic === topic)))
    .sort((a, b) => a.score - b.score || b.itemCount - a.itemCount || a.topic.localeCompare(b.topic));
  const aggregateScores = averageScores(items);
  const overall = overallScore(aggregateScores);
  const levelCounts: Record<MasteryLevel, number> = { new: 0, learning: 0, familiar: 0, mastered: 0 };
  for (const item of items) levelCounts[item.level] += 1;
  const attemptedGroups = groups.filter(group => group.attemptedCount > 0);
  const weakestGroup = (attemptedGroups.length ? attemptedGroups : groups.filter(group => group.itemCount > 0))
    .sort((a, b) => a.score - b.score)[0]?.group;
  return {
    items,
    groups,
    topics,
    scores: aggregateScores,
    overallScore: overall,
    levelCounts,
    weakestGroup,
    weakestModality: weakestModality(aggregateScores),
    weeklyChange: changeFromSnapshots(overall, snapshots, now),
    generatedAt: now.toISOString(),
  };
}

export function buildMasterySnapshot(map: MasteryMap, date = map.generatedAt.slice(0, 10)): MasterySnapshot {
  return {
    date,
    overallScore: map.overallScore,
    groupScores: Object.fromEntries(map.groups.map(group => [group.group, group.score])),
  };
}

export function evaluateMasteryPrerequisite(
  map: MasteryMap,
  group?: VocabularyLearningGroup,
  minimumScore = 45,
  minimumAttempts = 3,
): MasteryPrerequisiteResult {
  const items = group ? map.items.filter(item => item.learningGroup === group) : map.items;
  const attempted = items.filter(item => item.evidenceCount > 0);
  const score = attempted.length
    ? clampScore(attempted.reduce((sum, item) => sum + item.overallScore, 0) / attempted.length)
    : 0;
  if (attempted.length < minimumAttempts) {
    return {
      allowed: true,
      score,
      attemptedCount: attempted.length,
      reason: 'Keep learning: there is not enough practice evidence to apply a mastery gate yet.',
    };
  }
  if (score < minimumScore) {
    return {
      allowed: false,
      score,
      attemptedCount: attempted.length,
      reason: `Strengthen ${group ?? 'prerequisite'} recall to ${minimumScore}% before advancing.`,
    };
  }
  return { allowed: true, score, attemptedCount: attempted.length, reason: 'Prerequisite mastery is strong enough to advance.' };
}

/** Navigation-safe gate derived from persisted state only. New learners are
 * never blocked; five distinct practiced items are required before a low
 * snapshot is treated as meaningful prerequisite evidence. */
export function evaluatePersistedMasteryGate(
  evidence: MasteryEvidence[] = [],
  snapshots: MasterySnapshot[] = [],
  minimumScore = 35,
): MasteryPrerequisiteResult {
  const evidenceByRef = new Map<string, MasteryEvidence[]>();
  for (const item of evidence) {
    const current = evidenceByRef.get(item.refId) ?? [];
    current.push(item);
    evidenceByRef.set(item.refId, current);
  }
  const attemptedCount = evidenceByRef.size;
  const latest = [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0];
  const evidenceScores = Array.from(evidenceByRef.values()).map(entries => {
    let weightedScore = 0;
    let observedWeight = 0;
    for (const modality of MODALITIES) {
      const observations = entries.filter(item => item.modality === modality);
      if (observations.length === 0) continue;
      const latestObservation = observations.reduce((latest, item) => (
        dateMs(item.occurredAt) >= dateMs(latest.occurredAt) ? item : latest
      ));
      weightedScore += Math.min(1, Math.max(0, latestObservation.score)) * 100 * DIMENSION_WEIGHTS[modality];
      observedWeight += DIMENSION_WEIGHTS[modality];
    }
    return observedWeight > 0 ? weightedScore / observedWeight : 0;
  });
  const currentScore = evidenceScores.length > 0
    ? clampScore(evidenceScores.reduce((sum, score) => sum + score, 0) / evidenceScores.length)
    : latest?.overallScore ?? 0;

  if (attemptedCount < 5) {
    return {
      allowed: true,
      score: currentScore,
      attemptedCount,
      reason: 'The mastery gate is observing practice and will not block early learning.',
    };
  }
  if (currentScore < minimumScore) {
    return {
      allowed: false,
      score: currentScore,
      attemptedCount,
      reason: `Build prerequisite mastery to ${minimumScore}% before starting the next week.`,
    };
  }
  return {
    allowed: true,
    score: currentScore,
    attemptedCount,
    reason: 'Prerequisite mastery is strong enough to advance.',
  };
}
