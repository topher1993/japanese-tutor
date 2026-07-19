import { describe, expect, it, vi } from 'vitest';

import {
  KoiClientError,
  KOI_CALLABLE_NAMES,
  assertNoKoiClientSecrets,
  createKoiGateway,
  getKoiSystemVoiceText,
  resolveKoiPublicRuntimeConfig,
  type KoiCallableTransport,
  type KoiClientSession,
} from '../src/features/koi-sensei/api';

const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const CONVERSATION_ID = '223e4567-e89b-42d3-a456-426614174000';
const MESSAGE_ID = '323e4567-e89b-42d3-a456-426614174000';

function activeSession(overrides: Partial<KoiClientSession> = {}): KoiClientSession {
  return {
    authenticated: true,
    enrollmentStatus: 'active',
    ageBand: '18_plus',
    aiConsentVersion: 'ai-v1',
    privacyPolicyVersion: 'privacy-v1',
    usProcessingAcknowledged: true,
    consentedAtMs: 1,
    detailedProgressConsentVersion: 'progress-v1',
    ...overrides,
  };
}

function allowance() {
  return {
    schemaVersion: 1,
    grantedAtMs: 1,
    expiresAtMs: 100,
    chatLimit: 12,
    chatUsed: 1,
    voiceLimit: 4,
    voiceUsed: 0,
    capacityBand: 'high',
    usageMode: 'personal_unlimited',
  };
}

function answer() {
  return {
    schemaVersion: 1,
    requestId: REQUEST_ID,
    status: 'answered',
    assistantMessage: {
      id: MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      text: '「は」と「が」は、話題と焦点の違いを表します。',
      spokenText: 'は と が は、わだい と しょうてん の ちがい です。',
      expression: 'thinking',
      createdAtMs: 50,
    },
    citations: [{ sourceId: 'grammar.n5.wa-ga', title: 'N5 grammar: は and が' }],
    allowance: allowance(),
  };
}

