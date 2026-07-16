import type { ReviewCard } from '../../../services/spacedRepetitionService';
import type { PersistentSpacedRepetitionScheduler } from '../../../services/persistentSrsStore';
import { localDateKey } from '../../../utils/localDate';
import type { KoiRank } from '../domain/types';
import type { KoiActiveDojoSessionV1 } from './koiSenseiRepository';

export const KOI_DOJO_ROUND_COUNT = 5;

type KoiDojoContentRank = 'N5' | 'N4' | 'N3';

export interface KoiDojoCatalogCard {
  contentId: string;
  contentRank: KoiDojoContentRank;
  prompt: string;
  reading: string;
  answer: string;
}

export interface KoiDojoChoice {
  /** A vocabulary content ID. Answer text is never used as an identifier. */
  id: string;
  label: string;
}

export interface KoiDojoQuestion {
  contentId: string;
  prompt: string;
  reading: string;
  choices: readonly KoiDojoChoice[];
  correctChoiceId: string;
}

export interface KoiDojoAnswerResult {
  correct: boolean;
  correctLabel: string;
  session: KoiActiveDojoSessionV1;
}

export type KoiDojoSrsEvidence = Pick<
  ReviewCard,
  'refId' | 'stage' | 'dueOn' | 'repetitions' | 'easeFactor' | 'lastReviewedOn'
>;

export interface KoiDojoVocabularySourceEntry {
  id: string;
  japanese: string;
  kana: string;
  english: string;
  level: KoiDojoContentRank;
  reviewStatus: string;
  source: { id: string; license: string; sourceId?: string };
}

export interface PrepareKoiDojoSessionOptions {
  srs?: Pick<PersistentSpacedRepetitionScheduler, 'listCards'> | null;
  now?: number;
  sessionId?: string;
  loadCatalog?: (rank: KoiRank) => Promise<KoiDojoCatalogCard[]>;
}

export interface PreparedKoiDojoSession {
  session: KoiActiveDojoSessionV1;
  catalog: KoiDojoCatalogCard[];
  selectionSource: 'persisted-srs' | 'catalog-fallback';
}

/**
 * Koi can only draw from vocabulary ranks that have a source-backed app
 * catalog today. Higher pet ranks keep practising the highest available
 * governed vocabulary instead of inventing N2/N1 material.
 */
