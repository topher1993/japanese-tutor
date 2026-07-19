export const KOI_ACTIVE_ACCOUNT_LIMIT = 50;
export const KOI_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const KOI_CAPACITY_CACHE_MS = 30 * 1_000;
export const KOI_CAPACITY_STALE_AFTER_MS = 5 * 60 * 1_000;
export const KOI_CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
export const KOI_MAX_MESSAGES = 200;
export const KOI_CURRENT_AI_POLICY_VERSION = 'koi-ai-data-2026-07-16';
export const KOI_CURRENT_PRIVACY_POLICY_VERSION = 'koi-privacy-2026-07-16';

export type KoiCapacityBand = 'high' | 'normal' | 'low' | 'critical' | 'paused';

export interface KoiProviderCapacitySnapshot {
  rollingRemainingPercent: number;
  weeklyRemainingPercent?: number;
  fetchedAtMs: number;
  retryAtMs?: number;
}

export interface KoiAllowanceLimits {
  band: KoiCapacityBand;
  chatLimit: number;
  voiceLimit: number;
  reason?: 'capacity_stale' | 'token_plan_exhausted';
  retryAtMs?: number;
}

export interface KoiAllowanceGrant {
  schemaVersion: 1;
  grantedAtMs: number;
  expiresAtMs: number;
  chatLimit: number;
  chatUsed: number;
  voiceLimit: number;
  voiceUsed: number;
  capacityBand: KoiCapacityBand;
  providerRetryAtMs?: number;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
);

const finiteNumber = (value: unknown): number | null => {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : null;
};

const percent = (remaining: unknown, total: unknown): number | null => {
  const remainingValue = finiteNumber(remaining);
  const totalValue = finiteNumber(total);
  if (remainingValue === null || totalValue === null || totalValue <= 0 || remainingValue < 0) return null;
  return Math.max(0, Math.min(100, remainingValue / totalValue * 100));
};

const epochMs = (value: unknown): number | undefined => {
  const result = finiteNumber(value);
  if (result === null || result <= 0) return undefined;
  return result < 10_000_000_000 ? result * 1_000 : result;
};

const modelName = (entry: UnknownRecord): string => String(
  entry.model_name ?? entry.model ?? entry.model_id ?? '',
).toLowerCase().replaceAll('-', '');

/** Parse only documented/observed quota counters. Unknown shapes fail closed. */
export function parseMiniMaxCapacity(
  payload: unknown,
  model: string,
  nowMs: number,
): KoiProviderCapacitySnapshot | null {
  const root = asRecord(payload);
  if (!root) return null;
  const base = asRecord(root.base_resp ?? root.base_response);
  const status = finiteNumber(base?.status_code ?? root.status_code);
  if (status !== null && status !== 0) return null;
  const data = asRecord(root.data);
  const entries = root.model_remains ?? root.model_remain ?? data?.model_remains ?? data?.model_remain;
  if (!Array.isArray(entries)) return null;
  const normalizedModel = model.toLowerCase().replaceAll('-', '');
  const entry = entries.map(asRecord).find((candidate): candidate is UnknownRecord => (
    candidate !== null && modelName(candidate) === normalizedModel
  ));
  if (!entry) return null;

  const rolling = percent(
    entry.current_interval_usage_count ?? entry.current_interval_remaining_count,
    entry.current_interval_total_count,
  );
  if (rolling === null) return null;

  const weeklyStatus = finiteNumber(entry.current_weekly_status);
  let weekly: number | undefined;
  if (weeklyStatus === 3) {
    weekly = undefined;
  } else if (weeklyStatus !== null && weeklyStatus !== 1) {
    weekly = 0;
  } else {
    const parsedWeekly = percent(
      entry.current_weekly_usage_count ?? entry.current_weekly_remaining_count,
      entry.current_weekly_total_count,
    );
    if (weeklyStatus === 1 && parsedWeekly === null) return null;
    weekly = parsedWeekly ?? undefined;
  }
  return {
    rollingRemainingPercent: rolling,
    ...(weekly === undefined ? {} : { weeklyRemainingPercent: weekly }),
    fetchedAtMs: nowMs,
    ...(epochMs(entry.current_interval_end_time ?? entry.end_time ?? entry.next_reset_time) === undefined
      ? {}
      : { retryAtMs: epochMs(entry.current_interval_end_time ?? entry.end_time ?? entry.next_reset_time) }),
  };
}

export function deriveKoiAllowanceLimits(
  snapshot: KoiProviderCapacitySnapshot,
  nowMs: number,
): KoiAllowanceLimits {
  const effective = Math.min(
    snapshot.rollingRemainingPercent,
    snapshot.weeklyRemainingPercent ?? snapshot.rollingRemainingPercent,
  );
  if (nowMs - snapshot.fetchedAtMs > KOI_CAPACITY_STALE_AFTER_MS) {
    return { band: 'paused', chatLimit: 0, voiceLimit: 0, reason: 'capacity_stale', retryAtMs: snapshot.retryAtMs };
  }
  if (!Number.isFinite(effective) || effective < 10) {
    return { band: 'paused', chatLimit: 0, voiceLimit: 0, reason: 'token_plan_exhausted', retryAtMs: snapshot.retryAtMs };
  }
  if (effective < 15) return { band: 'critical', chatLimit: 5, voiceLimit: 0 };
  if (effective < 20) return { band: 'critical', chatLimit: 5, voiceLimit: 1 };
  if (effective < 40) return { band: 'low', chatLimit: 8, voiceLimit: 2 };
  if (effective < 70) return { band: 'normal', chatLimit: 10, voiceLimit: 3 };
  return { band: 'high', chatLimit: 12, voiceLimit: 4 };
}

