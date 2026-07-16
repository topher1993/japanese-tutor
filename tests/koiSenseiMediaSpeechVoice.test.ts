import { describe, expect, it } from 'vitest';
import {
  KOI_MAX_SPEECH_TRANSCRIPT_LENGTH,
  KOI_MAX_TTS_TEXT_LENGTH,
  KOI_MINIMAX_TTS_INCLUDED_DAILY_CHARACTERS,
  KOI_TTS_COVERAGE_MAX_AGE_MS,
  auditKoiMediaPersistence,
  createKoiTtsPlaybackRequest,
  createUnavailableKoiDeviceSttAdapter,
  getKoiTtsCharacterCount,
  selectKoiTtsRoute,
  toKoiSpeechTranscript,
  type KoiMiniMaxTtsCoverageAttestation,
} from '../src/features/koi-sensei/media';

const NOW = 2_000_000;

function coveredAttestation(
  patch: Partial<KoiMiniMaxTtsCoverageAttestation> = {},
): KoiMiniMaxTtsCoverageAttestation {
  return {
    source: 'trusted-server',
    usageMode: 'yearly-token-plan',
    modelFamily: 'speech-2.8',
    ttsCoverage: 'included',
    billingFallback: 'disabled',
    quotaAvailable: true,
    budgetScope: 'subscription-global',
    dailyCharacterLimit: KOI_MINIMAX_TTS_INCLUDED_DAILY_CHARACTERS,
    remainingCharacters: KOI_MINIMAX_TTS_INCLUDED_DAILY_CHARACTERS,
    checkedAt: NOW - 1_000,
    expiresAt: NOW + 60_000,
    ...patch,
  };
}

const includedSystemVoice = { available: true, includedWithPlatform: true } as const;

describe('Koi Sensei device speech input contract', () => {
  it('exposes a transcript-only unavailable adapter until a native adapter is installed', async () => {
    const adapter = createUnavailableKoiDeviceSttAdapter();
    const availability = await adapter.getAvailability();
    expect(availability).toEqual({
      available: false,
      permission: 'undetermined',
      reason: 'unsupported',
      capabilities: {
        engine: 'device-stt',
        output: 'transcript-only',
        rawAudioRetention: false,
        supportsPartialResults: false,
        supportedLocales: [],
      },
    });
    await expect(adapter.start(
      { locale: 'ja-JP', partialResults: true, maxDurationMs: 20_000 },
      () => undefined,
      () => undefined,
      () => undefined,
    )).rejects.toThrow('unavailable');
  });

  it('whitelists recognition fields and discards raw audio from untrusted native events', () => {
    const event = {
      transcript: `  ${'a'.repeat(KOI_MAX_SPEECH_TRANSCRIPT_LENGTH + 20)}  `,
      locale: 'ja-JP',
      isFinal: false,
      confidence: 1.4,
      capturedAt: NOW,
      rawAudio: new Uint8Array([1, 2, 3]),
      recordingUri: 'file:///private/audio.m4a',
      providerSecret: 'must-not-copy-unknown-fields',
    };
    const transcript = toKoiSpeechTranscript(event, { now: NOW });
    expect(transcript).toEqual({
      schemaVersion: 1,
      source: 'device-stt',
      transcript: 'a'.repeat(KOI_MAX_SPEECH_TRANSCRIPT_LENGTH),
      locale: 'ja-JP',
      isFinal: false,
      confidence: 1,
      capturedAt: NOW,
      persistence: 'transcript-only',
    });
    expect(auditKoiMediaPersistence(transcript).safe).toBe(true);
    expect(JSON.stringify(transcript)).not.toContain('rawAudio');
    expect(JSON.stringify(transcript)).not.toContain('recordingUri');
    expect(JSON.stringify(transcript)).not.toContain('providerSecret');
  });

  it('rejects empty events and safely normalizes locale, confidence, and timestamp', () => {
    expect(toKoiSpeechTranscript({ transcript: '   ' }, { now: NOW })).toBeNull();
    expect(toKoiSpeechTranscript({ transcript: 'ã“ã‚“ã«ã¡ã¯', locale: '../../bad', confidence: -3 }, { now: NOW }))
      .toMatchObject({ locale: 'ja-JP', confidence: 0, capturedAt: NOW, isFinal: true });
  });
});

describe('Koi Sensei raw-audio persistence guard', () => {
  it('detects nested audio fields and binary payloads while allowing transcript metadata', () => {
    const unsafe = auditKoiMediaPersistence({
      message: { text: 'hello', recordingUri: 'file:///recording.m4a' },
      nested: [{ payload: new Uint8Array([1, 2]) }],
    });
    expect(unsafe.safe).toBe(false);
    expect(unsafe.violations).toEqual([
      '$.message.recordingUri:raw-audio-field',
      '$.nested[0].payload:binary-payload',
    ]);
    expect(auditKoiMediaPersistence({
      transcript: 'hello',
      spokenText: 'hello',
      voicePlaybackEnabled: true,
    })).toEqual({ safe: true, violations: [] });
  });

  it('handles cyclic values without recursing forever', () => {
    const cyclic: Record<string, unknown> = { text: 'safe' };
    cyclic.self = cyclic;
    expect(auditKoiMediaPersistence(cyclic)).toEqual({ safe: true, violations: [] });
  });
});

