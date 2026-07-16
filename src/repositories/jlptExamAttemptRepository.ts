import type { AsyncKeyValueStorage } from '../services/keyValueStorage';
import type {
  JlptExamAttempt,
  JlptExamQuestion,
  JlptExamResult,
  JlptQuestionResult,
  JlptScoreBreakdown,
} from '../types/jlptExam';

const ACTIVE_KEY = 'japanese-tutor.jlpt-exam.active.v1';
const HISTORY_KEY = 'japanese-tutor.jlpt-exam.history.v1';
const STORAGE_SCHEMA_VERSION = 1;

type ExamStorage = Pick<AsyncKeyValueStorage, 'getItem' | 'setItem' | 'removeItem'>;

interface ActiveEnvelope {
  schemaVersion: 1;
  attempt: JlptExamAttempt;
}

interface HistoryEnvelope {
  schemaVersion: 1;
  results: JlptExamResult[];
}

export interface JlptExamAttemptRepository {
  loadActiveAttempt(): Promise<JlptExamAttempt | null>;
  saveActiveAttempt(attempt: JlptExamAttempt): Promise<void>;
  clearActiveAttempt(): Promise<void>;
  listResults(): Promise<JlptExamResult[]>;
  addResult(result: JlptExamResult): Promise<void>;
  clearAll(): Promise<void>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const LEVELS = ['N5', 'N4', 'N3'] as const;
const MODES = ['mini', 'full'] as const;
const TIMER_POLICIES = ['strict', 'practice'] as const;
const ATTEMPT_STATUSES = ['active', 'paused', 'section-break', 'completed', 'abandoned'] as const;
const SECTION_IDS = ['vocabulary', 'grammar-reading', 'listening'] as const;
const SCORING_GROUPS = ['language-knowledge', 'reading', 'language-knowledge-reading', 'listening'] as const;
const ITEM_TYPES = [
  'kanji-reading', 'orthography', 'contextual-expression', 'paraphrase', 'vocabulary-usage',
  'grammar-form', 'sentence-composition', 'text-grammar', 'reading-short', 'reading-medium',
  'reading-long', 'information-retrieval', 'listening-task', 'listening-key-point',
  'listening-outline', 'listening-expression', 'listening-quick-response',
] as const;
const CHOICE_IDS = ['A', 'B', 'C', 'D'] as const;
const SOURCE_KINDS = ['jmdict', 'kanjidic2', 'app-lesson', 'app-authored'] as const;

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function accuracyPercent(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function isOptionalFiniteNumber(value: unknown): value is number | undefined {
  return value === undefined || isFiniteNumber(value);
}

function hasUniqueStrings(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function isQuestion(value: unknown): value is JlptExamQuestion {
  if (!isObject(value)
    || !isNonEmptyString(value.id)
    || !isEnum(value.level, LEVELS)
    || !isEnum(value.section, SECTION_IDS)
    || !isEnum(value.scoringGroup, SCORING_GROUPS)
    || !isEnum(value.itemType, ITEM_TYPES)
    || !isNonEmptyString(value.prompt)
    || !isNonEmptyString(value.explanation)
    || value.reviewStatus !== 'approved-for-exam'
    || !isNonEmptyString(value.contentVersion)
    || !Array.isArray(value.choices)
    || value.choices.length < 3
    || value.choices.length > 4
    || !isEnum(value.correctChoice, CHOICE_IDS)
    || !Array.isArray(value.sourceRefs)
    || value.sourceRefs.length === 0
    || (value.audioPlayLimit !== undefined && (!isNonNegativeInteger(value.audioPlayLimit) || value.audioPlayLimit < 1))) {
    return false;
  }
  const choices = value.choices;
  if (!choices.every(choice => isObject(choice) && isEnum(choice.id, CHOICE_IDS) && isNonEmptyString(choice.text))) return false;
  const choiceIds = choices.map(choice => String(choice.id));
  if (!hasUniqueStrings(choiceIds) || !choiceIds.includes(value.correctChoice)) return false;
  if (!value.sourceRefs.every(source => isObject(source)
    && isNonEmptyString(source.sourceId)
    && isNonEmptyString(source.license)
    && isEnum(source.kind, SOURCE_KINDS)
    && (source.attribution === undefined || isNonEmptyString(source.attribution)))) return false;
  if (value.stimulus !== undefined) {
    if (!isObject(value.stimulus)
      || !isEnum(value.stimulus.kind, ['passage', 'notice', 'audio'] as const)
      || (value.stimulus.text !== undefined && !isNonEmptyString(value.stimulus.text))
      || (value.stimulus.audioText !== undefined && !isNonEmptyString(value.stimulus.audioText))
      || (value.stimulus.transcript !== undefined && !isNonEmptyString(value.stimulus.transcript))
      || (value.stimulus.title !== undefined && !isNonEmptyString(value.stimulus.title))) return false;
    if (value.stimulus.kind === 'audio' && !isNonEmptyString(value.stimulus.audioText)) return false;
    if (value.stimulus.kind !== 'audio' && !isNonEmptyString(value.stimulus.text)) return false;
  }
  if (value.itemType.startsWith('listening-')
    && (value.section !== 'listening' || value.stimulus?.kind !== 'audio')) return false;
  return true;
}

function isAttempt(value: unknown): value is JlptExamAttempt {
  if (!isObject(value)) return false;
  if (value.schemaVersion !== 1
    || !isNonEmptyString(value.id)
    || !isEnum(value.level, LEVELS)
    || !isEnum(value.mode, MODES)
    || !isEnum(value.timerPolicy, TIMER_POLICIES)
    || !isEnum(value.status, ATTEMPT_STATUSES)
    || !isFiniteNumber(value.seed)
    || !Number.isInteger(value.seed)
    || !isNonEmptyString(value.blueprintVersion)
    || !isNonEmptyString(value.contentVersion)
    || !isNonNegativeInteger(value.currentSectionIndex)
    || !isNonNegativeInteger(value.currentQuestionIndex)
    || !Array.isArray(value.sections)
    || value.sections.length !== SECTION_IDS.length
    || !isObject(value.answers)
    || !Array.isArray(value.flaggedQuestionIds)
    || !Array.isArray(value.sectionSubmissions)
    || !isObject(value.audioPlayback)
    || !isFiniteNumber(value.sectionStartedAt)
    || !isOptionalFiniteNumber(value.sectionDeadlineAt)
    || !isOptionalFiniteNumber(value.pausedAt)
    || !isFiniteNumber(value.startedAt)
    || !isFiniteNumber(value.updatedAt)
    || !isOptionalFiniteNumber(value.completedAt)) return false;

  const allQuestionIds: string[] = [];
  const questionById = new Map<string, JlptExamQuestion>();
  for (let index = 0; index < value.sections.length; index += 1) {
    const section = value.sections[index];
    if (!isObject(section)
      || section.id !== SECTION_IDS[index]
      || !isNonEmptyString(section.label)
      || !isNonNegativeInteger(section.durationSeconds)
      || section.durationSeconds < 1
      || !Array.isArray(section.questions)
      || section.questions.length === 0
      || !section.questions.every(isQuestion)) return false;
    for (const question of section.questions) {
      if (question.level !== value.level || question.section !== section.id || question.contentVersion !== value.contentVersion) return false;
      allQuestionIds.push(question.id);
      questionById.set(question.id, question);
    }
  }
  if (!hasUniqueStrings(allQuestionIds)
    || value.currentSectionIndex >= value.sections.length
    || value.currentQuestionIndex >= value.sections[value.currentSectionIndex].questions.length) return false;

  for (const [questionId, answer] of Object.entries(value.answers)) {
    const question = questionById.get(questionId);
    if (!question || !isEnum(answer, CHOICE_IDS) || !question.choices.some(choice => choice.id === answer)) return false;
  }
  if (!value.flaggedQuestionIds.every(isNonEmptyString)
    || !hasUniqueStrings(value.flaggedQuestionIds)
    || !value.flaggedQuestionIds.every(id => questionById.has(id))) return false;
  if (!value.sectionSubmissions.every(submission => isObject(submission)
    && isEnum(submission.sectionId, SECTION_IDS)
    && isFiniteNumber(submission.submittedAt)
    && isEnum(submission.reason, ['submitted', 'timeout'] as const)
    && isFiniteNumber(submission.elapsedSeconds)
    && submission.elapsedSeconds >= 0)) return false;
  if (!hasUniqueStrings(value.sectionSubmissions.map(submission => String(submission.sectionId)))) return false;
  const validatedSections = value.sections as JlptExamAttempt['sections'];
  if (!value.sectionSubmissions.every((submission, index) => (
    submission.sectionId === validatedSections[index]?.id
    && submission.elapsedSeconds <= validatedSections[index].durationSeconds
  ))) return false;

  const submittedCount = value.sectionSubmissions.length;
  const isBetweenSections = submittedCount === value.currentSectionIndex + 1;
  const isWithinSection = submittedCount === value.currentSectionIndex;
  if (value.status === 'active') {
    if (value.sectionDeadlineAt === undefined
      || value.pausedAt !== undefined
      || value.completedAt !== undefined
      || !isWithinSection) return false;
  } else if (value.status === 'paused') {
    if (value.timerPolicy !== 'practice'
      || value.sectionDeadlineAt === undefined
      || value.pausedAt === undefined
      || value.completedAt !== undefined
      || !isWithinSection) return false;
  } else if (value.status === 'section-break') {
    if (value.sectionDeadlineAt !== undefined
      || value.pausedAt !== undefined
      || value.completedAt !== undefined
      || !isBetweenSections) return false;
  } else if (value.status === 'completed') {
    if (value.sectionDeadlineAt !== undefined
      || value.pausedAt !== undefined
      || value.completedAt === undefined
      || value.currentSectionIndex !== value.sections.length - 1
      || submittedCount !== value.sections.length) return false;
  } else if (value.sectionDeadlineAt !== undefined
    || value.pausedAt !== undefined
    || value.completedAt !== undefined
    || (!isWithinSection && !isBetweenSections)) return false;

  for (const [questionId, playback] of Object.entries(value.audioPlayback)) {
    const question = questionById.get(questionId);
    if (!question || question.stimulus?.kind !== 'audio' || !isObject(playback)
      || !isNonNegativeInteger(playback.plays)
      || (question.audioPlayLimit !== undefined && playback.plays > question.audioPlayLimit)
      || !isOptionalFiniteNumber(playback.startedAt)
      || !isOptionalFiniteNumber(playback.completedAt)
      || (playback.failed !== undefined && typeof playback.failed !== 'boolean')) return false;
  }
  return true;
}

function isBreakdown(value: unknown): value is JlptScoreBreakdown {
  if (!isObject(value)
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.label)
    || !isNonNegativeInteger(value.correct)
    || !isNonNegativeInteger(value.total)
    || !isNonNegativeInteger(value.unanswered)
    || !isFiniteNumber(value.accuracyPercent)) return false;
  return value.correct <= value.total
    && value.unanswered <= value.total
    && value.correct + value.unanswered <= value.total
    && value.accuracyPercent >= 0
    && value.accuracyPercent <= 100
    && value.accuracyPercent === accuracyPercent(value.correct, value.total);
}

function isQuestionResult(value: unknown): value is JlptQuestionResult {
  if (!(isObject(value)
    && isNonEmptyString(value.questionId)
    && isEnum(value.section, SECTION_IDS)
    && isEnum(value.scoringGroup, SCORING_GROUPS)
    && isEnum(value.itemType, ITEM_TYPES)
    && (value.selectedChoice === undefined || isEnum(value.selectedChoice, CHOICE_IDS))
    && isEnum(value.correctChoice, CHOICE_IDS)
    && typeof value.correct === 'boolean'
    && isNonEmptyString(value.explanation))) return false;
  return value.correct === (value.selectedChoice !== undefined && value.selectedChoice === value.correctChoice);
}

function breakdownsMatchQuestionResults(
  breakdowns: JlptScoreBreakdown[],
  questionResults: JlptQuestionResult[],
  getGroupId: (result: JlptQuestionResult) => string,
): boolean {
  const expected = new Map<string, { correct: number; total: number; unanswered: number }>();
  for (const result of questionResults) {
    const groupId = getGroupId(result);
    const group = expected.get(groupId) ?? { correct: 0, total: 0, unanswered: 0 };
    group.total += 1;
    if (result.correct) group.correct += 1;
    if (result.selectedChoice === undefined) group.unanswered += 1;
    expected.set(groupId, group);
  }
  if (breakdowns.length !== expected.size || !hasUniqueStrings(breakdowns.map(item => item.id))) return false;
  return breakdowns.every(item => {
    const group = expected.get(item.id);
    return group !== undefined
      && item.correct === group.correct
      && item.total === group.total
      && item.unanswered === group.unanswered;
  });
}

function isResult(value: unknown): value is JlptExamResult {
  if (!isObject(value)) return false;
  if (value.schemaVersion !== 1
    || !isNonEmptyString(value.id)
    || !isNonEmptyString(value.attemptId)
    || !isEnum(value.level, LEVELS)
    || !isEnum(value.mode, MODES)
    || !isEnum(value.timerPolicy, TIMER_POLICIES)
    || !isNonEmptyString(value.blueprintVersion)
    || !isNonEmptyString(value.contentVersion)
    || !isFiniteNumber(value.completedAt)
    || !isNonNegativeInteger(value.correct)
    || !isNonNegativeInteger(value.total)
    || !isNonNegativeInteger(value.unanswered)
    || !isFiniteNumber(value.accuracyPercent)
    || value.accuracyPercent < 0
    || value.accuracyPercent > 100
    || value.accuracyPercent !== accuracyPercent(value.correct, value.total)
    || !Array.isArray(value.bySection)
    || !Array.isArray(value.byScoringGroup)
    || !Array.isArray(value.byItemType)
    || !Array.isArray(value.questionResults)
    || !isNonEmptyString(value.unofficialNotice)) return false;
  if (!value.bySection.every(isBreakdown)
    || !value.byScoringGroup.every(isBreakdown)
    || !value.byItemType.every(isBreakdown)
    || !value.questionResults.every(isQuestionResult)
    || value.total !== value.questionResults.length
    || value.correct !== value.questionResults.filter(result => result.correct).length
    || value.unanswered !== value.questionResults.filter(result => result.selectedChoice === undefined).length
    || value.correct + value.unanswered > value.total
    || !breakdownsMatchQuestionResults(value.bySection, value.questionResults, result => result.section)
    || !breakdownsMatchQuestionResults(value.byScoringGroup, value.questionResults, result => result.scoringGroup)
    || !breakdownsMatchQuestionResults(value.byItemType, value.questionResults, result => result.itemType)) return false;
  return hasUniqueStrings(value.questionResults.map(result => result.questionId));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parseActive(raw: string | null): JlptExamAttempt | null {
  if (!raw) return null;
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isObject(envelope) || envelope.schemaVersion !== STORAGE_SCHEMA_VERSION || !isAttempt(envelope.attempt)) return null;
    return clone(envelope.attempt);
  } catch {
    return null;
  }
}

function parseHistory(raw: string | null, maxHistory: number): JlptExamResult[] {
  if (!raw) return [];
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!isObject(envelope) || envelope.schemaVersion !== STORAGE_SCHEMA_VERSION || !Array.isArray(envelope.results)) return [];
    return envelope.results
      .filter(isResult)
      .map(clone)
      .sort((left, right) => right.completedAt - left.completedAt)
      .slice(0, maxHistory);
  } catch {
    return [];
  }
}