describe('Koi mobile gateway boundary', () => {
  it('requires explicit approval for cloud memory writes and validates deletion', async () => {
    const invoke = vi.fn()
      .mockResolvedValueOnce({ schemaVersion: 1, requestId: REQUEST_ID, memoryId: MESSAGE_ID, stored: true, serverTimeMs: 10 })
      .mockResolvedValueOnce({ schemaVersion: 1, requestId: REQUEST_ID, memoryId: MESSAGE_ID, deleted: true, serverTimeMs: 11 });
    const gateway = createKoiGateway({ invoke } as KoiCallableTransport, () => activeSession());

    await gateway.upsertMemory({ requestId: REQUEST_ID, memoryId: MESSAGE_ID, category: 'goal', text: 'Practise は and が.' });
    await gateway.deleteMemory({ requestId: REQUEST_ID, memoryId: MESSAGE_ID });
    expect(invoke).toHaveBeenNthCalledWith(1, 'upsertKoiMemory', expect.objectContaining({ category: 'goal', text: 'Practise は and が.' }));
    expect(invoke).toHaveBeenNthCalledWith(2, 'deleteKoiMemory', { schemaVersion: 1, requestId: REQUEST_ID, memoryId: MESSAGE_ID });
  });

  it('syncs presentation-only pet state without sending progression or coins', async () => {
    const invoke = vi.fn(async () => ({ schemaVersion: 1, requestId: REQUEST_ID, acceptedRevision: 3, serverTimeMs: 12 }));
    const gateway = createKoiGateway({ invoke } as KoiCallableTransport, () => activeSession());
    await gateway.syncPetPresentation({
      requestId: REQUEST_ID,
      presentation: {
        revision: 3,
        avatarMode: '3d',
        effectPreference: 'reduced',
        equippedCosmeticIds: { crest: 'starter-crest' },
        selectedDojoThemeId: 'default',
      },
    });
    expect(invoke).toHaveBeenCalledWith('syncKoiPetPresentation', expect.objectContaining({
      presentation: expect.objectContaining({ revision: 3, equippedCosmeticIds: { crest: 'starter-crest' } }),
    }));
    expect(JSON.stringify(invoke.mock.calls[0])).not.toMatch(/coins|bond|progression|claims/i);
  });

  it('sends only the strict text payload and validates a grounded response', async () => {
    const invoke = vi.fn(async () => answer());
    const gateway = createKoiGateway({ invoke } as KoiCallableTransport, () => activeSession());
    const result = await gateway.ask({
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      text: '  What is the difference between は and が?  ',
    });

    expect(invoke).toHaveBeenCalledWith('askKoiSensei', {
      schemaVersion: 1,
      requestId: REQUEST_ID,
      conversationId: CONVERSATION_ID,
      text: 'What is the difference between は and が?',
    });
    expect(JSON.stringify(invoke.mock.calls[0])).not.toMatch(/audio|miniMax|apiKey/i);
    expect(result.citations[0].sourceId).toBe('grammar.n5.wa-ga');
  });

  it.each([
    [activeSession({ authenticated: false }), 'AUTH_REQUIRED'],
    [activeSession({ enrollmentStatus: 'waitlisted' }), 'BETA_WAITLISTED'],
    [activeSession({ ageBand: undefined }), 'AGE_RESTRICTED'],
    [activeSession({ aiConsentVersion: undefined }), 'CONSENT_REQUIRED'],
    [activeSession({ privacyPolicyVersion: undefined }), 'CONSENT_REQUIRED'],
    [activeSession({ usProcessingAcknowledged: false }), 'CONSENT_REQUIRED'],
    [activeSession({ consentedAtMs: undefined }), 'CONSENT_REQUIRED'],
  ] as const)('fails closed before a remote call when the session is ineligible', async (session, reason) => {
    const invoke = vi.fn();
    const gateway = createKoiGateway({ invoke } as KoiCallableTransport, () => session);
    await expect(gateway.ask({ requestId: REQUEST_ID, conversationId: CONVERSATION_ID, text: 'Help' }))
      .rejects.toMatchObject({ reason });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('requires separate, version-matched consent before sharing detailed progress', async () => {
    const invoke = vi.fn(async () => ({ schemaVersion: 1, accepted: true }));
    const gateway = createKoiGateway({ invoke } as KoiCallableTransport, () => (
      activeSession({ detailedProgressConsentVersion: undefined })
    ));
    await expect(gateway.syncLearningSummary({
      requestId: REQUEST_ID,
      context: {
        revision: 1,
        consentVersion: 'progress-v1',
        supportLanguage: 'en',
        dueCount: 2,
        streakDays: 3,
        completionCounts: {},
        weakTopicIds: [],
        masteryBuckets: {},
        recentActiveDays: 2,
      },
    })).rejects.toMatchObject({ reason: 'DETAILED_PROGRESS_CONSENT_REQUIRED' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('accepts the backend learning-summary acknowledgement envelope', async () => {
    const invoke = vi.fn(async (_name, payload: Readonly<Record<string, unknown>>) => ({
      schemaVersion: 1,
      requestId: payload.requestId,
      acceptedRevision: 7,
      serverTimeMs: 50,
    }));
    const gateway = createKoiGateway({ invoke } as KoiCallableTransport, () => activeSession());
    await expect(gateway.syncLearningSummary({
      requestId: REQUEST_ID,
      context: {
        revision: 7,
        consentVersion: 'progress-v1',
        supportLanguage: 'en',
        dueCount: 2,
        streakDays: 3,
        completionCounts: {},
        weakTopicIds: [],
        masteryBuckets: {},
        recentActiveDays: 2,
      },
    })).resolves.toBeUndefined();
  });

  it('accepts only short-lived HTTPS TTS references, never raw audio', async () => {
    const transport: KoiCallableTransport = {
      invoke: vi.fn(async () => ({
        schemaVersion: 1,
        requestId: REQUEST_ID,
        status: 'cloud_audio',
        audioUrl: 'https://storage.example.test/voice/one',
        expiresAtMs: 200,
        cached: false,
        dailyCharacterRemaining: 3_900,
        allowance: allowance(),
      })),
    };
    const gateway = createKoiGateway(transport, () => activeSession());
    await expect(gateway.synthesize({ requestId: REQUEST_ID, assistantMessageId: MESSAGE_ID }))
      .resolves.toMatchObject({
        status: 'cloud_audio',
        requestId: REQUEST_ID,
        audioUrl: 'https://storage.example.test/voice/one',
        dailyCharacterRemaining: 3_900,
      });
  });

  it('accepts the backend system-voice fallback as a safe voice result', async () => {
    const gateway = createKoiGateway({
      invoke: async () => ({
        schemaVersion: 1,
        requestId: REQUEST_ID,
        status: 'system_voice_fallback',
        reason: 'BUDGET_EXHAUSTED',
        spokenText: 'ã¯ marks the topic.',
        dailyCharacterRemaining: 0,
        allowance: allowance(),
      }),
    }, () => activeSession());
    await expect(gateway.synthesize({ requestId: REQUEST_ID, assistantMessageId: MESSAGE_ID }))
      .resolves.toEqual(expect.objectContaining({
        status: 'system_voice_fallback',
        reason: 'BUDGET_EXHAUSTED',
        spokenText: 'ã¯ marks the topic.',
        dailyCharacterRemaining: 0,
      }));
  });

  it('selects included system speech for backend fallback and cloud-player gaps', () => {
    const base = {
      requestId: REQUEST_ID,
      dailyCharacterRemaining: 0,
      allowance: {
        chatLimit: 12,
        chatUsed: 1,
        voiceLimit: 4,
        voiceUsed: 0,
        expiresAtMs: 100,
        capacityBand: 'high' as const,
        usageMode: 'personal_unlimited' as const,
      },
    };
    expect(getKoiSystemVoiceText({
      ...base,
      status: 'system_voice_fallback',
      reason: 'PROVIDER_UNAVAILABLE',
      spokenText: 'Server-approved system speech.',
    }, 'Assistant fallback.')).toBe('Server-approved system speech.');
    expect(getKoiSystemVoiceText({
      ...base,
      status: 'cloud_audio',
      audioUrl: 'https://storage.example.test/voice/one',
      expiresAtMs: 200,
      cached: false,
    }, 'Assistant fallback.')).toBe('Assistant fallback.');
  });

  it.each([
    [{ status: 'system_voice_fallback', reason: 'PAID_CREDITS', spokenText: 'unsafe' }],
    [{ status: 'system_voice_fallback', reason: 'PROVIDER_UNAVAILABLE', spokenText: 'x'.repeat(241) }],
    [{ status: 'system_voice_fallback', reason: 'PROVIDER_UNAVAILABLE', spokenText: 'safe', rawAudio: 'forbidden' }],
    [{ status: 'cloud_audio', audioUrl: 'http://insecure.test/voice', expiresAtMs: 200, cached: false }],
  ])('rejects malformed synthesis union variants', async (patch) => {
    const gateway = createKoiGateway({
      invoke: async () => ({
        schemaVersion: 1,
        requestId: REQUEST_ID,
        dailyCharacterRemaining: 1,
        allowance: allowance(),
        ...patch,
      }),
    }, () => activeSession());
    await expect(gateway.synthesize({ requestId: REQUEST_ID, assistantMessageId: MESSAGE_ID }))
      .rejects.toMatchObject({ reason: 'INVALID_RESPONSE' });
  });

  it('rejects malformed server messages instead of caching them', async () => {
    const gateway = createKoiGateway({ invoke: async () => ({ ...answer(), requestId: 'wrong' }) }, () => activeSession());
    await expect(gateway.ask({ requestId: REQUEST_ID, conversationId: CONVERSATION_ID, text: 'Help' }))
      .rejects.toBeInstanceOf(KoiClientError);
  });

  it('accepts server-verified quiz evidence and cosmetic unlocks', async () => {
    const gateway = createKoiGateway({
      invoke: async () => ({
        schemaVersion: 1,
        requestId: REQUEST_ID,
        correct: true,
        evidenceCount: 8,
        practiceStars: 8,
        masteryStars: 1,
        unlockedCosmeticIds: ['mastery-n5-grammar-reading-glasses'],
      }),
    }, () => activeSession());
    await expect(gateway.submitQuizAnswer({
      requestId: REQUEST_ID,
      questionId: 'n5-grammar-001',
      answer: 'B',
      domain: 'grammar',
      rank: 'N5',
    })).resolves.toEqual({
      correct: true,
      evidenceCount: 8,
      practiceStars: 8,
      masteryStars: 1,
      unlockedCosmeticIds: ['mastery-n5-grammar-reading-glasses'],
    });
  });

  it('uses the exact callable names exported by the backend', () => {
    expect(KOI_CALLABLE_NAMES).toContain('getKoiAllowance');
    expect(KOI_CALLABLE_NAMES).toContain('deleteKoiData');
    expect(KOI_CALLABLE_NAMES).not.toContain('getKoiBootstrap');
    expect(KOI_CALLABLE_NAMES).not.toContain('deleteKoiAccount');
  });
});

describe('Koi public runtime configuration', () => {
  it('defaults to a credential-free mock stage', () => {
    expect(resolveKoiPublicRuntimeConfig({})).toEqual({
      stage: 'mock',
      firebaseProjectId: undefined,
      functionsRegion: 'us-central1',
      useEmulators: false,
      functionsEmulatorOrigin: undefined,
      workerUrl: undefined,
    });
  });

  it('requires a project outside mock and prohibits production emulators', () => {
    expect(() => resolveKoiPublicRuntimeConfig({ EXPO_PUBLIC_KOI_STAGE: 'staging' }))
      .toThrow(/project id/i);
    expect(() => resolveKoiPublicRuntimeConfig({
      EXPO_PUBLIC_KOI_STAGE: 'production',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'japanese-tutor-prod',
      EXPO_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_ORIGIN: 'http://127.0.0.1:5001',
    })).toThrow(/production/i);
  });

  it('detects a MiniMax or Token Plan secret embedded in an Expo public variable', () => {
    expect(() => assertNoKoiClientSecrets({ EXPO_PUBLIC_MINIMAX_API_KEY: 'do-not-bundle' }))
      .toThrow(/never/i);
  });
});
