export const KOI_TTS_COVERAGE_MAX_AGE_MS = 5 * 60 * 1_000;
/** Current Plus Token Plan Speech 2.8 included allowance; server remains authoritative. */
export const KOI_MINIMAX_TTS_INCLUDED_DAILY_CHARACTERS = 4_000;
/** Matches the existing persisted spokenText ceiling and limits one user from draining the pool. */
export const KOI_MAX_TTS_TEXT_LENGTH = 240;

export interface KoiMiniMaxTtsCoverageAttestation {
  source: 'trusted-server';
  usageMode: 'yearly-token-plan';
  modelFamily: 'speech-2.8';
  ttsCoverage: 'included' | 'not-included' | 'unknown';
  billingFallback: 'disabled';
  quotaAvailable: boolean;
  budgetScope: 'subscription-global';
  dailyCharacterLimit: number;
  remainingCharacters: number;
  checkedAt: number;
  expiresAt: number;
}

export interface KoiIncludedSystemVoiceAvailability {
  available: boolean;
  includedWithPlatform: boolean;
}

export interface KoiTtsPolicyInput {
  playbackEnabled: boolean;
  networkAvailable: boolean;
  systemVoice: KoiIncludedSystemVoiceAvailability;
  miniMax?: KoiMiniMaxTtsCoverageAttestation | null;
  /** Count of the already-truncated text that the server must atomically reserve. */
  requestedCharacters: number;
  now?: number;
}

export type KoiTtsRouteReason =
  | 'playback-disabled'
  | 'minimax-explicitly-covered'
  | 'minimax-not-explicitly-covered'
  | 'minimax-attestation-stale'
  | 'minimax-quota-unavailable'
  | 'minimax-character-budget-insufficient'
  | 'network-unavailable'
  | 'included-system-fallback'
  | 'no-cost-free-voice-available';

export interface KoiTtsRoute {
  engine: 'minimax-subscription' | 'system-included' | 'silent';
  reason: KoiTtsRouteReason;
  mayUsePaidCredits: false;
  rawAudioPersistence: 'prohibited';
  credentialLocation: 'server-only' | 'not-required';
  requestedCharacters: number;
  serverCharacterReservation: 'required' | 'not-required';
}

function hasValidAttestationWindow(
  attestation: KoiMiniMaxTtsCoverageAttestation,
  now: number,
): boolean {
  return Number.isSafeInteger(attestation.checkedAt)
    && Number.isSafeInteger(attestation.expiresAt)
    && attestation.checkedAt <= now
    && now - attestation.checkedAt <= KOI_TTS_COVERAGE_MAX_AGE_MS
    && attestation.expiresAt >= now;
}

function hasEnoughSubscriptionCharacters(
  attestation: KoiMiniMaxTtsCoverageAttestation,
  requestedCharacters: number,
): boolean {
  return attestation.budgetScope === 'subscription-global'
    && Number.isSafeInteger(attestation.dailyCharacterLimit)
    && attestation.dailyCharacterLimit === KOI_MINIMAX_TTS_INCLUDED_DAILY_CHARACTERS
    && Number.isSafeInteger(attestation.remainingCharacters)
    && attestation.remainingCharacters >= 0
    && attestation.remainingCharacters <= attestation.dailyCharacterLimit
    && Number.isSafeInteger(requestedCharacters)
    && requestedCharacters > 0
    && requestedCharacters <= KOI_MAX_TTS_TEXT_LENGTH
    && requestedCharacters <= attestation.remainingCharacters;
}

function systemFallbackReason(
  input: KoiTtsPolicyInput,
  now: number,
): KoiTtsRouteReason {
  if (!input.networkAvailable && input.miniMax) return 'network-unavailable';
  if (!input.miniMax
    || input.miniMax.source !== 'trusted-server'
    || input.miniMax.usageMode !== 'yearly-token-plan'
    || input.miniMax.modelFamily !== 'speech-2.8'
    || input.miniMax.ttsCoverage !== 'included'
    || input.miniMax.billingFallback !== 'disabled') {
    return 'minimax-not-explicitly-covered';
  }
  if (!hasValidAttestationWindow(input.miniMax, now)) return 'minimax-attestation-stale';
  if (!input.miniMax.quotaAvailable) return 'minimax-quota-unavailable';
  if (!hasEnoughSubscriptionCharacters(input.miniMax, input.requestedCharacters)) {
    return 'minimax-character-budget-insufficient';
  }
  return 'included-system-fallback';
}

