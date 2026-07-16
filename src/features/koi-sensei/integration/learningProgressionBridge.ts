import { getN4VocabularyCandidatePack } from '../../../data/candidates/n4CandidatePack';
import { getN5VocabularyCandidatePack } from '../../../data/candidates/n5VocabularyCandidatePack';
import { getAllCourseLessons, getGrammarLessons, getPhraseLessons } from '../../../services/lessonService';
import type { MasteryEvidence } from '../../../types/mastery';
import type { LearnerProgress } from '../../../types/progress';
import type { SenseiLesson } from '../../../types/lesson';
import type { TodoEventCounts } from '../../../types/weeklyTodo';
import type {
  KoiQueuedMasteryClaimV1,
  KoiSenseiRepository,
} from '../data/koiSenseiRepository';
import {
  KOI_DOMAINS,
  KOI_RANKS,
  advanceKoiRank,
  applyKoiMilestone,
  createDefaultKoiProgression,
  getKoiDomainGate,
  type KoiContentAvailabilityManifestV1,
  type KoiDomain,
  type KoiMilestoneKind,
  type KoiProgressionStateV1,
  type KoiRank,
} from '../domain';
import { auditKoiContentEvidence } from '../governance/contentEvidenceAudit';

const AUDITED_KOI_CONTENT_AVAILABILITY = auditKoiContentEvidence().availability;

/**
 * Conservative local milestone thresholds. Practice always requires activity
 * across multiple distinct governed items when the catalog has more than one.
 * Mastery requires a larger distinct set plus successful evidence; repeatedly
 * exercising one item can never unlock a mastery cosmetic.
 */
export const KOI_LEARNING_MILESTONE_THRESHOLDS = Object.freeze({
  practiceDistinctVocabularyItems: 3,
  masteryDistinctVocabularyItems: 8,
  vocabularyMasteryEvidencePerItem: 2,
  vocabularyMasteryModalitiesPerItem: 2,
  vocabularyMasteryMinimumScore: 0.7,
  practiceDistinctLessons: 2,
  masteryDistinctLessons: 3,
  lessonMasteryMinimumScore: 80,
  practiceDistinctQuizzes: 2,
  masteryDistinctQuizzes: 3,
  quizMasteryMinimumScore: 80,
} as const);

/** One rank contains eight milestones, so a single sync never needs more. */
export const KOI_MAX_LEARNING_CLAIMS_PER_SYNC = 8;
/** Keep retry markers compact and content-free even when evidence grows. */
export const KOI_MAX_EVIDENCE_IDS_PER_CLAIM = 24;

export interface KoiLearningExtendedProgress {
  todoEventCounts?: Partial<TodoEventCounts>;
}

export interface KoiLearningProgressionInput {
  progression: KoiProgressionStateV1;
  progress: LearnerProgress;
  extended: KoiLearningExtendedProgress;
  occurredAt: number;
}

export interface KoiLearningProgressionPlan {
  progression: KoiProgressionStateV1;
  claims: KoiQueuedMasteryClaimV1[];
  awardedMilestoneIds: string[];
  advancedRanks: KoiRank[];
  changed: boolean;
}

export interface KoiLearningProgressStoreSource {
  ready(): Promise<void>;
  getExtendedProgress(): { todoEventCounts: TodoEventCounts };
  subscribeExtendedProgress(listener: () => void): () => void;
}

export interface KoiLearningRepositorySource {
  getProgress(): Promise<LearnerProgress>;
}

export interface KoiLearningProgressionSubscriptionOptions {
  learningStore: KoiLearningProgressStoreSource;
  learningRepository: KoiLearningRepositorySource;
  koiRepository: KoiSenseiRepository;
  availability?: KoiContentAvailabilityManifestV1;
  now?: () => number;
  shouldContinue?: () => boolean;
  onPersisted?: (plan: KoiLearningProgressionPlan) => Promise<void> | void;
  onError?: (cause: unknown) => void;
}

export interface KoiLearningProgressionSubscription {
  drain(): Promise<void>;
  syncNow(): Promise<void>;
  unsubscribe(): void;
}

