import { describe, expect, it } from 'vitest';

import {
  KoiClientError,
  createKoiGateway,
  createKoiMockTransport,
  createKoiUnconfiguredLiveTransport,
  createKoiUuid,
} from '../src/features/koi-sensei/api';
import {
  KOI_CURRENT_AI_POLICY_VERSION,
  KOI_CURRENT_PRIVACY_POLICY_VERSION,
  KOI_SENSEI_STORAGE_KEYS,
  askAndPersistKoi,
  createKoiEligibilityRecord,
  createKoiSenseiRepository,
  evaluateKoiEligibility,
  type KoiCachedChatMessageV1,
  type KoiEligibilityRecordV1,
} from '../src/features/koi-sensei/data';
import { createInMemoryKeyValueStorage } from '../src/services/keyValueStorage';

const NOW = 1_000_000;
const UUIDS = [
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',
] as const;

describe('Koi versioned age and consent eligibility', () => {
  it('persists only a coarse age range and current explicit consent versions', async () => {
    const storage = createInMemoryKeyValueStorage();
    const repository = createKoiSenseiRepository(storage, { now: () => NOW });
    const record = {
      ...createKoiEligibilityRecord({
        ageBand: '18_plus',
        aiDataConsent: true,
        usProcessingAcknowledged: true,
      }, NOW),
      birthdate: '1990-01-01',
      legalName: 'must not persist',
    } as KoiEligibilityRecordV1;

    await repository.saveEligibility(record);
    expect((await repository.load()).eligibility).toEqual({
      schemaVersion: 1,
      ageBand: '18_plus',
      aiPolicyVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      aiDataConsent: true,
      usProcessingAcknowledged: true,
      consentedAt: NOW,
    });
    const raw = await storage.getItem(KOI_SENSEI_STORAGE_KEYS.localState);
    expect(raw).not.toContain('birthdate');
    expect(raw).not.toContain('1990-01-01');
    expect(raw).not.toContain('legalName');
  });

  it('gates missing, under-16, incomplete, and stale consent', () => {
    const eligible = createKoiEligibilityRecord({
      ageBand: '16_17',
      aiDataConsent: true,
      usProcessingAcknowledged: true,
    }, NOW);
    expect(evaluateKoiEligibility(null)).toMatchObject({ eligible: false, reason: 'missing' });
    expect(evaluateKoiEligibility(createKoiEligibilityRecord({
      ageBand: 'under16',
      aiDataConsent: true,
      usProcessingAcknowledged: true,
    }, NOW))).toEqual({ eligible: false, reason: 'under16', ageBand: 'under16' });
    expect(evaluateKoiEligibility({ ...eligible, aiDataConsent: false, consentedAt: null }))
      .toMatchObject({ eligible: false, reason: 'consent_required' });
    expect(evaluateKoiEligibility({ ...eligible, privacyPolicyVersion: 'old-policy' }))
      .toMatchObject({ eligible: false, reason: 'policy_stale' });
    expect(evaluateKoiEligibility(eligible)).toEqual({ eligible: true, reason: 'eligible', ageBand: '16_17' });
  });

  it('clears chat and detailed-progress permission when consent is revoked or age is under 16', async () => {
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), { now: () => NOW });
    const message: KoiCachedChatMessageV1 = {
      schemaVersion: 1,
      id: UUIDS[0],
      conversationId: UUIDS[1],
      role: 'user',
      text: 'Japanese grammar',
      sourceIds: [],
      createdAt: NOW,
    };
    await repository.saveEligibility(createKoiEligibilityRecord({
      ageBand: '18_plus',
      aiDataConsent: true,
      usProcessingAcknowledged: true,
    }, NOW));
    await repository.savePreferences({ detailedProgressConsent: true });
    await repository.saveDraft('private draft');
    await repository.appendMessage(message);
    await repository.revokeEligibility();
    expect(await repository.load()).toMatchObject({
      eligibility: null,
      draft: '',
      messages: [],
      preferences: { detailedProgressConsent: false },
    });

    await repository.appendMessage(message);
    await repository.saveEligibility(createKoiEligibilityRecord({
      ageBand: 'under16',
      aiDataConsent: true,
      usProcessingAcknowledged: true,
    }, NOW));
    expect(await repository.load()).toMatchObject({
      eligibility: {
        ageBand: 'under16',
        aiDataConsent: false,
        usProcessingAcknowledged: false,
        consentedAt: null,
      },
      messages: [],
    });
  });
});

describe('Koi local mock chat integration', () => {
  it('answers at zero network cost and atomically persists validated messages and citation ids', async () => {
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), { now: () => NOW });
    const gateway = createKoiGateway(createKoiMockTransport({ now: () => NOW }), () => ({
      authenticated: true,
      enrollmentStatus: 'active',
      ageBand: '18_plus',
      aiConsentVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      usProcessingAcknowledged: true,
      consentedAtMs: NOW,
    }));
    let index = 0;
    const result = await askAndPersistKoi({
      repository,
      gateway,
      now: () => NOW,
      createId: () => UUIDS[index++]!,
    }, '  What is the difference between wa and ga?  ');

    expect(result.answer.status).toBe('answered');
    expect(result.answer.allowance).toMatchObject({ chatLimit: 12, chatUsed: 1 });
    const messages = (await repository.load()).messages;
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', text: 'What is the difference between wa and ga?' });
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      sourceIds: ['mock.grammar.n5.wa-ga'],
      expression: 'thinking',
    });
    expect(messages[1].spokenText).toBeTruthy();
    expect(JSON.stringify(messages)).not.toMatch(/api.?key|rawAudio|birthdate/i);
  });

  it('does not cache an unvalidated assistant response', async () => {
    const repository = createKoiSenseiRepository(createInMemoryKeyValueStorage(), { now: () => NOW });
    const gateway = createKoiGateway({
      invoke: async () => ({ schemaVersion: 1, requestId: 'wrong', status: 'answered' }),
    }, () => ({
      authenticated: true,
      enrollmentStatus: 'active',
      ageBand: '18_plus',
      aiConsentVersion: KOI_CURRENT_AI_POLICY_VERSION,
      privacyPolicyVersion: KOI_CURRENT_PRIVACY_POLICY_VERSION,
      usProcessingAcknowledged: true,
      consentedAtMs: NOW,
    }));
    let index = 0;
    await expect(askAndPersistKoi({
      repository,
      gateway,
      now: () => NOW,
      createId: () => UUIDS[index++]!,
    }, 'Japanese grammar')).rejects.toBeInstanceOf(KoiClientError);
    expect((await repository.load()).messages).toEqual([]);
  });

  it('keeps live mobile transport unconfigured and fail-closed', async () => {
    await expect(createKoiUnconfiguredLiveTransport().invoke('askKoiSensei', {}))
      .rejects.toMatchObject({ reason: 'LIVE_BACKEND_NOT_CONFIGURED' });
  });
});

describe('Koi dependency-free UUID generation', () => {
  it('creates unique UUID v4 values accepted by the gateway contract', () => {
    const ids = Array.from({ length: 500 }, () => createKoiUuid());
    expect(new Set(ids)).toHaveLength(ids.length);
    expect(ids.every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)))
      .toBe(true);
  });
});
