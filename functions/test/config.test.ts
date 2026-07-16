import { describe, expect, it } from 'vitest';

import {
  KOI_MINIMAX_MESSAGES_URL,
  KOI_MINIMAX_REMAINS_URL,
  KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT,
  KOI_MINIMAX_TTS_URL,
  loadKoiBackendConfig,
} from '../src/config.js';

describe('Koi backend configuration', () => {
  it('defaults to an emulator-safe deterministic mock', () => {
    const config = loadKoiBackendConfig({});
    expect(config.providerMode).toBe('mock');
    expect(config.deployEnvironment).toBe('development');
    expect(config.activeAccountLimit).toBe(50);
    expect(config.providerConcurrencyLimit).toBe(2);
    expect(config.ttsDailyCharacterLimit).toBe(KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT);
  });

  it('pins only documented Token Plan endpoints', () => {
    expect(KOI_MINIMAX_REMAINS_URL).toBe('https://www.minimax.io/v1/token_plan/remains');
    expect(KOI_MINIMAX_MESSAGES_URL).toBe('https://api.minimax.io/anthropic/v1/messages');
    expect(KOI_MINIMAX_TTS_URL).toBe('https://api.minimax.io/v1/t2a_v2');
  });

  it('refuses a mock provider in production', () => {
    expect(() => loadKoiBackendConfig({ KOI_DEPLOY_ENV: 'production' })).toThrow(/cannot run with the mock/i);
  });

  it('refuses any staging cloud configuration without the Firebase billing-risk acknowledgement', () => {
    expect(() => loadKoiBackendConfig({ KOI_DEPLOY_ENV: 'staging' })).toThrow(/Blaze/i);
  });

  it('refuses live mode until every external cost and licensing gate is acknowledged', () => {
    expect(() => loadKoiBackendConfig({ KOI_PROVIDER_MODE: 'live' })).toThrow(/multi-user/i);
    expect(() => loadKoiBackendConfig({
      KOI_PROVIDER_MODE: 'live',
      KOI_MINIMAX_MULTI_USER_APPROVED: 'true',
    })).toThrow(/Credits/i);
    expect(() => loadKoiBackendConfig({
      KOI_PROVIDER_MODE: 'live',
      KOI_MINIMAX_MULTI_USER_APPROVED: 'true',
      KOI_MINIMAX_NO_CREDITS_ATTACHED_ATTESTED: 'true',
    })).toThrow(/Blaze/i);
  });

  it('permits live mode only with all three explicit acknowledgements', () => {
    const config = loadKoiBackendConfig({
      KOI_DEPLOY_ENV: 'staging',
      KOI_PROVIDER_MODE: 'live',
      KOI_MINIMAX_MULTI_USER_APPROVED: 'true',
      KOI_MINIMAX_NO_CREDITS_ATTACHED_ATTESTED: 'true',
      KOI_FIREBASE_BILLING_RISK_APPROVED: 'true',
    });
    expect(config.providerMode).toBe('live');
  });

  it.each(['MINIMAX_API_KEY', 'MINIMAX_PAYGO_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'])(
    'rejects billable/fallback credential variable %s',
    (name) => {
      expect(() => loadKoiBackendConfig({ [name]: 'never-store-this' })).toThrow(/forbidden/i);
    },
  );

  it('does not allow account or concurrency limits to be raised', () => {
    expect(() => loadKoiBackendConfig({ KOI_ACTIVE_ACCOUNT_LIMIT: '51' })).toThrow(/fixed at 50/i);
    expect(() => loadKoiBackendConfig({ KOI_PROVIDER_MAX_CONCURRENCY: '3' })).toThrow(/fixed at 2/i);
  });
});
