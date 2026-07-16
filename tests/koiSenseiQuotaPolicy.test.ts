import { describe, expect, it } from 'vitest';

import {
  KOI_ALLOWANCE_WINDOW_MS,
  KOI_PROVIDER_MAX_CONCURRENCY,
  consumeKoiAllowance,
  deriveKoiAllowanceLimits,
  reconcileKoiAllowanceGrant,
  type KoiProviderCapacitySnapshot,
} from '../src/features/koi-sensei/api';

const NOW = Date.UTC(2026, 6, 16, 12);

const capacity = (
  rollingRemainingPercent: number,
  weeklyRemainingPercent = rollingRemainingPercent,
  fetchedAtMs = NOW,
): KoiProviderCapacitySnapshot => ({
  rollingRemainingPercent,
  weeklyRemainingPercent,
  fetchedAtMs,
});

describe('Koi subscription-only dynamic quota policy', () => {
  it('uses the lower remaining percentage across provider windows', () => {
    expect(deriveKoiAllowanceLimits(capacity(90, 35), NOW)).toMatchObject({
      band: 'low',
      effectiveRemainingPercent: 35,
      chatLimit: 8,
      voiceLimit: 2,
    });
  });

  it.each([
    [90, 'high', 12, 4],
    [70, 'high', 12, 4],
    [69, 'normal', 10, 3],
    [40, 'normal', 10, 3],
    [39, 'low', 8, 2],
    [20, 'low', 8, 2],
    [19, 'critical', 5, 1],
    [15, 'critical', 5, 1],
    [14, 'critical', 5, 0],
    [10, 'critical', 5, 0],
    [9, 'paused', 0, 0],
  ] as const)('maps %s%% to the planned allowance band', (remaining, band, chatLimit, voiceLimit) => {
    expect(deriveKoiAllowanceLimits(capacity(remaining), NOW)).toMatchObject({ band, chatLimit, voiceLimit });
  });

  it('fails closed when provider capacity is stale', () => {
    expect(deriveKoiAllowanceLimits(capacity(90, 90, NOW - 5 * 60 * 1000 - 1), NOW)).toMatchObject({
      band: 'paused',
      reason: 'CAPACITY_STALE',
      chatLimit: 0,
      voiceLimit: 0,
    });
  });

  it('creates a rolling grant and only raises displayed limits during its window', () => {
    const normal = deriveKoiAllowanceLimits(capacity(50), NOW);
    const grant = reconcileKoiAllowanceGrant(null, normal, NOW);
    expect(grant).toMatchObject({ chatLimit: 10, voiceLimit: 3, chatUsed: 0, voiceUsed: 0 });
    expect(grant.expiresAtMs - grant.grantedAtMs).toBe(KOI_ALLOWANCE_WINDOW_MS);

    const lower = deriveKoiAllowanceLimits(capacity(25), NOW);
    expect(reconcileKoiAllowanceGrant(grant, lower, NOW + 1)).toMatchObject({ chatLimit: 10, voiceLimit: 3 });

    const higher = deriveKoiAllowanceLimits(capacity(80), NOW);
    expect(reconcileKoiAllowanceGrant(grant, higher, NOW + 1)).toMatchObject({ chatLimit: 12, voiceLimit: 4 });
  });

  it('consumes chat and voice independently and blocks exhausted allowances', () => {
    const limits = deriveKoiAllowanceLimits(capacity(15), NOW);
    let grant = reconcileKoiAllowanceGrant(null, limits, NOW);
    const voice = consumeKoiAllowance(grant, 'voice', limits);
    expect(voice.allowed).toBe(true);
    if (voice.allowed) grant = voice.grant;
    expect(consumeKoiAllowance(grant, 'voice', limits)).toMatchObject({
      allowed: false,
      reason: 'VOICE_ALLOWANCE_EXHAUSTED',
    });
    expect(consumeKoiAllowance(grant, 'chat', limits)).toMatchObject({ allowed: true });
  });

  it('applies emergency provider pauses even to a previously larger grant', () => {
    const grant = reconcileKoiAllowanceGrant(null, deriveKoiAllowanceLimits(capacity(90), NOW), NOW);
    const paused = deriveKoiAllowanceLimits(capacity(9), NOW);
    expect(consumeKoiAllowance(grant, 'chat', paused)).toMatchObject({
      allowed: false,
      reason: 'TOKEN_PLAN_EXHAUSTED',
    });
  });

  it('reserves no more than two concurrent provider calls', () => {
    expect(KOI_PROVIDER_MAX_CONCURRENCY).toBe(2);
  });
});
