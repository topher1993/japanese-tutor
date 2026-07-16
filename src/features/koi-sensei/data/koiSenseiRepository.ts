import type { AsyncKeyValueStorage } from '../../../services/keyValueStorage';
import { applyKoiChatRetention } from '../media/retention';
import { getKoiUnlockedCosmetics } from '../domain/cosmetics';
import { mergeKoiProgressionHighWater } from '../domain/progression';
import {
  KOI_COSMETIC_SLOTS,
  KOI_DOMAINS,
  KOI_RANKS,
  type KoiAvatarMode,
  type KoiCosmeticSlot,
  type KoiDomain,
  type KoiEffectPreference,
  type KoiProgressionStateV1,
  type KoiRank,
} from '../domain/types';
import {
  KOI_CARE_ACTION_IDS,
  KOI_DEFAULT_LEAGUE_ALIAS,
  KOI_LEAGUE_POINT_CAP,
  createDefaultKoiExperienceState,
  createDefaultKoiPetSnapshot,
  type KoiExperienceStateV1,
} from './koiExperience';
import {
  KOI_AGE_BANDS,
  KOI_ELIGIBILITY_SCHEMA_VERSION,
  type KoiEligibilityRecordV1,
} from './eligibility';

const LOCAL_STATE_KEY = 'japanese-tutor.koi-sensei.local-state.v1';
const STORAGE_SCHEMA_VERSION = 1;
const DEFAULT_MAX_MESSAGES = 200;
const HARD_MAX_MESSAGES = 200;
const DEFAULT_MAX_QUEUED_CLAIMS = 500;
const MAX_DRAFT_LENGTH = 2_000;
const MAX_MESSAGE_LENGTH = 16_000;
const MAX_SPOKEN_TEXT_LENGTH = 240;
const MAX_IDENTIFIER_LENGTH = 160;
const MAX_LEARNING_CLAIMS_PER_WRITE = 8;

type KoiStorage = Pick<AsyncKeyValueStorage, 'getItem' | 'setItem' | 'removeItem'>;

export interface KoiLocalPreferencesV1 {
  avatarMode: KoiAvatarMode;
  effectPreference: KoiEffectPreference;
  voicePlaybackEnabled: boolean;
  voiceAutoplayEnabled: boolean;
  speechToTextEnabled: boolean;
  detailedProgressConsent: boolean;
  leagueParticipationEnabled: boolean;
}

export interface KoiCachedPetSnapshotV1 {
  schemaVersion: 1;
  revision: number;
  syncedAt: number;
  progression: KoiProgressionStateV1;
  bond: number;
  coins: number;
  equippedCosmeticIds: Partial<Record<KoiCosmeticSlot, string>>;
  ownedCareItemIds: string[];
  ownedDojoThemeIds: string[];
  selectedDojoThemeId: string;
}

export type KoiCachedMessageRole = 'user' | 'assistant';

export type KoiCachedExpression = 'base' | 'happy' | 'thinking' | 'celebrate' | 'encourage';

export interface KoiCachedChatMessageV1 {
  schemaVersion: 1;
  id: string;
  conversationId: string;
  role: KoiCachedMessageRole;
  text: string;
  spokenText?: string;
  expression?: KoiCachedExpression;
  sourceIds: string[];
  createdAt: number;
}

/**
 * The dojo checkpoint stores content identifiers and correctness only. It
 * deliberately excludes prompt text, selected answer text, audio, and render
 * state so a five-round session can resume without becoming a second data log.
 */
export interface KoiActiveDojoSessionV1 {
  schemaVersion: 1;
  sessionId: string;
  rank: KoiRank;
  questionContentIds: string[];
  completedContentIds: string[];
  correctContentIds: string[];
  currentRound: number;
  startedAt: number;
  updatedAt: number;
}

export type KoiStudyRewardEventType =
  | 'lesson_completion'
  | 'flashcard_review'
  | 'quiz_attempt'
  | 'daily_rush'
  | 'kanji_session'
  | 'sentence_session'
  | 'dojo_completion';

export type KoiScoreBand = 'under_50' | '50_69' | '70_79' | '80_plus';

export interface KoiQueuedStudyRewardClaimV1 {
  schemaVersion: 1;
  kind: 'study_reward';
  claimId: string;
  eventType: KoiStudyRewardEventType;
  sourceId: string;
  occurredAt: number;
  count: number;
  scoreBand?: KoiScoreBand;
}