/**
 * Selects a zero-additional-cost voice route. MiniMax is eligible only when a
 * trusted server freshly attests that TTS is included in the yearly token plan,
 * paid fallback is disabled, quota remains, and the device is online.
 */
export function selectKoiTtsRoute(input: KoiTtsPolicyInput): KoiTtsRoute {
  const requestedCharacters = Number.isSafeInteger(input.requestedCharacters)
    ? Math.max(0, input.requestedCharacters)
    : 0;
  if (!input.playbackEnabled) {
    return {
      engine: 'silent',
      reason: 'playback-disabled',
      mayUsePaidCredits: false,
      rawAudioPersistence: 'prohibited',
      credentialLocation: 'not-required',
      requestedCharacters,
      serverCharacterReservation: 'not-required',
    };
  }

  const now = input.now ?? Date.now();
  const miniMaxEligible = input.networkAvailable
    && input.miniMax?.source === 'trusted-server'
    && input.miniMax.usageMode === 'yearly-token-plan'
    && input.miniMax.modelFamily === 'speech-2.8'
    && input.miniMax.ttsCoverage === 'included'
    && input.miniMax.billingFallback === 'disabled'
    && input.miniMax.quotaAvailable
    && hasValidAttestationWindow(input.miniMax, now)
    && hasEnoughSubscriptionCharacters(input.miniMax, requestedCharacters);

  if (miniMaxEligible) {
    return {
      engine: 'minimax-subscription',
      reason: 'minimax-explicitly-covered',
      mayUsePaidCredits: false,
      rawAudioPersistence: 'prohibited',
      credentialLocation: 'server-only',
      requestedCharacters,
      serverCharacterReservation: 'required',
    };
  }

  if (input.systemVoice.available && input.systemVoice.includedWithPlatform) {
    return {
      engine: 'system-included',
      reason: systemFallbackReason(input, now),
      mayUsePaidCredits: false,
      rawAudioPersistence: 'prohibited',
      credentialLocation: 'not-required',
      requestedCharacters,
      serverCharacterReservation: 'not-required',
    };
  }

  return {
    engine: 'silent',
    reason: 'no-cost-free-voice-available',
    mayUsePaidCredits: false,
    rawAudioPersistence: 'prohibited',
    credentialLocation: 'not-required',
    requestedCharacters,
    serverCharacterReservation: 'not-required',
  };
}

export interface KoiTtsPlaybackRequest {
  text: string;
  locale: string;
  transport: 'server-text-only' | 'device-text-only';
  responseHandling: 'ephemeral-playback-only';
  persistRawAudio: false;
  characterCount: number;
}

function normalizeKoiTtsText(textValue: string): string {
  return [...textValue.trim()].slice(0, KOI_MAX_TTS_TEXT_LENGTH).join('');
}

export function getKoiTtsCharacterCount(textValue: string): number {
  return [...normalizeKoiTtsText(textValue)].length;
}

/** Builds a text-only request; credentials and persisted audio are impossible. */
export function createKoiTtsPlaybackRequest(
  route: KoiTtsRoute,
  textValue: string,
  localeValue = 'ja-JP',
): KoiTtsPlaybackRequest | null {
  if (route.engine === 'silent') return null;
  const text = normalizeKoiTtsText(textValue);
  if (!text) return null;
  const characterCount = getKoiTtsCharacterCount(text);
  if (route.engine === 'minimax-subscription'
    && route.requestedCharacters !== characterCount) return null;
  const locale = /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(localeValue) ? localeValue : 'ja-JP';
  return {
    text,
    locale,
    transport: route.engine === 'minimax-subscription'
      ? 'server-text-only'
      : 'device-text-only',
    responseHandling: 'ephemeral-playback-only',
    persistRawAudio: false,
    characterCount,
  };
}
