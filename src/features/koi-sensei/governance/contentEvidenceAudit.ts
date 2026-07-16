import { getN4VocabularyCandidatePack } from '../../../data/candidates/n4CandidatePack';
import { getN5VocabularyCandidatePack } from '../../../data/candidates/n5VocabularyCandidatePack';
import { getQuizQuestionCandidatePack } from '../../../data/candidates/quizQuestionCandidatePack';
import { getGrammarLessons, getPhraseLessons } from '../../../services/lessonService';
import type { SenseiLesson } from '../../../types/lesson';
import {
  KOI_DOMAINS,
  createKoiContentAvailabilityManifest,
  type KoiContentAvailabilityManifestV1,
  type KoiDomain,
  type KoiRank,
} from '../domain';

export interface KoiContentDomainAudit {
  rank: 'N5' | 'N4';
  domain: KoiDomain;
  itemCount: number;
  governedItemCount: number;
  ready: boolean;
  blockers: string[];
}

export interface KoiContentEvidenceAuditV1 {
  schemaVersion: 1;
  audits: Record<'N5' | 'N4', Record<KoiDomain, KoiContentDomainAudit>>;
  availability: KoiContentAvailabilityManifestV1;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function lessonItemsForRank(lessons: readonly SenseiLesson[], rank: 'N5' | 'N4') {
  return lessons.filter(lesson => lesson.level === rank).flatMap(lesson => (
    lesson.items.map(item => ({ lesson, item }))
  ));
}

function auditLessonDomain(
  rank: 'N5' | 'N4',
  domain: 'grammar' | 'phrases',
  lessons: readonly SenseiLesson[],
): KoiContentDomainAudit {
  const entries = lessonItemsForRank(lessons, rank);
  const governed = entries.filter(({ item }) => (
    item.translationReviewStatus === 'approved'
    && item.contentReviewStatus === 'sensei-reviewed'
    && Boolean(item.sourceRefs?.length)
    && item.sourceRefs?.every(source => (
      nonEmpty(source.source) && nonEmpty(source.sourceId) && nonEmpty(source.license)
    ))
  ));
  const blockers: string[] = [];
  if (entries.length === 0) blockers.push('no-content');
  const missingSourceReview = entries.length - governed.length;
  if (missingSourceReview > 0) blockers.push(`${missingSourceReview}-items-missing-source-and-sensei-review`);
  return {
    rank,
    domain,
    itemCount: entries.length,
    governedItemCount: governed.length,
    ready: entries.length > 0 && governed.length === entries.length,
    blockers,
  };
}

function auditVocabulary(rank: 'N5' | 'N4'): KoiContentDomainAudit {
  const entries = rank === 'N5'
    ? getN5VocabularyCandidatePack()
    : getN4VocabularyCandidatePack();
  const governed = entries.filter(entry => (
    entry.reviewStatus === 'approved-for-beta'
    && nonEmpty(entry.source.id)
    && nonEmpty(entry.source.license)
    && (rank !== 'N5' || !('pendingTranslations' in entry) || entry.pendingTranslations.length === 0)
  ));
  const blockers: string[] = [];
  if (entries.length === 0) blockers.push('no-content');
  const pending = entries.length - governed.length;
  if (pending > 0) blockers.push(`${pending}-items-not-fully-governed`);
  return {
    rank,
    domain: 'vocabulary',
    itemCount: entries.length,
    governedItemCount: governed.length,
    ready: entries.length > 0 && governed.length === entries.length,
    blockers,
  };
}

function auditQuizzes(rank: 'N5' | 'N4'): KoiContentDomainAudit {
  const entries = getQuizQuestionCandidatePack().filter(entry => entry.jlptLevel === rank);
  const governed = entries.filter(entry => (
    entry.reviewStatus === 'approved-for-beta'
    && entry.connectedToApp
    && nonEmpty(entry.id)
    && nonEmpty(entry.explanation)
  ));
  const blockers: string[] = [];
  if (entries.length === 0) blockers.push('no-content');
  const pending = entries.length - governed.length;
  if (pending > 0) blockers.push(`${pending}-questions-not-approved-and-connected`);
  return {
    rank,
    domain: 'quizzes',
    itemCount: entries.length,
    governedItemCount: governed.length,
    ready: entries.length > 0 && governed.length === entries.length,
    blockers,
  };
}

function auditRank(rank: 'N5' | 'N4'): Record<KoiDomain, KoiContentDomainAudit> {
  return {
    vocabulary: auditVocabulary(rank),
    grammar: auditLessonDomain(rank, 'grammar', getGrammarLessons()),
    phrases: auditLessonDomain(rank, 'phrases', getPhraseLessons()),
    quizzes: auditQuizzes(rank),
  };
}

/**
 * Converts existing review/source metadata into the only manifest allowed to
 * award local N5/N4 stars. A domain fails closed unless every learner-visible
 * item in that audit slice is approved, source-tagged, and connected.
 */
export function auditKoiContentEvidence(): KoiContentEvidenceAuditV1 {
  const audits = { N5: auditRank('N5'), N4: auditRank('N4') };
  const evidenceTagged = Object.fromEntries((['N5', 'N4'] as const).map(rank => [
    rank,
    KOI_DOMAINS.filter(domain => audits[rank][domain].ready),
  ])) as Partial<Record<KoiRank, readonly KoiDomain[]>>;
  return {
    schemaVersion: 1,
    audits,
    availability: createKoiContentAvailabilityManifest({ evidenceTagged }),
  };
}