export interface KoiQueuedMasteryClaimV1 {
  schemaVersion: 1;
  kind: 'mastery';
  claimId: string;
  rank: KoiRank;
  domain: KoiDomain;
  milestone: 'practice' | 'mastery';
  milestoneId: string;
  evidenceIds: string[];
  occurredAt: number;
}

export type KoiQueuedClaimV1 = KoiQueuedStudyRewardClaimV1 | KoiQueuedMasteryClaimV1;

/** A content-free retry marker. Firebase identity credentials never live here. */
export interface KoiCloudDeletionTombstoneV1 {
  schemaVersion: 1;
  requestId: string;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt?: number;
}

export interface KoiSenseiLocalStateV1 {
  schemaVersion: 1;
  eligibility: KoiEligibilityRecordV1 | null;
  draft: string;
  preferences: KoiLocalPreferencesV1;
  petSnapshot: KoiCachedPetSnapshotV1 | null;
  experience: KoiExperienceStateV1;
  messages: KoiCachedChatMessageV1[];
  activeDojoSession: KoiActiveDojoSessionV1 | null;
  queuedClaims: KoiQueuedClaimV1[];
  cloudDeletionTombstone: KoiCloudDeletionTombstoneV1 | null;
}

export interface KoiSenseiRepository {
  load(): Promise<KoiSenseiLocalStateV1>;
  saveEligibility(record: KoiEligibilityRecordV1): Promise<void>;
  revokeEligibility(): Promise<void>;
  saveDraft(draft: string): Promise<void>;
  savePreferences(patch: Partial<KoiLocalPreferencesV1>): Promise<void>;
  savePetSnapshot(snapshot: KoiCachedPetSnapshotV1 | null): Promise<void>;
  /**
   * Atomically merges learning-derived high-water progression and its compact
   * retry claims. Every non-progression pet field and the separate experience
   * slice are preserved from the latest repository value.
   */
  saveLearningProgression(
    progression: KoiProgressionStateV1,
    claims: readonly KoiQueuedMasteryClaimV1[],
    syncedAt: number,
  ): Promise<void>;
  saveExperience(experience: KoiExperienceStateV1): Promise<void>;
  saveActivityState(
    snapshot: KoiCachedPetSnapshotV1,
    experience: KoiExperienceStateV1,
    activeDojoSession: KoiActiveDojoSessionV1 | null,
  ): Promise<void>;
  appendMessage(message: KoiCachedChatMessageV1): Promise<void>;
  appendMessages(messages: readonly KoiCachedChatMessageV1[]): Promise<void>;
  replaceMessages(messages: readonly KoiCachedChatMessageV1[]): Promise<void>;
  clearMessages(): Promise<void>;
  clearChat(): Promise<void>;
  saveActiveDojoSession(session: KoiActiveDojoSessionV1 | null): Promise<void>;
  enqueueClaim(claim: KoiQueuedClaimV1): Promise<void>;
  acknowledgeClaims(claimIds: readonly string[]): Promise<void>;
  clearQueuedClaims(): Promise<void>;
  setCloudDeletionTombstone(tombstone: KoiCloudDeletionTombstoneV1): Promise<void>;
  clearCloudDeletionTombstone(): Promise<void>;
  reset(): Promise<void>;
}

export interface KoiSenseiRepositoryOptions {
  /** Tests may lower the cap, but production callers cannot exceed 200. */
  maxMessages?: number;
  maxQueuedClaims?: number;
  /** Injectable clock keeps the rolling 30-day chat window deterministic in tests. */
  now?: () => number;
}

export const DEFAULT_KOI_LOCAL_PREFERENCES: Readonly<KoiLocalPreferencesV1> = Object.freeze({
  avatarMode: '3d',
  effectPreference: 'full',
  voicePlaybackEnabled: true,
  voiceAutoplayEnabled: false,
  speechToTextEnabled: true,
  detailedProgressConsent: false,
  leagueParticipationEnabled: false,
});

function createDefaultState(): KoiSenseiLocalStateV1 {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    eligibility: null,
    draft: '',
    preferences: { ...DEFAULT_KOI_LOCAL_PREFERENCES },
    petSnapshot: null,
    experience: createDefaultKoiExperienceState(),
    messages: [],
    activeDojoSession: null,
    queuedClaims: [],
    cloudDeletionTombstone: null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= maximum;
}

function isTimestamp(value: unknown): value is number {
  return isIntegerInRange(value, 0, Number.MAX_SAFE_INTEGER);
}

function normalizeIdentifier(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= MAX_IDENTIFIER_LENGTH ? normalized : null;
}