describe('Koi Sensei zero-additional-cost TTS routing', () => {
  it('uses MiniMax only with a fresh explicit yearly-plan coverage attestation', () => {
    expect(selectKoiTtsRoute({
      playbackEnabled: true,
      networkAvailable: true,
      systemVoice: includedSystemVoice,
      miniMax: coveredAttestation(),
      requestedCharacters: 5,
      now: NOW,
    })).toEqual({
      engine: 'minimax-subscription',
      reason: 'minimax-explicitly-covered',
      mayUsePaidCredits: false,
      rawAudioPersistence: 'prohibited',
      credentialLocation: 'server-only',
      requestedCharacters: 5,
      serverCharacterReservation: 'required',
    });
  });

  it.each([
    ['missing attestation', null, true, 'minimax-not-explicitly-covered'],
    ['unknown coverage', coveredAttestation({ ttsCoverage: 'unknown' }), true, 'minimax-not-explicitly-covered'],
    ['not included', coveredAttestation({ ttsCoverage: 'not-included' }), true, 'minimax-not-explicitly-covered'],
    ['stale attestation', coveredAttestation({ checkedAt: NOW - KOI_TTS_COVERAGE_MAX_AGE_MS - 1 }), true, 'minimax-attestation-stale'],
    ['expired attestation', coveredAttestation({ expiresAt: NOW - 1 }), true, 'minimax-attestation-stale'],
    ['quota unavailable', coveredAttestation({ quotaAvailable: false }), true, 'minimax-quota-unavailable'],
    ['insufficient global character budget', coveredAttestation({ remainingCharacters: 4 }), true, 'minimax-character-budget-insufficient'],
    ['offline', coveredAttestation(), false, 'network-unavailable'],
  ] as const)('falls back to the included system voice for %s', (_label, miniMax, networkAvailable, reason) => {
    expect(selectKoiTtsRoute({
      playbackEnabled: true,
      networkAvailable,
      systemVoice: includedSystemVoice,
      miniMax,
      requestedCharacters: 5,
      now: NOW,
    })).toMatchObject({
      engine: 'system-included',
      reason,
      mayUsePaidCredits: false,
      rawAudioPersistence: 'prohibited',
    });
  });

  it('stays silent rather than selecting a paid or non-included fallback', () => {
    expect(selectKoiTtsRoute({
      playbackEnabled: true,
      networkAvailable: true,
      systemVoice: { available: true, includedWithPlatform: false },
      miniMax: coveredAttestation({ ttsCoverage: 'unknown' }),
      requestedCharacters: 5,
      now: NOW,
    })).toMatchObject({
      engine: 'silent',
      reason: 'no-cost-free-voice-available',
      mayUsePaidCredits: false,
    });
    expect(selectKoiTtsRoute({
      playbackEnabled: false,
      networkAvailable: true,
      systemVoice: includedSystemVoice,
      miniMax: coveredAttestation(),
      requestedCharacters: 5,
      now: NOW,
    })).toMatchObject({ engine: 'silent', reason: 'playback-disabled' });
  });

  it('creates only text-only, ephemeral playback requests with no credential field', () => {
    const miniMaxRoute = selectKoiTtsRoute({
      playbackEnabled: true,
      networkAvailable: true,
      systemVoice: includedSystemVoice,
      miniMax: coveredAttestation(),
      requestedCharacters: 5,
      now: NOW,
    });
    const request = createKoiTtsPlaybackRequest(miniMaxRoute, '  hello  ', 'invalid');
    expect(request).toEqual({
      text: 'hello',
      locale: 'ja-JP',
      transport: 'server-text-only',
      responseHandling: 'ephemeral-playback-only',
      persistRawAudio: false,
      characterCount: 5,
    });
    expect(auditKoiMediaPersistence(request)).toEqual({ safe: true, violations: [] });
    expect(JSON.stringify(request)).not.toMatch(/key|secret|credential/iu);
  });

  it('caps one utterance at 240 characters and makes the global reservation explicit', () => {
    const text = 'x'.repeat(KOI_MAX_TTS_TEXT_LENGTH + 50);
    expect(getKoiTtsCharacterCount(text)).toBe(KOI_MAX_TTS_TEXT_LENGTH);
    const route = selectKoiTtsRoute({
      playbackEnabled: true,
      networkAvailable: true,
      systemVoice: includedSystemVoice,
      miniMax: coveredAttestation({ remainingCharacters: KOI_MAX_TTS_TEXT_LENGTH }),
      requestedCharacters: getKoiTtsCharacterCount(text),
      now: NOW,
    });
    expect(route).toMatchObject({
      engine: 'minimax-subscription',
      requestedCharacters: KOI_MAX_TTS_TEXT_LENGTH,
      serverCharacterReservation: 'required',
    });
    expect(createKoiTtsPlaybackRequest(route, text)?.characterCount).toBe(KOI_MAX_TTS_TEXT_LENGTH);
    expect(createKoiTtsPlaybackRequest(route, 'different request')).toBeNull();
  });
});