interface DomainEvidence {
  practiceIds: string[];
  masteryIds: string[];
  catalogSize: number;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function requiredDistinct(catalogSize: number, desired: number): number {
  if (!Number.isSafeInteger(catalogSize) || catalogSize <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(catalogSize, desired);
}

function koiRankForLesson(lesson: SenseiLesson): KoiRank | null {
  if (lesson.level === 'Absolute Beginner' || lesson.level === 'Beginner' || lesson.level === 'N5') {
    return 'N5';
  }
  if (lesson.level === 'N4' || lesson.level === 'N3') return lesson.level;
  return null;
}

function lessonsAtRank(lessons: readonly SenseiLesson[], rank: KoiRank): SenseiLesson[] {
  return lessons.filter(lesson => koiRankForLesson(lesson) === rank);
}

function bestScoreByLesson(progress: LearnerProgress): Map<string, number> {
  const result = new Map<string, number>();
  for (const entry of progress.quizScores) {
    if (typeof entry.lessonId !== 'string' || !Number.isFinite(entry.score)) continue;
    result.set(entry.lessonId, Math.max(result.get(entry.lessonId) ?? Number.NEGATIVE_INFINITY, entry.score));
  }
  return result;
}

function lessonEvidence(
  lessons: readonly SenseiLesson[],
  rank: KoiRank,
  progress: LearnerProgress,
): DomainEvidence {
  const catalog = lessonsAtRank(lessons, rank);
  const allowed = new Set(catalog.map(lesson => lesson.id));
  const completed = uniqueSorted(progress.completedLessonIds.filter(id => allowed.has(id)));
  const scores = bestScoreByLesson(progress);
  const mastered = completed.filter(id => (
    (scores.get(id) ?? Number.NEGATIVE_INFINITY) >= KOI_LEARNING_MILESTONE_THRESHOLDS.lessonMasteryMinimumScore
  ));
  return {
    practiceIds: completed.map(id => `lesson:${id}`),
    masteryIds: mastered.map(id => `lesson:${id}`),
    catalogSize: catalog.length,
  };
}

function quizEvidence(rank: KoiRank, progress: LearnerProgress): DomainEvidence {
  const catalog = lessonsAtRank(getAllCourseLessons(), rank);
  const allowed = new Set(catalog.map(lesson => lesson.id));
  const attempted = new Set<string>();
  const mastered = new Set<string>();
  for (const entry of progress.quizScores) {
    if (!allowed.has(entry.lessonId) || !Number.isFinite(entry.score)) continue;
    attempted.add(entry.lessonId);
    if (entry.score >= KOI_LEARNING_MILESTONE_THRESHOLDS.quizMasteryMinimumScore) {
      mastered.add(entry.lessonId);
    }
  }
  return {
    practiceIds: uniqueSorted(attempted).map(id => `quiz:${id}`),
    masteryIds: uniqueSorted(mastered).map(id => `quiz:${id}`),
    catalogSize: catalog.length,
  };
}

function vocabularyCatalogIds(rank: KoiRank): string[] {
  if (rank === 'N5') return getN5VocabularyCandidatePack().map(entry => entry.id);
  if (rank === 'N4') return getN4VocabularyCandidatePack().map(entry => entry.id);
  // N3/N2/N1 intentionally have no local award path while their ranks are
  // gated/preview. Returning an empty catalog keeps direct calls fail-closed.
  return [];
}

function vocabularyReferenceMap(rank: KoiRank): Map<string, string> {
  const result = new Map<string, string>();
  for (const id of vocabularyCatalogIds(rank)) {
    const canonical = `cand-${id}`;
    result.set(id, canonical);
    result.set(canonical, canonical);
  }
  return result;
}

function allReviewedVocabularyIds(
  events: Partial<TodoEventCounts>,
  references: ReadonlyMap<string, string>,
): string[] {
  const reviewed: string[] = [];
  for (const ids of Object.values(events.flashcardReviews ?? {})) {
    if (!Array.isArray(ids)) continue;
    for (const id of ids) {
      const canonical = references.get(id);
      if (canonical) reviewed.push(canonical);
    }
  }
  return reviewed;
}

function validMasteryEvidence(value: unknown): MasteryEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is MasteryEvidence => (
    typeof entry === 'object'
    && entry !== null
    && typeof (entry as MasteryEvidence).id === 'string'
    && typeof (entry as MasteryEvidence).refId === 'string'
    && typeof (entry as MasteryEvidence).score === 'number'
    && Number.isFinite((entry as MasteryEvidence).score)
  ));
}