function normalizeIdentifierList(value: unknown, maximum: number): string[] | null {
  if (!Array.isArray(value) || value.length > maximum) return null;
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const normalized = normalizeIdentifier(entry);
    if (!normalized) return null;
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function normalizePreferences(value: unknown): KoiLocalPreferencesV1 {
  const source = isObject(value) ? value : {};
  return {
    avatarMode: isEnum(source.avatarMode, ['3d', '2d'] as const)
      ? source.avatarMode
      : DEFAULT_KOI_LOCAL_PREFERENCES.avatarMode,
    effectPreference: isEnum(source.effectPreference, ['full', 'reduced', 'off'] as const)
      ? source.effectPreference
      : DEFAULT_KOI_LOCAL_PREFERENCES.effectPreference,
    voicePlaybackEnabled: typeof source.voicePlaybackEnabled === 'boolean'
      ? source.voicePlaybackEnabled
      : DEFAULT_KOI_LOCAL_PREFERENCES.voicePlaybackEnabled,
    voiceAutoplayEnabled: typeof source.voiceAutoplayEnabled === 'boolean'
      ? source.voiceAutoplayEnabled
      : DEFAULT_KOI_LOCAL_PREFERENCES.voiceAutoplayEnabled,
    speechToTextEnabled: typeof source.speechToTextEnabled === 'boolean'
      ? source.speechToTextEnabled
      : DEFAULT_KOI_LOCAL_PREFERENCES.speechToTextEnabled,
    detailedProgressConsent: typeof source.detailedProgressConsent === 'boolean'
      ? source.detailedProgressConsent
      : DEFAULT_KOI_LOCAL_PREFERENCES.detailedProgressConsent,
    leagueParticipationEnabled: typeof source.leagueParticipationEnabled === 'boolean'
      ? source.leagueParticipationEnabled
      : DEFAULT_KOI_LOCAL_PREFERENCES.leagueParticipationEnabled,
  };
}

function normalizeEligibility(value: unknown): KoiEligibilityRecordV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== KOI_ELIGIBILITY_SCHEMA_VERSION
    || !isEnum(value.ageBand, KOI_AGE_BANDS)
    || typeof value.aiDataConsent !== 'boolean'
    || typeof value.usProcessingAcknowledged !== 'boolean'
    || (value.consentedAt !== null && !isTimestamp(value.consentedAt))) return null;
  const aiPolicyVersion = normalizeIdentifier(value.aiPolicyVersion);
  const privacyPolicyVersion = normalizeIdentifier(value.privacyPolicyVersion);
  if (!aiPolicyVersion || !privacyPolicyVersion) return null;
  if (value.ageBand === 'under16') {
    return {
      schemaVersion: KOI_ELIGIBILITY_SCHEMA_VERSION,
      ageBand: 'under16',
      aiPolicyVersion,
      privacyPolicyVersion,
      aiDataConsent: false,
      usProcessingAcknowledged: false,
      consentedAt: null,
    };
  }
  return {
    schemaVersion: KOI_ELIGIBILITY_SCHEMA_VERSION,
    ageBand: value.ageBand,
    aiPolicyVersion,
    privacyPolicyVersion,
    aiDataConsent: value.aiDataConsent,
    usProcessingAcknowledged: value.usProcessingAcknowledged,
    consentedAt: value.consentedAt,
  };
}

function isLocalDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isWeekKey(value: unknown): value is string {
  return typeof value === 'string' && (value === '' || /^\d{4}-W\d{2}$/.test(value));
}

function normalizeExperience(value: unknown): KoiExperienceStateV1 {
  const defaults = createDefaultKoiExperienceState();
  if (!isObject(value) || value.schemaVersion !== 1) return defaults;
  const care = isObject(value.care) ? value.care : {};
  const dojo = isObject(value.dojo) ? value.dojo : {};
  const league = isObject(value.league) ? value.league : {};
  const lastInteractionDateByAction: KoiExperienceStateV1['care']['lastInteractionDateByAction'] = {};
  if (isObject(care.lastInteractionDateByAction)) {
    for (const actionId of KOI_CARE_ACTION_IDS) {
      const dateKey = care.lastInteractionDateByAction[actionId];
      if (isLocalDateKey(dateKey)) lastInteractionDateByAction[actionId] = dateKey;
    }
  }
  const alias = normalizeIdentifier(league.alias) ?? KOI_DEFAULT_LEAGUE_ALIAS;
  return {
    schemaVersion: 1,
    care: {
      totalInteractions: isIntegerInRange(care.totalInteractions, 0, 1_000_000)
        ? care.totalInteractions
        : 0,
      lastInteractionDateByAction,
    },
    dojo: {
      completedSessions: isIntegerInRange(dojo.completedSessions, 0, 1_000_000)
        ? dojo.completedSessions
        : 0,
      bestScore: isIntegerInRange(dojo.bestScore, 0, 5) ? dojo.bestScore : 0,
      ...(normalizeIdentifier(dojo.lastRewardedSessionId)
        ? { lastRewardedSessionId: normalizeIdentifier(dojo.lastRewardedSessionId)! }
        : {}),
    },
    league: {
      alias,
      weekKey: isWeekKey(league.weekKey) ? league.weekKey : '',
      weeklyPoints: isIntegerInRange(league.weeklyPoints, 0, KOI_LEAGUE_POINT_CAP)
        ? league.weeklyPoints
        : 0,
    },
  };
}