export function createJlptExamAttemptRepository(
  storage: ExamStorage,
  options: { maxHistory?: number } = {},
): JlptExamAttemptRepository {
  const requestedMaxHistory = options.maxHistory ?? 20;
  if (!Number.isFinite(requestedMaxHistory) || requestedMaxHistory < 1) {
    throw new Error('JLPT exam maxHistory must be a finite positive number.');
  }
  const maxHistory = Math.floor(requestedMaxHistory);
  let mutationQueue = Promise.resolve();
  const enqueueMutation = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.then(operation, operation);
    mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  };
  return {
    async loadActiveAttempt() {
      await mutationQueue;
      return parseActive(await storage.getItem(ACTIVE_KEY));
    },
    async saveActiveAttempt(attempt) {
      if (!isAttempt(attempt)) throw new Error('Cannot persist an invalid JLPT exam attempt.');
      const envelope: ActiveEnvelope = { schemaVersion: STORAGE_SCHEMA_VERSION, attempt: clone(attempt) };
      await enqueueMutation(() => storage.setItem(ACTIVE_KEY, JSON.stringify(envelope)));
    },
    async clearActiveAttempt() {
      await enqueueMutation(() => storage.removeItem(ACTIVE_KEY));
    },
    async listResults() {
      await mutationQueue;
      return parseHistory(await storage.getItem(HISTORY_KEY), maxHistory);
    },
    async addResult(result) {
      if (!isResult(result)) throw new Error('Cannot persist an invalid JLPT exam result.');
      const snapshot = clone(result);
      await enqueueMutation(async () => {
        const current = parseHistory(await storage.getItem(HISTORY_KEY), maxHistory);
        if (current.some(entry => entry.id === snapshot.id || entry.attemptId === snapshot.attemptId)) return;
        const envelope: HistoryEnvelope = {
          schemaVersion: STORAGE_SCHEMA_VERSION,
          results: [snapshot, ...current]
            .sort((left, right) => right.completedAt - left.completedAt)
            .slice(0, maxHistory),
        };
        await storage.setItem(HISTORY_KEY, JSON.stringify(envelope));
      });
    },
    async clearAll() {
      await enqueueMutation(() => Promise.all([
        storage.removeItem(ACTIVE_KEY),
        storage.removeItem(HISTORY_KEY),
      ]).then(() => undefined));
    },
  };
}

export const JLPT_EXAM_STORAGE_KEYS = { active: ACTIVE_KEY, history: HISTORY_KEY } as const;