function vocabularyEvidence(
  rank: KoiRank,
  extended: KoiLearningExtendedProgress,
): DomainEvidence {
  const catalogIds = vocabularyCatalogIds(rank);
  const references = vocabularyReferenceMap(rank);
  const events = extended.todoEventCounts ?? {};
  const evidenceByReference = new Map<string, MasteryEvidence[]>();
  for (const evidence of validMasteryEvidence(events.masteryEvidence)) {
    const canonical = references.get(evidence.refId);
    if (!canonical) continue;
    const current = evidenceByReference.get(canonical) ?? [];
    current.push(evidence);
    evidenceByReference.set(canonical, current);
  }

  const practiced = uniqueSorted([
    ...allReviewedVocabularyIds(events, references),
    ...evidenceByReference.keys(),
  ]);
  const mastered: string[] = [];
  for (const [referenceId, evidence] of evidenceByReference) {
    const successful = evidence.filter(item => (
      item.score >= KOI_LEARNING_MILESTONE_THRESHOLDS.vocabularyMasteryMinimumScore
    ));
    const modalities = new Set(successful.map(item => item.modality));
    if (successful.length >= KOI_LEARNING_MILESTONE_THRESHOLDS.vocabularyMasteryEvidencePerItem
      && modalities.size >= KOI_LEARNING_MILESTONE_THRESHOLDS.vocabularyMasteryModalitiesPerItem) {
      mastered.push(referenceId);
    }
  }
  return {
    practiceIds: practiced,
    masteryIds: uniqueSorted(mastered),
    catalogSize: catalogIds.length,
  };
}

function evidenceForDomain(
  rank: KoiRank,
  domain: KoiDomain,
  progress: LearnerProgress,
  extended: KoiLearningExtendedProgress,
): DomainEvidence {
  if (domain === 'vocabulary') return vocabularyEvidence(rank, extended);
  if (domain === 'grammar') return lessonEvidence(getGrammarLessons(), rank, progress);
  if (domain === 'phrases') return lessonEvidence(getPhraseLessons(), rank, progress);
  return quizEvidence(rank, progress);
}

function qualifies(domain: KoiDomain, kind: KoiMilestoneKind, evidence: DomainEvidence): boolean {
  if (domain === 'vocabulary') {
    const desired = kind === 'practice'
      ? KOI_LEARNING_MILESTONE_THRESHOLDS.practiceDistinctVocabularyItems
      : KOI_LEARNING_MILESTONE_THRESHOLDS.masteryDistinctVocabularyItems;
    const ids = kind === 'practice' ? evidence.practiceIds : evidence.masteryIds;
    return ids.length >= requiredDistinct(evidence.catalogSize, desired);
  }
  if (domain === 'quizzes') {
    const desired = kind === 'practice'
      ? KOI_LEARNING_MILESTONE_THRESHOLDS.practiceDistinctQuizzes
      : KOI_LEARNING_MILESTONE_THRESHOLDS.masteryDistinctQuizzes;
    const ids = kind === 'practice' ? evidence.practiceIds : evidence.masteryIds;
    return ids.length >= requiredDistinct(evidence.catalogSize, desired);
  }
  const desired = kind === 'practice'
    ? KOI_LEARNING_MILESTONE_THRESHOLDS.practiceDistinctLessons
    : KOI_LEARNING_MILESTONE_THRESHOLDS.masteryDistinctLessons;
  const ids = kind === 'practice' ? evidence.practiceIds : evidence.masteryIds;
  return ids.length >= requiredDistinct(evidence.catalogSize, desired);
}

