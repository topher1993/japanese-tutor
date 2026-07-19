import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
  KOI_CALLABLE_NAMES,
  createKoiGateway,
  reconcileKoiAuthSnapshot,
  resolveKoiFirebaseLiveConfig,
  resolveKoiPublicRuntimeConfig,
  type KoiCallableName,
} from '../src/features/koi-sensei/api';

const requestId = '00000000-0000-4000-a000-000000000001';

function liveEnvironment() {
  return {
    EXPO_PUBLIC_KOI_STAGE: 'staging',
    EXPO_PUBLIC_FIREBASE_API_KEY: 'public-client-key',
    EXPO_PUBLIC_FIREBASE_APP_ID: '1:123:web:abc',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'koi-staging.firebaseapp.com',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'koi-staging',
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'koi-staging.firebasestorage.app',
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123',
    EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY: 'public-recaptcha-site-key',
    EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION: 'asia-northeast1',
    EXPO_PUBLIC_KOI_EMAIL_LINK_URL: 'https://koi-staging.example.com/auth/finish',
  };
}

describe('Koi Firebase live client configuration', () => {
  it('preserves enrollment when Firebase refreshes the same signed-in user', () => {
    const active = {
      authenticated: true,
      emailVerified: true,
      enrollmentStatus: 'active' as const,
    };

    expect(reconcileKoiAuthSnapshot(active, 'user-1', {
      uid: 'user-1',
      emailVerified: true,
    })).toEqual(active);
    expect(reconcileKoiAuthSnapshot(active, 'user-1', {
      uid: 'user-2',
      emailVerified: true,
    })).toMatchObject({ enrollmentStatus: 'not_registered' });
    expect(reconcileKoiAuthSnapshot(active, 'user-1', null)).toEqual({
      authenticated: false,
      emailVerified: false,
      enrollmentStatus: 'not_registered',
    });
  });

  it('keeps mock mode credential-free and validates complete staging configuration', () => {
    expect(resolveKoiFirebaseLiveConfig({}, resolveKoiPublicRuntimeConfig({}))).toBeNull();
    const environment = liveEnvironment();
    expect(resolveKoiFirebaseLiveConfig(
      environment,
      resolveKoiPublicRuntimeConfig(environment),
    )).toMatchObject({
      stage: 'staging',
      projectId: 'koi-staging',
      region: 'asia-northeast1',
      emailLinkUrl: 'https://koi-staging.example.com/auth/finish',
    });
  });

  it('keeps Android App Check optional until enforcement and rejects unsafe production links', () => {
    const environment = liveEnvironment();
    expect(resolveKoiFirebaseLiveConfig(
      { ...environment, EXPO_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY: '' },
      resolveKoiPublicRuntimeConfig(environment),
    )).toMatchObject({ appCheckRequired: false });
    const production = {
      ...environment,
      EXPO_PUBLIC_KOI_STAGE: 'production',
      EXPO_PUBLIC_KOI_EMAIL_LINK_URL: 'http://localhost/auth',
    };
    expect(() => resolveKoiFirebaseLiveConfig(
      production,
      resolveKoiPublicRuntimeConfig(production),
    )).toThrow(/HTTPS/);
  });

  it('uses limited-use App Check tokens and exposes email-link/admission UI', () => {
    const provider = readFileSync('src/app/AppProviders.tsx', 'utf8');
    const liveClient = readFileSync('src/features/koi-sensei/api/firebaseLiveClient.ts', 'utf8');
    const context = readFileSync('src/features/koi-sensei/KoiSenseiContext.tsx', 'utf8');
    const chat = readFileSync('src/features/koi-sensei/ui/KoiChatPanel.tsx', 'utf8');
    expect(provider).toContain('runtimeStage={koiRuntimeConfig.stage}');
    expect(provider).toContain('liveConfig={koiFirebaseLiveConfig}');
    expect(liveClient).toContain('limitedUseAppCheckTokens: true');
    expect(liveClient).toContain('appCheckModule.getToken(appCheck)');
    expect(liveClient).toContain('config.appCheckRequired && !appCheckToken');
    expect(liveClient).toContain("'X-Firebase-AppCheck': appCheckToken");
    expect(liveClient).toContain("name === 'synthesizeKoiReply'");
    expect(liveClient).toContain("name === 'submitQuizAnswer' ? 'koi/quiz/submit'");
    expect(liveClient).toContain("android: { provider: 'playIntegrity' }");
    expect(liveClient).toContain("apple: { provider: 'appAttestWithDeviceCheckFallback' }");
    expect(context).toContain('createKoiFirebaseLiveClient(liveConfig)');
    expect(chat).toContain('testID="koi-live-email-send"');
    expect(chat).toContain('testID="koi-live-registration-retry"');
  });
});

describe('Koi registration, allowance bootstrap, and revocation gateway', () => {
  it('uses the exact server contracts before online chat becomes active', async () => {
    expect(KOI_CALLABLE_NAMES).toContain('revokeKoiConsent');
    const invoked: KoiCallableName[] = [];
    const transport = {
      invoke: vi.fn(async (name: KoiCallableName, payload: Readonly<Record<string, unknown>>) => {
        invoked.push(name);
        if (name === 'completeKoiRegistration') return {
          schemaVersion: 1,
          status: 'active',
          activeAccountLimit: 50,
          aiPolicyVersion: payload.aiPolicyVersion,
          privacyPolicyVersion: payload.privacyPolicyVersion,
          consentedAtMs: 100,
          serverTimeMs: 101,
        };
        if (name === 'getKoiAllowance') return {
          schemaVersion: 1,
          requestId: payload.requestId,
          allowance: {
            schemaVersion: 1,
            grantedAtMs: 100,
            expiresAtMs: 1_000,
            chatLimit: 12,
            chatUsed: 0,
            voiceLimit: 4,
            voiceUsed: 0,
            capacityBand: 'high',
          },
          serverTimeMs: 102,
        };
        if (name === 'revokeKoiConsent') return {
          schemaVersion: 1,
          requestId: payload.requestId,
          revoked: true,
          serverTimeMs: 103,
        };
        throw new Error(`Unexpected callable ${name}`);
      }),
    };
    const gateway = createKoiGateway(transport, () => ({
      authenticated: true,
      enrollmentStatus: 'not_registered',
    }));
    await expect(gateway.completeRegistration({
      requestId,
      ageBand: '18_plus',
      aiPolicyVersion: 'koi-ai-data-2026-07-16',
      privacyPolicyVersion: 'koi-privacy-2026-07-16',
      supportLanguage: 'en',
    })).resolves.toMatchObject({ status: 'active', activeAccountLimit: 50 });
    await expect(gateway.getAllowance(requestId)).resolves.toMatchObject({ chatLimit: 12, voiceLimit: 4 });
    await expect(gateway.revokeConsent(requestId)).resolves.toBeUndefined();
    expect(invoked).toEqual(['completeKoiRegistration', 'getKoiAllowance', 'revokeKoiConsent']);
  });
});
