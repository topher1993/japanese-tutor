import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  KOI_CURRENT_AI_POLICY_VERSION,
  KOI_CURRENT_PRIVACY_POLICY_VERSION,
  completeKoiRegistrationRequestSchema,
} from '../../shared/koi/contracts.js';
import type { KoiAllowanceGrantV1 } from '../../src/features/koi-sensei/api/quotaPolicy.js';
import {
  decideKoiAllowanceRefresh,
  ownsKoiAllowanceRefresh,
} from '../src/allowanceRefresh.js';
import {
  KOI_ALLOWANCE_REFRESH_COOLDOWN_MS,
  KOI_ALLOWANCE_REFRESH_LEASE_MS,
  KOI_CALLABLE_TIMEOUT_MS,
  KOI_PROVIDER_CAPACITY_CACHE_TTL_MS,
  KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS,
} from '../src/config.js';
import {
  decideKoiCapacityRefresh,
  ownsKoiCapacityRefresh,
} from '../src/providerCapacityCache.js';
import {
  decideKoiRequestReservation,
  fingerprintKoiRequestPayload,
  ownsKoiRequestReservation,
} from '../src/requestReservation.js';
import {
  KOI_REQUEST_RESERVATION_MS,
  decideKoiDeletion,
  evaluateKoiRegistrationAccess,
  isKoiRegistrationCleanupPending,
  refreshKoiRegistration,
  revokeKoiRegistration,
} from '../src/store.js';

const nowMs = 2_000_000;

describe('authoritative Koi policy and consent state', () => {
  it('accepts only the current server policy versions at registration', () => {
    const request = {
      schemaVersion: 1,
      requestId: randomUUID(),
      ageBand: '18_plus',
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      acknowledgedUsProcessing: true,
      supportLanguage: 'en',
    };
    expect(completeKoiRegistrationRequestSchema.safeParse(request).success).toBe(true);
    expect(completeKoiRegistrationRequestSchema.safeParse({
      ...request,
      aiPolicyVersion: 'forged-newer-policy',
    }).success).toBe(false);
    expect(completeKoiRegistrationRequestSchema.safeParse({
      ...request,
      privacyPolicyVersion: 'stale-policy',
    }).success).toBe(false);
  });

  it('fails protected access closed for stale or revoked consent and restores it only on refresh', () => {
    const active = refreshKoiRegistration(null, 'active', {
      ageBand: '18_plus',
      supportLanguage: 'en',
    }, nowMs);
    expect(evaluateKoiRegistrationAccess(active)).toBe('active');
    const legacyWithoutExplicitConsent: Record<string, unknown> = { ...active };
    delete legacyWithoutExplicitConsent.consentStatus;
    delete legacyWithoutExplicitConsent.consentedAtMs;
    expect(evaluateKoiRegistrationAccess(legacyWithoutExplicitConsent)).toBe('missing');
    expect(evaluateKoiRegistrationAccess({ ...active, aiPolicyVersion: 'stale' })).toBe('consent_required');

    const revoked = revokeKoiRegistration(active, nowMs + 1);
    expect(revoked.cleanupPending).toBe(true);
    expect(isKoiRegistrationCleanupPending(revoked)).toBe(true);
    expect(evaluateKoiRegistrationAccess(revoked)).toBe('consent_required');
    const refreshed = refreshKoiRegistration({ ...revoked, cleanupPending: false }, 'active', {
      ageBand: '16_17',
      supportLanguage: 'tl',
    }, nowMs + 2);
    expect(refreshed).toMatchObject({
      consentStatus: 'granted',
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      createdAtMs: active.createdAtMs,
      consentedAtMs: nowMs + 2,
      cleanupPending: false,
    });
    expect(evaluateKoiRegistrationAccess(refreshed)).toBe('active');
  });
});

describe('idempotent beta-seat deletion', () => {
  it('decrements an active seat exactly once across deletion retries', () => {
    const first = decideKoiDeletion({ status: 'active' }, 50);
    expect(first).toEqual({ shouldMarkDeleting: true, nextActiveCount: 49 });
    const retry = decideKoiDeletion({ status: 'active', deletionState: 'deleting' }, first.nextActiveCount);
    expect(retry).toEqual({ shouldMarkDeleting: false, nextActiveCount: 49 });
  });
});