function normalizeProgression(value: unknown): KoiProgressionStateV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !isEnum(value.currentRank, KOI_RANKS)
    || !isObject(value.rankProgress)) return null;

  const rankProgress = {} as KoiProgressionStateV1['rankProgress'];
  for (const rank of KOI_RANKS) {
    const storedRank = value.rankProgress[rank];
    if (!isObject(storedRank) || !isObject(storedRank.domainStars)) return null;
    const domainStars = {} as KoiProgressionStateV1['rankProgress'][KoiRank]['domainStars'];
    for (const domain of KOI_DOMAINS) {
      const stars = storedRank.domainStars[domain];
      if (!isIntegerInRange(stars, 0, 2)) return null;
      domainStars[domain] = stars as 0 | 1 | 2;
    }
    const earnedMilestoneIds = normalizeIdentifierList(storedRank.earnedMilestoneIds, 16);
    if (!earnedMilestoneIds) return null;
    rankProgress[rank] = { domainStars, earnedMilestoneIds };
  }
  return { schemaVersion: 1, currentRank: value.currentRank, rankProgress };
}

function normalizeEquippedCosmetics(value: unknown): Partial<Record<KoiCosmeticSlot, string>> | null {
  if (!isObject(value)) return null;
  const result: Partial<Record<KoiCosmeticSlot, string>> = {};
  for (const slot of KOI_COSMETIC_SLOTS) {
    if (value[slot] === undefined) continue;
    const cosmeticId = normalizeIdentifier(value[slot]);
    if (!cosmeticId) return null;
    result[slot] = cosmeticId;
  }
  return result;
}

function normalizePetSnapshot(value: unknown): KoiCachedPetSnapshotV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !isIntegerInRange(value.revision, 0, Number.MAX_SAFE_INTEGER)
    || !isTimestamp(value.syncedAt)
    || !isIntegerInRange(value.bond, 0, 1_000)
    || !isIntegerInRange(value.coins, 0, Number.MAX_SAFE_INTEGER)) return null;
  const progression = normalizeProgression(value.progression);
  const equippedCosmeticIds = normalizeEquippedCosmetics(value.equippedCosmeticIds);
  const ownedCareItemIds = normalizeIdentifierList(value.ownedCareItemIds, 100);
  const ownedDojoThemeIds = normalizeIdentifierList(value.ownedDojoThemeIds, 20);
  const selectedDojoThemeId = normalizeIdentifier(value.selectedDojoThemeId);
  if (!progression
    || !equippedCosmeticIds
    || !ownedCareItemIds
    || !ownedDojoThemeIds
    || !selectedDojoThemeId
    || !ownedDojoThemeIds.includes(selectedDojoThemeId)) return null;
  const unlockedCosmeticIds = new Set(getKoiUnlockedCosmetics(progression).map(item => item.id));
  if (Object.values(equippedCosmeticIds).some(id => id && !unlockedCosmeticIds.has(id))) return null;
  return {
    schemaVersion: 1,
    revision: value.revision,
    syncedAt: value.syncedAt,
    progression,
    bond: value.bond,
    coins: value.coins,
    equippedCosmeticIds,
    ownedCareItemIds,
    ownedDojoThemeIds,
    selectedDojoThemeId,
  };
}