export function getKoiDojoContentRank(rank: KoiRank): KoiDojoContentRank {
  if (rank === 'N5' || rank === 'N4' || rank === 'N3') return rank;
  return 'N3';
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * This is the dojo's governance boundary. It accepts the same candidate rows
 * used by the app flashcard adapter, then keeps only exact-rank,
 * approved-for-beta, source-and-license-backed vocabulary.
 */
export function buildGovernedKoiDojoCatalog(
  rank: KoiRank,
  entries: readonly KoiDojoVocabularySourceEntry[],
): KoiDojoCatalogCard[] {
  const contentRank = getKoiDojoContentRank(rank);
  const byContentId = new Map<string, KoiDojoCatalogCard>();
  for (const entry of entries) {
    if (entry.level !== contentRank
      || entry.reviewStatus !== 'approved-for-beta'
      || !nonEmpty(entry.id)
      || !nonEmpty(entry.japanese)
      || !nonEmpty(entry.kana)
      || !nonEmpty(entry.english)
      || !nonEmpty(entry.source?.id)
      || !nonEmpty(entry.source?.license)) continue;
    const contentId = `cand-${entry.id}`;
    if (!byContentId.has(contentId)) {
      byContentId.set(contentId, {
        contentId,
        contentRank,
        prompt: entry.japanese,
        reading: entry.kana,
        answer: entry.english,
      });
    }
  }
  return Array.from(byContentId.values()).sort((left, right) => (
    left.contentId.localeCompare(right.contentId)
  ));
}

/** Loads the real dynamically-split vocabulary catalog used by flashcards. */
export async function loadKoiDojoCatalog(rank: KoiRank): Promise<KoiDojoCatalogCard[]> {
  const contentRank = getKoiDojoContentRank(rank);
  let entries: readonly KoiDojoVocabularySourceEntry[];
  if (contentRank === 'N5') {
    const module = await import('../../../data/candidates/n5VocabularyCandidatePack');
    entries = module.getN5VocabularyCandidatePack();
  } else if (contentRank === 'N4') {
    const module = await import('../../../data/candidates/n4CandidatePack');
    entries = module.getN4VocabularyCandidatePack();
  } else {
    const module = await import('../../../data/candidates/n3VocabularyCandidatePack');
    entries = module.getN3VocabularyCandidatePack();
  }
  return buildGovernedKoiDojoCatalog(rank, entries);
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function isDue(evidence: KoiDojoSrsEvidence | undefined, today: string): boolean {
  return Boolean(evidence && evidence.stage === 'memorized' && evidence.dueOn <= today);
}

function isWeak(evidence: KoiDojoSrsEvidence | undefined): boolean {
  return Boolean(evidence && (
    evidence.stage !== 'memorized'
    || evidence.repetitions <= 1
    || evidence.easeFactor < 2.3
  ));
}

function selectionBucket(evidence: KoiDojoSrsEvidence | undefined, today: string): number {
  if (isDue(evidence, today)) return 0;
  if (isWeak(evidence)) return 1;
  if (!evidence) return 2;
  return 3;
}

const STAGE_ORDER: Record<ReviewCard['stage'], number> = {
  seen: 0,
  recognized: 1,
  memorized: 2,
};

/**
 * Prioritises persisted due work, then weak work, then unseen catalog items.
 * Every tie is seeded and stable, so identical inputs produce identical five
 * IDs while a new session can rotate equally-ranked vocabulary.
 */
export function selectKoiDojoContentIds(
  catalog: readonly KoiDojoCatalogCard[],
  evidenceRows: readonly KoiDojoSrsEvidence[],
  sessionId: string,
  today: string = localDateKey(),
): string[] {
  const evidenceByRefId = new Map(evidenceRows.map(row => [row.refId, row]));
  return [...catalog]
    .sort((left, right) => {
      const leftEvidence = evidenceByRefId.get(left.contentId);
      const rightEvidence = evidenceByRefId.get(right.contentId);
      const bucketDifference = selectionBucket(leftEvidence, today) - selectionBucket(rightEvidence, today);
      if (bucketDifference !== 0) return bucketDifference;
      const dueDifference = (leftEvidence?.dueOn ?? '').localeCompare(rightEvidence?.dueOn ?? '');
      if (dueDifference !== 0) return dueDifference;
      const stageDifference = (leftEvidence ? STAGE_ORDER[leftEvidence.stage] : 3)
        - (rightEvidence ? STAGE_ORDER[rightEvidence.stage] : 3);
      if (stageDifference !== 0) return stageDifference;
      const repetitionDifference = (leftEvidence?.repetitions ?? Number.MAX_SAFE_INTEGER)
        - (rightEvidence?.repetitions ?? Number.MAX_SAFE_INTEGER);
      if (repetitionDifference !== 0) return repetitionDifference;
      const easeDifference = (leftEvidence?.easeFactor ?? Number.MAX_SAFE_INTEGER)
        - (rightEvidence?.easeFactor ?? Number.MAX_SAFE_INTEGER);
      if (easeDifference !== 0) return easeDifference;
      const hashDifference = stableHash(`${sessionId}:${left.contentId}`)
        - stableHash(`${sessionId}:${right.contentId}`);
      return hashDifference || left.contentId.localeCompare(right.contentId);
    })
    .slice(0, KOI_DOJO_ROUND_COUNT)
    .map(card => card.contentId);
}

export function createKoiDojoSession(
  rank: KoiRank,
  catalog: readonly KoiDojoCatalogCard[],
  evidenceRows: readonly KoiDojoSrsEvidence[] = [],
  now: number = Date.now(),
  sessionId: string = `dojo-${now}`,
): KoiActiveDojoSessionV1 {
  const questionContentIds = selectKoiDojoContentIds(catalog, evidenceRows, sessionId, localDateKey(new Date(now)));
  if (questionContentIds.length !== KOI_DOJO_ROUND_COUNT) {
    throw new Error('Koi needs five governed vocabulary cards before this dojo can begin.');
  }
  return {
    schemaVersion: 1,
    sessionId,
    rank,
    questionContentIds,
    completedContentIds: [],
    correctContentIds: [],
    currentRound: 0,
    startedAt: now,
    updatedAt: now,
  };
}

export async function prepareKoiDojoSession(
  rank: KoiRank,
  options: PrepareKoiDojoSessionOptions = {},
): Promise<PreparedKoiDojoSession> {
  const now = options.now ?? Date.now();
  const sessionId = options.sessionId ?? `dojo-${now}`;
  const catalog = await (options.loadCatalog ?? loadKoiDojoCatalog)(rank);
  let evidenceRows: KoiDojoSrsEvidence[] = [];
  let selectionSource: PreparedKoiDojoSession['selectionSource'] = 'catalog-fallback';
  if (options.srs) {
    try {
      evidenceRows = await options.srs.listCards();
      selectionSource = 'persisted-srs';
    } catch {
      // Learning persistence is independent of Koi's local checkpoint. The
      // source-backed catalog still yields a deterministic offline session.
    }
  }
  return {
    session: createKoiDojoSession(rank, catalog, evidenceRows, now, sessionId),
    catalog,
    selectionSource,
  };
}

function buildQuestionChoices(
  card: KoiDojoCatalogCard,
  catalog: readonly KoiDojoCatalogCard[],
  sessionId: string,
): KoiDojoChoice[] {
  const normalizedAnswer = card.answer.trim().toLocaleLowerCase('en');
  const seenAnswers = new Set([normalizedAnswer]);
  const distractors = [...catalog]
    .filter(candidate => candidate.contentId !== card.contentId)
    .sort((left, right) => (
      stableHash(`${sessionId}:${card.contentId}:distractor:${left.contentId}`)
      - stableHash(`${sessionId}:${card.contentId}:distractor:${right.contentId}`)
      || left.contentId.localeCompare(right.contentId)
    ))
    .filter(candidate => {
      const normalized = candidate.answer.trim().toLocaleLowerCase('en');
      if (seenAnswers.has(normalized)) return false;
      seenAnswers.add(normalized);
      return true;
    })
    .slice(0, 3);
  if (distractors.length !== 3) {
    throw new Error('Koi needs four distinct vocabulary meanings for this dojo round.');
  }
  return [card, ...distractors]
    .sort((left, right) => (
      stableHash(`${sessionId}:${card.contentId}:choice:${left.contentId}`)
      - stableHash(`${sessionId}:${card.contentId}:choice:${right.contentId}`)
      || left.contentId.localeCompare(right.contentId)
    ))
    .map(choice => ({ id: choice.contentId, label: choice.answer }));
}

export function getKoiDojoQuestion(
  session: KoiActiveDojoSessionV1,
  catalog: readonly KoiDojoCatalogCard[],
): KoiDojoQuestion | undefined {
  const contentId = session.questionContentIds[session.currentRound];
  if (!contentId) return undefined;
  const card = catalog.find(candidate => candidate.contentId === contentId);
  if (!card) return undefined;
  return {
    contentId,
    prompt: card.prompt,
    reading: card.reading,
    choices: buildQuestionChoices(card, catalog, session.sessionId),
    correctChoiceId: contentId,
  };
}

export function answerKoiDojoRound(
  session: KoiActiveDojoSessionV1,
  choiceId: string,
  catalog: readonly KoiDojoCatalogCard[],
  now: number = Date.now(),
): KoiDojoAnswerResult {
  const question = getKoiDojoQuestion(session, catalog);
  if (!question) throw new Error('This Koi dojo round is no longer available.');
  const selectedChoice = question.choices.find(choice => choice.id === choiceId);
  if (!selectedChoice) throw new Error('Choose one of the available dojo answers.');
  const correctChoice = question.choices.find(choice => choice.id === question.correctChoiceId);
  if (!correctChoice) throw new Error('Koi dojo content is missing its correct answer.');
  const correct = choiceId === question.correctChoiceId;
  return {
    correct,
    correctLabel: correctChoice.label,
    session: {
      ...session,
      completedContentIds: [...session.completedContentIds, question.contentId],
      correctContentIds: correct
        ? [...session.correctContentIds, question.contentId]
        : session.correctContentIds,
      currentRound: session.currentRound + 1,
      updatedAt: Math.max(now, session.updatedAt),
    },
  };
}
