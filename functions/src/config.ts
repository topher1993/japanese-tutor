export const KOI_ACTIVE_ACCOUNT_LIMIT = 50 as const;
export const KOI_PROVIDER_CONCURRENCY_LIMIT = 2 as const;
export const KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT = 4_000 as const;
export const KOI_CALLABLE_TIMEOUT_MS = 60_000 as const;
export const KOI_PROVIDER_CAPACITY_CACHE_TTL_MS = 30_000 as const;
export const KOI_PROVIDER_CAPACITY_REFRESH_LEASE_MS = 15_000 as const;
export const KOI_ALLOWANCE_REFRESH_COOLDOWN_MS = 10_000 as const;
export const KOI_ALLOWANCE_REFRESH_LEASE_MS = 15_000 as const;
export const KOI_MINIMAX_MODEL = 'MiniMax-M2.7' as const;
export const KOI_MINIMAX_REMAINS_URL = 'https://www.minimax.io/v1/token_plan/remains' as const;
export const KOI_MINIMAX_MESSAGES_URL = 'https://api.minimax.io/anthropic/v1/messages' as const;
export const KOI_MINIMAX_TTS_URL = 'https://api.minimax.io/v1/t2a_v2' as const;
export const KOI_MINIMAX_TTS_MODEL = 'speech-2.8-hd' as const;
export const KOI_MINIMAX_TTS_VOICE = 'Japanese_KindLady' as const;

export type KoiDeployEnvironment = 'development' | 'staging' | 'production';
export type KoiProviderMode = 'mock' | 'live';

export interface KoiBackendConfig {
  deployEnvironment: KoiDeployEnvironment;
  providerMode: KoiProviderMode;
  region: 'us-central1';
  activeAccountLimit: typeof KOI_ACTIVE_ACCOUNT_LIMIT;
  providerConcurrencyLimit: typeof KOI_PROVIDER_CONCURRENCY_LIMIT;
  ttsDailyCharacterLimit: typeof KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT;
  minimaxModel: typeof KOI_MINIMAX_MODEL;
  minimaxRemainsUrl: typeof KOI_MINIMAX_REMAINS_URL;
  minimaxMessagesUrl: typeof KOI_MINIMAX_MESSAGES_URL;
  minimaxTtsUrl: typeof KOI_MINIMAX_TTS_URL;
  minimaxTtsModel: typeof KOI_MINIMAX_TTS_MODEL;
  minimaxTtsVoice: typeof KOI_MINIMAX_TTS_VOICE;
  mockRemainingPercent: number;
  multiUserUseApproved: boolean;
  noCreditsAttachedAttested: boolean;
  firebaseBillingRiskApproved: boolean;
}

const FORBIDDEN_BILLABLE_KEY_NAMES = [
  'MINIMAX_API_KEY',
  'MINIMAX_API_TOKEN',
  'MINIMAX_GROUP_ID',
  'MINIMAX_PAYGO_KEY',
  'MINIMAX_STANDARD_API_KEY',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
] as const;

const readEnum = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T,
  name: string,
): T => {
  if (value === undefined || value.trim() === '') return fallback;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
};

const readFixedInteger = (
  value: string | undefined,
  expected: number,
  name: string,
): void => {
  if (value === undefined || value.trim() === '') return;
  if (Number(value) !== expected) {
    throw new Error(`${name} is fixed at ${expected}; overrides are not allowed`);
  }
};

const readPercent = (value: string | undefined): number => {
  if (value === undefined || value.trim() === '') return 100;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error('KOI_MOCK_REMAINING_PERCENT must be between 0 and 100');
  }
  return parsed;
};

const isTrue = (value: string | undefined): boolean => value === 'true';

export function loadKoiBackendConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): KoiBackendConfig {
  for (const name of FORBIDDEN_BILLABLE_KEY_NAMES) {
    if (env[name]?.trim()) {
      throw new Error(
        `${name} is forbidden. Koi Sensei only accepts MINIMAX_TOKEN_PLAN_KEY through Firebase Secret Manager.`,
      );
    }
  }

  readFixedInteger(env.KOI_ACTIVE_ACCOUNT_LIMIT, KOI_ACTIVE_ACCOUNT_LIMIT, 'KOI_ACTIVE_ACCOUNT_LIMIT');
  readFixedInteger(
    env.KOI_PROVIDER_MAX_CONCURRENCY,
    KOI_PROVIDER_CONCURRENCY_LIMIT,
    'KOI_PROVIDER_MAX_CONCURRENCY',
  );

  if (env.KOI_MINIMAX_MODEL && env.KOI_MINIMAX_MODEL !== KOI_MINIMAX_MODEL) {
    throw new Error(`KOI_MINIMAX_MODEL is pinned to ${KOI_MINIMAX_MODEL}`);
  }

  const deployEnvironment = readEnum(
    env.KOI_DEPLOY_ENV,
    ['development', 'staging', 'production'] as const,
    'development',
    'KOI_DEPLOY_ENV',
  );
  const providerMode = readEnum(
    env.KOI_PROVIDER_MODE,
    ['mock', 'live'] as const,
    'mock',
    'KOI_PROVIDER_MODE',
  );
  const multiUserUseApproved = isTrue(env.KOI_MINIMAX_MULTI_USER_APPROVED);
  const noCreditsAttachedAttested = isTrue(env.KOI_MINIMAX_NO_CREDITS_ATTACHED_ATTESTED);
  const firebaseBillingRiskApproved = isTrue(env.KOI_FIREBASE_BILLING_RISK_APPROVED);

  if (deployEnvironment === 'production' && providerMode !== 'live') {
    throw new Error('Production cannot run with the mock Koi provider');
  }
  if (deployEnvironment !== 'development' && !firebaseBillingRiskApproved) {
    throw new Error('Staging/production Firebase Functions are disabled until the owner accepts that Blaze billing has no hard cost cap');
  }
  if (providerMode === 'live' && !multiUserUseApproved) {
    throw new Error('Live MiniMax access is disabled until multi-user use is approved in writing');
  }
  if (providerMode === 'live' && !noCreditsAttachedAttested) {
    throw new Error('Live MiniMax access is disabled until the Subscription Key is confirmed unable to consume Credits');
  }
  if (providerMode === 'live' && !firebaseBillingRiskApproved) {
    throw new Error('Live Firebase Functions are disabled until the owner accepts that Blaze billing has no hard cost cap');
  }

  return Object.freeze({
    deployEnvironment,
    providerMode,
    region: 'us-central1',
    activeAccountLimit: KOI_ACTIVE_ACCOUNT_LIMIT,
    providerConcurrencyLimit: KOI_PROVIDER_CONCURRENCY_LIMIT,
    ttsDailyCharacterLimit: KOI_MINIMAX_TTS_DAILY_CHARACTER_LIMIT,
    minimaxModel: KOI_MINIMAX_MODEL,
    minimaxRemainsUrl: KOI_MINIMAX_REMAINS_URL,
    minimaxMessagesUrl: KOI_MINIMAX_MESSAGES_URL,
    minimaxTtsUrl: KOI_MINIMAX_TTS_URL,
    minimaxTtsModel: KOI_MINIMAX_TTS_MODEL,
    minimaxTtsVoice: KOI_MINIMAX_TTS_VOICE,
    mockRemainingPercent: readPercent(env.KOI_MOCK_REMAINING_PERCENT),
    multiUserUseApproved,
    noCreditsAttachedAttested,
    firebaseBillingRiskApproved,
  });
}
