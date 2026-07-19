export const KOI_PROVIDER_MAX_CONCURRENCY = 2;
export const KOI_ALLOWANCE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const KOI_CAPACITY_STALE_AFTER_MS = 5 * 60 * 1000;

export type KoiCapacityBand = 'high' | 'normal' | 'low' | 'critical' | 'paused';
export type KoiAllowanceKind = 'chat' | 'voice';
export type KoiUsageMode = 'personal_unlimited' | 'metered';

export interface KoiProviderCapacitySnapshot {
  rollingRemainingPercent: number;
  weeklyRemainingPercent?: number;
  fetchedAtMs: number;
  retryAtMs?: number;
}

export interface KoiAllowanceLimits {
  band: KoiCapacityBand;
  usageMode: KoiUsageMode;
  effectiveRemainingPercent: number;
  chatLimit: number;
  voiceLimit: number;
  reason?: 'CAPACITY_STALE' | 'TOKEN_PLAN_EXHAUSTED';
  retryAtMs?: number;
}

export interface KoiAllowanceGrantV1 {
  schemaVersion: 1;
  grantedAtMs: number;
  expiresAtMs: number;
  chatLimit: number;
  chatUsed: number;
  voiceLimit: number;
  voiceUsed: number;
  capacityBand: KoiCapacityBand;
  usageMode: KoiUsageMode;
}

export type KoiAllowanceDecision =
  | { allowed: true; grant: KoiAllowanceGrantV1 }
  | {
      allowed: false;
      grant: KoiAllowanceGrantV1;
      reason:
        | 'CAPACITY_STALE'
        | 'TOKEN_PLAN_EXHAUSTED'
        | 'VOICE_CAPACITY_PAUSED'
        | 'CHAT_ALLOWANCE_EXHAUSTED'
        | 'VOICE_ALLOWANCE_EXHAUSTED';
      retryAtMs: number;
    };

const clampPercent = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
};

export function getEffectiveRemainingPercent(snapshot: KoiProviderCapacitySnapshot): number {
  const rolling = clampPercent(snapshot.rollingRemainingPercent);
  if (snapshot.weeklyRemainingPercent === undefined) return rolling;
  return Math.min(rolling, clampPercent(snapshot.weeklyRemainingPercent));
}

export function deriveKoiAllowanceLimits(
  snapshot: KoiProviderCapacitySnapshot,
  nowMs: number,
  usageMode: KoiUsageMode = 'metered',
): KoiAllowanceLimits {
  const effectiveRemainingPercent = getEffectiveRemainingPercent(snapshot);
  if (nowMs - snapshot.fetchedAtMs > KOI_CAPACITY_STALE_AFTER_MS) {
    return {
      band: 'paused',
      usageMode,
      effectiveRemainingPercent,
      chatLimit: 0,
      voiceLimit: 0,
      reason: 'CAPACITY_STALE',
      retryAtMs: snapshot.fetchedAtMs + KOI_CAPACITY_STALE_AFTER_MS,
    };
  }
  if (effectiveRemainingPercent < 10) {
    return {
      band: 'paused',
      usageMode,
      effectiveRemainingPercent,
      chatLimit: 0,
      voiceLimit: 0,
      reason: 'TOKEN_PLAN_EXHAUSTED',
      retryAtMs: snapshot.retryAtMs,
    };
  }
  if (effectiveRemainingPercent < 15) {
    return { band: 'critical', usageMode, effectiveRemainingPercent, chatLimit: 5, voiceLimit: 0 };
  }
  if (effectiveRemainingPercent < 20) {
    return { band: 'critical', usageMode, effectiveRemainingPercent, chatLimit: 5, voiceLimit: 1 };
  }
  if (effectiveRemainingPercent < 40) {
    return { band: 'low', usageMode, effectiveRemainingPercent, chatLimit: 8, voiceLimit: 2 };
  }
  if (effectiveRemainingPercent < 70) {
    return { band: 'normal', usageMode, effectiveRemainingPercent, chatLimit: 10, voiceLimit: 3 };
  }
  return { band: 'high', usageMode, effectiveRemainingPercent, chatLimit: 12, voiceLimit: 4 };
}

export function reconcileKoiAllowanceGrant(
  previous: KoiAllowanceGrantV1 | null,
  limits: KoiAllowanceLimits,
  nowMs: number,
): KoiAllowanceGrantV1 {
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
      usageMode: limits.usageMode,
    };
  }
  return {
    ...previous,
    // A normal capacity change never takes away an allowance already shown
    // to the learner. Emergency fail-closed checks are applied per request.
    chatLimit: Math.max(previous.chatLimit, limits.chatLimit),
    voiceLimit: Math.max(previous.voiceLimit, limits.voiceLimit),
    capacityBand: limits.band,
    usageMode: limits.usageMode,
  };
}

export function consumeKoiAllowance(
  grant: KoiAllowanceGrantV1,
  kind: KoiAllowanceKind,
  limits: KoiAllowanceLimits,
): KoiAllowanceDecision {
  if (limits.reason === 'CAPACITY_STALE' || limits.reason === 'TOKEN_PLAN_EXHAUSTED') {
    return {
      allowed: false,
      grant,
      reason: limits.reason,
      retryAtMs: limits.retryAtMs ?? grant.expiresAtMs,
    };
  }
  if (limits.usageMode === 'personal_unlimited') {
    return {
      allowed: true,
      grant: kind === 'chat'
        ? { ...grant, usageMode: limits.usageMode, chatUsed: grant.chatUsed + 1 }
        : { ...grant, usageMode: limits.usageMode, voiceUsed: grant.voiceUsed + 1 },
    };
  }
  if (kind === 'voice' && limits.voiceLimit === 0) {
    return {
      allowed: false,
      grant,
      reason: 'VOICE_CAPACITY_PAUSED',
      retryAtMs: grant.expiresAtMs,
    };
  }
  if (kind === 'chat' && grant.chatUsed >= grant.chatLimit) {
    return {
      allowed: false,
      grant,
      reason: 'CHAT_ALLOWANCE_EXHAUSTED',
      retryAtMs: grant.expiresAtMs,
    };
  }
  if (kind === 'voice' && grant.voiceUsed >= grant.voiceLimit) {
    return {
      allowed: false,
      grant,
      reason: 'VOICE_ALLOWANCE_EXHAUSTED',
      retryAtMs: grant.expiresAtMs,
    };
  }
  return {
    allowed: true,
    grant: kind === 'chat'
      ? { ...grant, chatUsed: grant.chatUsed + 1 }
      : { ...grant, voiceUsed: grant.voiceUsed + 1 },
  };
}