export function reconcileKoiAllowance(
  previous: KoiAllowanceGrant | null,
  limits: KoiAllowanceLimits,
  nowMs: number,
): KoiAllowanceGrant {
  if (!previous || previous.expiresAtMs <= nowMs) {
    return {
      schemaVersion: 1,
      grantedAtMs: nowMs,
      expiresAtMs: nowMs + KOI_ALLOWANCE_WINDOW_MS,
      chatLimit: limits.chatLimit,
      chatUsed: 0,
      voiceLimit: limits.voiceLimit,
      voiceUsed: 0,
      capacityBand: limits.band,
      ...(limits.retryAtMs === undefined ? {} : { providerRetryAtMs: limits.retryAtMs }),
    };
  }
  return {
    ...previous,
    chatLimit: Math.max(previous.chatLimit, limits.chatLimit),
    voiceLimit: Math.max(previous.voiceLimit, limits.voiceLimit),
    capacityBand: limits.band,
    ...(limits.retryAtMs === undefined ? {} : { providerRetryAtMs: limits.retryAtMs }),
  };
}

export function reserveChat(
  previous: KoiAllowanceGrant | null,
  limits: KoiAllowanceLimits,
  nowMs: number,
): { allowed: true; allowance: KoiAllowanceGrant } | { allowed: false; reason: string; allowance: KoiAllowanceGrant } {
  const allowance = reconcileKoiAllowance(previous, limits, nowMs);
  if (limits.reason) return { allowed: false, reason: limits.reason, allowance };
  if (allowance.chatUsed >= allowance.chatLimit) {
    return { allowed: false, reason: 'chat_allowance_exhausted', allowance };
  }
  return { allowed: true, allowance: { ...allowance, chatUsed: allowance.chatUsed + 1 } };
}

export interface RetainedMessage { createdAtMs: number }

export function retainKoiMessages<T extends RetainedMessage>(messages: readonly T[], nowMs: number): T[] {
  const cutoff = nowMs - KOI_CHAT_RETENTION_MS;
  return messages.filter(message => message.createdAtMs >= cutoff).slice(-KOI_MAX_MESSAGES);
}

export function hasCurrentKoiConsent(state: UnknownRecord): boolean {
  const registration = asRecord(state.registration);
  return registration?.status === 'active'
    && registration.aiPolicyVersion === KOI_CURRENT_AI_POLICY_VERSION
    && registration.privacyPolicyVersion === KOI_CURRENT_PRIVACY_POLICY_VERSION
    && finiteNumber(state.revokedAtMs) === null;
}

const blockedInputPatterns = [
  /\b(?:password|passcode|api[ _-]?key|access token|credit card|bank account)\b/iu,
  /\b(?:suicide|self[- ]harm|kill myself)\b/iu,
  /\b(?:medical diagnosis|legal advice|investment advice)\b/iu,
];

export function isSafeKoiQuestion(value: string): boolean {
  const text = value.trim();
  return text.length > 0 && text.length <= 2_000 && !blockedInputPatterns.some(pattern => pattern.test(text));
}

const governedStaticQuestions: Readonly<Record<string, Readonly<{
  answer: string;
  domain: 'vocabulary' | 'grammar' | 'phrases' | 'quizzes';
  rank: 'N5' | 'N4';
}>>> = Object.freeze({
  'n5-grammar-001': { answer: 'B', domain: 'grammar', rank: 'N5' },
  'n5-vocabulary-001': { answer: 'A', domain: 'vocabulary', rank: 'N5' },
  'n5-phrases-001': { answer: 'C', domain: 'phrases', rank: 'N5' },
  'n5-quiz-001': { answer: 'A', domain: 'quizzes', rank: 'N5' },
  'n4-grammar-001': { answer: 'C', domain: 'grammar', rank: 'N4' },
  'n4-vocabulary-001': { answer: 'B', domain: 'vocabulary', rank: 'N4' },
  'n4-phrases-001': { answer: 'A', domain: 'phrases', rank: 'N4' },
  'n4-quiz-001': { answer: 'C', domain: 'quizzes', rank: 'N4' },
});

export function resolveGovernedKoiQuestion(
  questionId: string,
  domain: string,
  rank: string,
): Readonly<{ answer: string; domain: 'vocabulary' | 'grammar' | 'phrases' | 'quizzes'; rank: 'N5' | 'N4' }> | null {
  const staticQuestion = governedStaticQuestions[questionId];
  if (staticQuestion) {
    return staticQuestion.domain === domain && staticQuestion.rank === rank ? staticQuestion : null;
  }
  const vocabularyMatch = /^cand-(vocab-n5|n4-vocab)-(\d{4})$/.exec(questionId);
  if (!vocabularyMatch || domain !== 'vocabulary') return null;
  const expectedRank = vocabularyMatch[1] === 'vocab-n5' ? 'N5' : 'N4';
  const ordinal = Number(vocabularyMatch[2]);
  if (rank !== expectedRank || ordinal < 1 || ordinal > 999) return null;
  return { answer: questionId, domain: 'vocabulary', rank: expectedRank };
}

export function reconcileKoiQuestionEvidence(
  existingQuestionIds: readonly string[],
  questionId: string,
  correct: boolean,
): Readonly<{ questionIds: string[]; evidenceCount: number; domainStars: 0 | 1 | 2 }> {
  const questionIds = new Set(existingQuestionIds.filter(value => typeof value === 'string' && value.length <= 160));
  if (correct) questionIds.add(questionId);
  const retained = Array.from(questionIds).slice(-100);
  return {
    questionIds: retained,
    evidenceCount: retained.length,
    domainStars: retained.length >= 8 ? 2 : retained.length >= 4 ? 1 : 0,
  };
}