function safeOccurredAt(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Turns the existing learning repository's content-free progress/evidence
 * shape into high-water Koi milestones. The audited manifest is the production
 * default; a domain that is ungoverned, gated, or preview-only is never even
 * considered for an award.
 */
export function planKoiLearningProgression(
  input: KoiLearningProgressionInput,
  availability: KoiContentAvailabilityManifestV1 = AUDITED_KOI_CONTENT_AVAILABILITY,
): KoiLearningProgressionPlan {
  let progression = input.progression;
  let changed = false;
  const claims: KoiQueuedMasteryClaimV1[] = [];
  const awardedMilestoneIds: string[] = [];
  const advancedRanks: KoiRank[] = [];

  for (let rankIteration = 0; rankIteration < KOI_RANKS.length; rankIteration += 1) {
    const rank = progression.currentRank;
    for (const domain of KOI_DOMAINS) {
      if (!getKoiDomainGate(availability, rank, domain).earnable) continue;
      const evidence = evidenceForDomain(rank, domain, input.progress, input.extended);
      for (const kind of ['practice', 'mastery'] as const) {
        if (claims.length >= KOI_MAX_LEARNING_CLAIMS_PER_SYNC) break;
        if (!qualifies(domain, kind, evidence)) continue;
        const milestoneId = kind === 'practice'
          ? availability.ranks[rank].domains[domain].practiceMilestoneId
          : availability.ranks[rank].domains[domain].masteryMilestoneId;
        const application = applyKoiMilestone(progression, {
          rank,
          domain,
          kind,
          milestoneId,
        }, availability);
        progression = application.state;
        if (!application.awarded) continue;
        changed = true;
        awardedMilestoneIds.push(milestoneId);
        const evidenceIds = (kind === 'practice' ? evidence.practiceIds : evidence.masteryIds)
          .slice(0, KOI_MAX_EVIDENCE_IDS_PER_CLAIM);
        claims.push({
          schemaVersion: 1,
          kind: 'mastery',
          claimId: `learning.${milestoneId}`,
          rank,
          domain,
          milestone: kind,
          milestoneId,
          evidenceIds,
          occurredAt: safeOccurredAt(input.occurredAt),
        });
      }
    }

    if (claims.length >= KOI_MAX_LEARNING_CLAIMS_PER_SYNC) break;
    const advance = advanceKoiRank(progression, availability);
    if (!advance.advanced) break;
    progression = advance.state;
    changed = true;
    advancedRanks.push(progression.currentRank);
  }

  return { progression, claims, awardedMilestoneIds, advancedRanks, changed };
}

/**
 * Runs one initial sync and then serializes every live learning revision. This
 * adapter is React-independent so provider wiring and real store shapes can be
 * integration-tested without a native renderer.
 */
export function subscribeKoiLearningProgression(
  options: KoiLearningProgressionSubscriptionOptions,
): KoiLearningProgressionSubscription {
  const now = options.now ?? Date.now;
  const shouldContinue = options.shouldContinue ?? (() => true);
  let active = true;
  let queue: Promise<void> = Promise.resolve();

  const runOnce = async () => {
    if (!active || !shouldContinue()) return;
    await options.learningStore.ready();
    if (!active || !shouldContinue()) return;
    const progress = await options.learningRepository.getProgress();
    const localState = await options.koiRepository.load();
    if (!active || !shouldContinue()) return;
    const timestamp = now();
    const plan = planKoiLearningProgression({
      progression: localState.petSnapshot?.progression ?? createDefaultKoiProgression(),
      progress,
      extended: options.learningStore.getExtendedProgress(),
      occurredAt: timestamp,
    }, options.availability);
    if (!plan.changed || !active || !shouldContinue()) return;
    await options.koiRepository.saveLearningProgression(plan.progression, plan.claims, timestamp);
    if (active && shouldContinue()) await options.onPersisted?.(plan);
  };

  const schedule = () => {
    const task = queue.then(runOnce, runOnce);
    queue = task.catch(cause => {
      try {
        options.onError?.(cause);
      } catch {
        // An observer must never break the serialization queue.
      }
    });
  };

  const unsubscribeFromLearning = options.learningStore.subscribeExtendedProgress(schedule);
  schedule();
  return {
    drain: () => queue,
    async syncNow() {
      schedule();
      await queue;
    },
    unsubscribe() {
      active = false;
      unsubscribeFromLearning();
    },
  };
}