function normalizeMessage(value: unknown): KoiCachedChatMessageV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !isEnum(value.role, ['user', 'assistant'] as const)
    || typeof value.text !== 'string'
    || value.text.length === 0
    || value.text.length > MAX_MESSAGE_LENGTH
    || !isTimestamp(value.createdAt)) return null;
  const id = normalizeIdentifier(value.id);
  const conversationId = normalizeIdentifier(value.conversationId);
  const sourceIds = normalizeIdentifierList(value.sourceIds, 8);
  if (!id || !conversationId || !sourceIds) return null;
  const spokenText = value.spokenText === undefined
    ? undefined
    : typeof value.spokenText === 'string' && value.spokenText.length <= MAX_SPOKEN_TEXT_LENGTH
      ? value.spokenText
      : null;
  const expression = value.expression === undefined
    ? undefined
    : isEnum(value.expression, ['base', 'happy', 'thinking', 'celebrate', 'encourage'] as const)
      ? value.expression
      : null;
  if (spokenText === null || expression === null) return null;
  return {
    schemaVersion: 1,
    id,
    conversationId,
    role: value.role,
    text: value.text,
    ...(spokenText === undefined ? {} : { spokenText }),
    ...(expression === undefined ? {} : { expression }),
    sourceIds,
    createdAt: value.createdAt,
  };
}

function normalizeMessages(
  value: unknown,
  maxMessages: number,
  now: number,
): KoiCachedChatMessageV1[] {
  if (!Array.isArray(value)) return [];
  const normalizedMessages: KoiCachedChatMessageV1[] = [];
  for (const entry of value) {
    const message = normalizeMessage(entry);
    if (message) normalizedMessages.push(message);
  }
  return applyKoiChatRetention(normalizedMessages, now).slice(-maxMessages);
}

function normalizeDojoSession(value: unknown): KoiActiveDojoSessionV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !isEnum(value.rank, KOI_RANKS)
    || !isTimestamp(value.startedAt)
    || !isTimestamp(value.updatedAt)
    || value.updatedAt < value.startedAt) return null;
  const sessionId = normalizeIdentifier(value.sessionId);
  const questionContentIds = normalizeIdentifierList(value.questionContentIds, 5);
  const completedContentIds = normalizeIdentifierList(value.completedContentIds, 5);
  const correctContentIds = normalizeIdentifierList(value.correctContentIds, 5);
  if (!sessionId
    || !questionContentIds
    || questionContentIds.length !== 5
    || !completedContentIds
    || !correctContentIds
    || !isIntegerInRange(value.currentRound, 0, questionContentIds.length)
    || completedContentIds.length !== value.currentRound
    || completedContentIds.some(id => !questionContentIds.includes(id))
    || correctContentIds.some(id => !completedContentIds.includes(id))) return null;
  return {
    schemaVersion: 1,
    sessionId,
    rank: value.rank,
    questionContentIds,
    completedContentIds,
    correctContentIds,
    currentRound: value.currentRound,
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
  };
}

const STUDY_REWARD_EVENTS = [
  'lesson_completion',
  'flashcard_review',
  'quiz_attempt',
  'daily_rush',
  'kanji_session',
  'sentence_session',
  'dojo_completion',
] as const;

const SCORE_BANDS = ['under_50', '50_69', '70_79', '80_plus'] as const;

function normalizeClaim(value: unknown): KoiQueuedClaimV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !isTimestamp(value.occurredAt)) return null;
  const claimId = normalizeIdentifier(value.claimId);
  if (!claimId) return null;
  if (value.kind === 'study_reward') {
    const sourceId = normalizeIdentifier(value.sourceId);
    const scoreBand = value.scoreBand === undefined
      ? undefined
      : isEnum(value.scoreBand, SCORE_BANDS) ? value.scoreBand : null;
    if (!sourceId
      || !isEnum(value.eventType, STUDY_REWARD_EVENTS)
      || !isIntegerInRange(value.count, 1, 100)
      || scoreBand === null) return null;
    return {
      schemaVersion: 1,
      kind: 'study_reward',
      claimId,
      eventType: value.eventType,
      sourceId,
      occurredAt: value.occurredAt,
      count: value.count,
      ...(scoreBand === undefined ? {} : { scoreBand }),
    };
  }
  if (value.kind === 'mastery') {
    const milestoneId = normalizeIdentifier(value.milestoneId);
    const evidenceIds = normalizeIdentifierList(value.evidenceIds, 100);
    if (!isEnum(value.rank, KOI_RANKS)
      || !isEnum(value.domain, KOI_DOMAINS)
      || !isEnum(value.milestone, ['practice', 'mastery'] as const)
      || !milestoneId
      || !evidenceIds
      || evidenceIds.length === 0) return null;
    return {
      schemaVersion: 1,
      kind: 'mastery',
      claimId,
      rank: value.rank,
      domain: value.domain,
      milestone: value.milestone,
      milestoneId,
      evidenceIds,
      occurredAt: value.occurredAt,
    };
  }
  return null;
}