describe('owned idempotency reservations', () => {
  it('binds an id to its payload and lets only the newest stale-retry owner mutate it', () => {
    const fingerprint = fingerprintKoiRequestPayload('ask', {
      conversationId: randomUUID(),
      text: 'What does は mark?',
    });
    const first = decideKoiRequestReservation(
      null,
      fingerprint,
      1,
      'owner-1',
      nowMs,
      KOI_REQUEST_RESERVATION_MS,
      () => null,
    );
    expect(first.kind).toBe('reserved');
    if (first.kind !== 'reserved') throw new Error('expected reservation');

    expect(decideKoiRequestReservation(
      first.record,
      fingerprint,
      1,
      'owner-2',
      nowMs + 1,
      KOI_REQUEST_RESERVATION_MS,
      () => null,
    )).toMatchObject({ kind: 'busy', retryAtMs: first.record.expiresAtMs });
    expect(decideKoiRequestReservation(
      first.record,
      fingerprintKoiRequestPayload('ask', { conversationId: randomUUID(), text: 'forged' }),
      1,
      'owner-forged',
      nowMs + 1,
      KOI_REQUEST_RESERVATION_MS,
      () => null,
    )).toEqual({ kind: 'fingerprint_mismatch' });

    const retry = decideKoiRequestReservation(
      first.record,
      fingerprint,
      1,
      'owner-2',
      first.record.expiresAtMs + 1,
      KOI_REQUEST_RESERVATION_MS,
      () => null,
    );
    expect(retry.kind).toBe('reserved');
    if (retry.kind !== 'reserved') throw new Error('expected retry reservation');
    expect(ownsKoiRequestReservation(retry.record, 'owner-1', fingerprint, 1)).toBe(false);
    expect(ownsKoiRequestReservation(retry.record, 'owner-2', fingerprint, 1)).toBe(true);
  });

  it('keeps reservations safely beyond the callable timeout and validates cached fingerprints', () => {
    expect(KOI_REQUEST_RESERVATION_MS).toBeGreaterThan(KOI_CALLABLE_TIMEOUT_MS);
    const fingerprint = fingerprintKoiRequestPayload('synthesize', { assistantMessageId: randomUUID() });
    const completed = {
      status: 'completed',
      payloadFingerprint: fingerprint,
      consentEpoch: 1,
      response: 'cached-response',
    };
    expect(decideKoiRequestReservation(
      completed,
      fingerprint,
      1,
      'unused',
      nowMs,
      KOI_REQUEST_RESERVATION_MS,
      (value) => typeof value === 'string' ? value : null,
    )).toEqual({ kind: 'cached', response: 'cached-response' });
    expect(decideKoiRequestReservation(
      completed,
      '0'.repeat(64),
      1,
      'forged',
      nowMs,
      KOI_REQUEST_RESERVATION_MS,
      () => 'unsafe',
    )).toEqual({ kind: 'fingerprint_mismatch' });
  });
});

describe('shared capacity cache and allowance refresh rate limits', () => {
  const capacity = {
    chat: { rollingRemainingPercent: 80, weeklyRemainingPercent: 75, fetchedAtMs: nowMs },
    tts: { remainingCharacters: 3_000, fetchedAtMs: nowMs },
    fetchedAtMs: nowMs,
  };
  const grant: KoiAllowanceGrantV1 = {
    schemaVersion: 1,
    grantedAtMs: nowMs,
    expiresAtMs: nowMs + 86_400_000,
    chatLimit: 12,
    chatUsed: 1,
    voiceLimit: 4,
    voiceUsed: 0,
    capacityBand: 'high',
  };

  it('serves a fresh shared cache and single-flights stale provider refreshes', () => {
    expect(decideKoiCapacityRefresh(
      { capacity },
      'owner-1',
      nowMs + KOI_PROVIDER_CAPACITY_CACHE_TTL_MS - 1,
      KOI_PROVIDER_CAPACITY_CACHE_TTL_MS,
      KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS,
    )).toMatchObject({ kind: 'cached' });

    const reserved = decideKoiCapacityRefresh(
      { capacity },
      'owner-1',
      nowMs + KOI_PROVIDER_CAPACITY_CACHE_TTL_MS + 1,
      KOI_PROVIDER_CAPACITY_CACHE_TTL_MS,
      KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS,
    );
    expect(reserved).toMatchObject({ kind: 'reserved', ownerToken: 'owner-1' });
    expect(ownsKoiCapacityRefresh({ refreshOwnerToken: 'owner-1' }, 'owner-1')).toBe(true);
    expect(decideKoiCapacityRefresh(
      {
        capacity,
        refreshOwnerToken: 'owner-1',
        refreshExpiresAtMs: nowMs + 60_000,
      },
      'owner-2',
      nowMs + KOI_PROVIDER_CAPACITY_CACHE_TTL_MS + 1,
      KOI_PROVIDER_CAPACITY_CACHE_TTL_MS,
      KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS,
    )).toMatchObject({ kind: 'in_progress', staleCapacity: capacity });
  });

  it('returns a recent per-user allowance without another refresh and rate-limits an empty concurrent refresh', () => {
    expect(decideKoiAllowanceRefresh({
      grant,
      lastRefreshAtMs: nowMs,
      refreshOwnerToken: null,
      refreshExpiresAtMs: null,
    }, 'owner-1', nowMs + KOI_ALLOWANCE_REFRESH_COOLDOWN_MS - 1,
    KOI_ALLOWANCE_REFRESH_COOLDOWN_MS, KOI_ALLOWANCE_REFRESH_LEASE_MS)).toEqual({
      kind: 'cached',
      grant,
    });

    expect(decideKoiAllowanceRefresh({
      grant: null,
      lastRefreshAtMs: null,
      refreshOwnerToken: 'owner-1',
      refreshExpiresAtMs: nowMs + 5_000,
    }, 'owner-2', nowMs, KOI_ALLOWANCE_REFRESH_COOLDOWN_MS, KOI_ALLOWANCE_REFRESH_LEASE_MS))
      .toEqual({ kind: 'in_progress', retryAtMs: nowMs + 5_000 });
    expect(ownsKoiAllowanceRefresh({ refreshOwnerToken: 'owner-1' }, 'owner-2')).toBe(false);
  });
});