function normalizeClaims(value: unknown, maxClaims: number): KoiQueuedClaimV1[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, KoiQueuedClaimV1>();
  for (const entry of value) {
    const claim = normalizeClaim(entry);
    if (claim && !byId.has(claim.claimId)) byId.set(claim.claimId, claim);
    if (byId.size === maxClaims) break;
  }
  return Array.from(byId.values());
}

function normalizeDeletionTombstone(value: unknown): KoiCloudDeletionTombstoneV1 | null {
  if (!isObject(value)
    || value.schemaVersion !== 1
    || !isTimestamp(value.createdAt)
    || !isIntegerInRange(value.attemptCount, 0, Number.MAX_SAFE_INTEGER)
    || (value.lastAttemptAt !== undefined
      && (!isTimestamp(value.lastAttemptAt) || value.lastAttemptAt < value.createdAt))) return null;
  const requestId = normalizeIdentifier(value.requestId);
  if (!requestId) return null;
  return {
    schemaVersion: 1,
    requestId,
    createdAt: value.createdAt,
    attemptCount: value.attemptCount,
    ...(value.lastAttemptAt === undefined ? {} : { lastAttemptAt: value.lastAttemptAt }),
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeState(
  value: unknown,
  maxMessages: number,
  maxQueuedClaims: number,
  now: number,
): KoiSenseiLocalStateV1 {
  if (!isObject(value) || value.schemaVersion !== STORAGE_SCHEMA_VERSION) return createDefaultState();
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    eligibility: normalizeEligibility(value.eligibility),
    draft: typeof value.draft === 'string' ? value.draft.slice(0, MAX_DRAFT_LENGTH) : '',
    preferences: normalizePreferences(value.preferences),
    petSnapshot: normalizePetSnapshot(value.petSnapshot),
    experience: normalizeExperience(value.experience),
    messages: normalizeMessages(value.messages, maxMessages, now),
    activeDojoSession: normalizeDojoSession(value.activeDojoSession),
    queuedClaims: normalizeClaims(value.queuedClaims, maxQueuedClaims),
    cloudDeletionTombstone: normalizeDeletionTombstone(value.cloudDeletionTombstone),
  };
}

function parseState(
  raw: string | null,
  maxMessages: number,
  maxQueuedClaims: number,
  now: number,
): KoiSenseiLocalStateV1 {
  if (!raw) return createDefaultState();
  try {
    return normalizeState(JSON.parse(raw) as unknown, maxMessages, maxQueuedClaims, now);
  } catch {
    return createDefaultState();
  }
}

function validateCap(name: string, requested: number, maximum?: number): number {
  if (!Number.isSafeInteger(requested) || requested < 1 || (maximum !== undefined && requested > maximum)) {
    const suffix = maximum === undefined ? '' : ` and at most ${maximum}`;
    throw new Error(`${name} must be a positive integer${suffix}.`);
  }
  return requested;
}

export function createKoiSenseiRepository(
  storage: KoiStorage,
  options: KoiSenseiRepositoryOptions = {},
): KoiSenseiRepository {
  const maxMessages = validateCap(
    'Koi Sensei maxMessages',
    options.maxMessages ?? DEFAULT_MAX_MESSAGES,
    HARD_MAX_MESSAGES,
  );
  const maxQueuedClaims = validateCap(
    'Koi Sensei maxQueuedClaims',
    options.maxQueuedClaims ?? DEFAULT_MAX_QUEUED_CLAIMS,
  );
  const now = options.now ?? Date.now;
  let mutationQueue: Promise<void> = Promise.resolve();

  const enqueueMutation = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = mutationQueue.then(operation, operation);
    mutationQueue = next.then(() => undefined, () => undefined);
    return next;
  };

  const readForMutation = async (): Promise<KoiSenseiLocalStateV1> => (
    parseState(await storage.getItem(LOCAL_STATE_KEY), maxMessages, maxQueuedClaims, now())
  );

  const mutate = async (update: (state: KoiSenseiLocalStateV1) => KoiSenseiLocalStateV1): Promise<void> => {
    await enqueueMutation(async () => {
      const current = await readForMutation();
      const next = normalizeState(update(clone(current)), maxMessages, maxQueuedClaims, now());
      await storage.setItem(LOCAL_STATE_KEY, JSON.stringify(next));
    });
  };

  return {
    async load() {
      await mutationQueue;
      try {
        return clone(await readForMutation());
      } catch {
        return createDefaultState();
      }
    },

    async saveEligibility(record) {
      const normalized = normalizeEligibility(record);
      if (!normalized) throw new Error('Cannot persist an invalid Koi eligibility record.');
      await mutate(state => normalized.ageBand === 'under16'
        ? {
            ...state,
            eligibility: normalized,
            draft: '',
            messages: [],
            preferences: { ...state.preferences, detailedProgressConsent: false },
          }
        : { ...state, eligibility: normalized });
    },

    async revokeEligibility() {
      await mutate(state => ({
        ...state,
        eligibility: null,
        draft: '',
        messages: [],
        preferences: { ...state.preferences, detailedProgressConsent: false },
      }));
    },

    async saveDraft(draft) {
      if (typeof draft !== 'string') throw new Error('Koi Sensei draft must be a string.');
      await mutate(state => ({ ...state, draft: draft.slice(0, MAX_DRAFT_LENGTH) }));
    },

    async savePreferences(patch) {
      if (!isObject(patch)) throw new Error('Koi Sensei preferences patch must be an object.');
      await mutate(state => ({
        ...state,
        preferences: normalizePreferences({ ...state.preferences, ...patch }),
      }));
    },

    async savePetSnapshot(snapshot) {
      const normalized = snapshot === null ? null : normalizePetSnapshot(snapshot);
      if (snapshot !== null && !normalized) throw new Error('Cannot persist an invalid Koi pet snapshot.');
      await mutate(state => ({ ...state, petSnapshot: normalized }));
    },

    async saveLearningProgression(progression, claims, syncedAt) {
      const normalizedProgression = normalizeProgression(progression);
      if (!normalizedProgression) throw new Error('Cannot persist invalid Koi learning progression.');
      if (!isTimestamp(syncedAt)) throw new Error('Koi learning progression timestamp is invalid.');
      if (!Array.isArray(claims) || claims.length > MAX_LEARNING_CLAIMS_PER_WRITE) {
        throw new Error(`Koi learning progression accepts at most ${MAX_LEARNING_CLAIMS_PER_WRITE} claims per write.`);
      }
      const normalizedClaims = claims.map(claim => normalizeClaim(claim));
      if (normalizedClaims.some(claim => claim?.kind !== 'mastery')) {
        throw new Error('Koi learning progression claims are invalid.');
      }
      await mutate(state => {
        const currentSnapshot = state.petSnapshot ?? createDefaultKoiPetSnapshot();
        const mergedProgression = mergeKoiProgressionHighWater(
          currentSnapshot.progression,
          normalizedProgression,
        );
        const progressionChanged = JSON.stringify(mergedProgression)
          !== JSON.stringify(currentSnapshot.progression);
        const byId = new Map(state.queuedClaims.map(claim => [claim.claimId, claim]));
        const newClaims = normalizedClaims.filter((claim): claim is KoiQueuedMasteryClaimV1 => (
          claim?.kind === 'mastery' && !byId.has(claim.claimId)
        ));
        if (byId.size + newClaims.length > maxQueuedClaims) {
          // Keep the star snapshot and its retry markers atomic. Silently
          // dropping a mastery claim would make later server reconciliation
          // impossible, so a full queue leaves both unchanged for retry.
          throw new Error('Koi Sensei queued claim capacity has been reached.');
        }
        for (const claim of newClaims) byId.set(claim.claimId, claim);
        return {
          ...state,
          petSnapshot: progressionChanged
            ? {
                ...currentSnapshot,
                revision: Math.min(Number.MAX_SAFE_INTEGER, currentSnapshot.revision + 1),
                syncedAt: Math.max(currentSnapshot.syncedAt, syncedAt),
                progression: mergedProgression,
              }
            : state.petSnapshot,
          queuedClaims: Array.from(byId.values()),
        };
      });
    },

    async saveExperience(experience) {
      if (!isObject(experience)) throw new Error('Cannot persist an invalid Koi experience state.');
      await mutate(state => ({ ...state, experience: normalizeExperience(experience) }));
    },

    async saveActivityState(snapshot, experience, activeDojoSession) {
      const normalizedSnapshot = normalizePetSnapshot(snapshot);
      const normalizedSession = activeDojoSession === null ? null : normalizeDojoSession(activeDojoSession);
      if (!normalizedSnapshot) throw new Error('Cannot persist an invalid Koi pet snapshot.');
      if (activeDojoSession !== null && !normalizedSession) {
        throw new Error('Cannot persist an invalid Koi dojo session.');
      }
      if (!isObject(experience)) throw new Error('Cannot persist an invalid Koi experience state.');
      await mutate(state => ({
        ...state,
        petSnapshot: normalizedSnapshot,
        experience: normalizeExperience(experience),
        activeDojoSession: normalizedSession,
      }));
    },

    async appendMessage(message) {
      const normalized = normalizeMessage(message);
      if (!normalized) throw new Error('Cannot persist an invalid Koi chat message.');
      await mutate(state => ({
        ...state,
        messages: normalizeMessages(
          [...state.messages.filter(existing => existing.id !== normalized.id), normalized],
          maxMessages,
          now(),
        ),
      }));
    },

    async appendMessages(messages) {
      if (!Array.isArray(messages)) throw new Error('Koi Sensei messages must be an array.');
      const normalized = messages.map(message => normalizeMessage(message));
      if (normalized.some(message => message === null)) {
        throw new Error('Cannot persist invalid Koi chat messages.');
      }
      await mutate(state => ({
        ...state,
        messages: normalizeMessages([...state.messages, ...normalized], maxMessages, now()),
      }));
    },

    async replaceMessages(messages) {
      if (!Array.isArray(messages)) throw new Error('Koi Sensei messages must be an array.');
      const normalized = messages.map(message => normalizeMessage(message));
      if (normalized.some(message => message === null)) {
        throw new Error('Cannot persist invalid Koi chat messages.');
      }
      await mutate(state => ({ ...state, messages: normalizeMessages(normalized, maxMessages, now()) }));
    },

    async clearMessages() {
      await mutate(state => ({ ...state, messages: [] }));
    },

    async clearChat() {
      await mutate(state => ({ ...state, draft: '', messages: [] }));
    },

    async saveActiveDojoSession(session) {
      const normalized = session === null ? null : normalizeDojoSession(session);
      if (session !== null && !normalized) throw new Error('Cannot persist an invalid Koi dojo session.');
      await mutate(state => ({ ...state, activeDojoSession: normalized }));
    },

    async enqueueClaim(claim) {
      const normalized = normalizeClaim(claim);
      if (!normalized) throw new Error('Cannot persist an invalid Koi claim.');
      await enqueueMutation(async () => {
        const state = await readForMutation();
        if (state.queuedClaims.some(existing => existing.claimId === normalized.claimId)) return;
        if (state.queuedClaims.length >= maxQueuedClaims) {
          throw new Error('Koi Sensei queued claim capacity has been reached.');
        }
        const next = { ...state, queuedClaims: [...state.queuedClaims, normalized] };
        await storage.setItem(LOCAL_STATE_KEY, JSON.stringify(next));
      });
    },

    async acknowledgeClaims(claimIds) {
      if (!Array.isArray(claimIds)) throw new Error('Koi Sensei claim ids must be an array.');
      const normalized = normalizeIdentifierList(claimIds, maxQueuedClaims);
      if (!normalized) throw new Error('Koi Sensei claim ids are invalid.');
      const acknowledged = new Set(normalized);
      await mutate(state => ({
        ...state,
        queuedClaims: state.queuedClaims.filter(claim => !acknowledged.has(claim.claimId)),
      }));
    },

    async clearQueuedClaims() {
      await mutate(state => ({ ...state, queuedClaims: [] }));
    },

    async setCloudDeletionTombstone(tombstone) {
      const normalized = normalizeDeletionTombstone(tombstone);
      if (!normalized) throw new Error('Cannot persist an invalid Koi cloud deletion tombstone.');
      await mutate(state => ({ ...state, cloudDeletionTombstone: normalized }));
    },

    async clearCloudDeletionTombstone() {
      await mutate(state => ({ ...state, cloudDeletionTombstone: null }));
    },

    async reset() {
      await enqueueMutation(() => storage.removeItem(LOCAL_STATE_KEY));
    },
  };
}

let sharedRepositoryPromise: Promise<KoiSenseiRepository> | null = null;

/** Uses the same web/local-SQLite bootstrap and connection as onboarding. */
export function openKoiSenseiRepository(): Promise<KoiSenseiRepository> {
  if (!sharedRepositoryPromise) {
    // Keep the platform bootstrap lazy so pure domain/repository tests do not
    // load React Native. The app path still shares onboarding's one SQLite/
    // localStorage initialization promise.
    sharedRepositoryPromise = import('../../../app/onboardingStorage')
      .then(({ openOnboardingStorage }) => openOnboardingStorage())
      .then(storage => createKoiSenseiRepository(storage));
  }
  return sharedRepositoryPromise;
}

export const KOI_SENSEI_STORAGE_KEYS = { localState: LOCAL_STATE_KEY } as const;
