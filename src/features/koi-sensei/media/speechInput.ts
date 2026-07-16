export const KOI_MAX_SPEECH_TRANSCRIPT_LENGTH = 2_000;
export const KOI_DEFAULT_SPEECH_INPUT_LOCALE = 'ja-JP';

export type KoiSpeechPermissionState = 'granted' | 'denied' | 'undetermined';

export interface KoiDeviceSttCapabilities {
  engine: 'device-stt';
  output: 'transcript-only';
  rawAudioRetention: false;
  supportsPartialResults: boolean;
  supportedLocales: readonly string[];
}

export interface KoiDeviceSttAvailability {
  available: boolean;
  permission: KoiSpeechPermissionState;
  reason?: 'unsupported' | 'permission-denied' | 'temporarily-unavailable';
  capabilities: KoiDeviceSttCapabilities;
}

export interface KoiSpeechInputOptions {
  locale: string;
  partialResults: boolean;
  maxDurationMs: number;
}

export interface KoiSpeechTranscriptV1 {
  schemaVersion: 1;
  source: 'device-stt';
  transcript: string;
  locale: string;
  isFinal: boolean;
  confidence?: number;
  capturedAt: number;
  persistence: 'transcript-only';
}

export type KoiSpeechInputEndReason =
  | 'completed'
  | 'timeout'
  | 'stopped'
  | 'cancelled'
  | 'error';

export interface KoiSpeechInputEndEvent {
  reason: KoiSpeechInputEndReason;
  endedAt: number;
}

export interface KoiDeviceSttSession {
  stop(): Promise<void>;
  cancel(): Promise<void>;
}

/**
 * Platform-specific implementations may use Android/iOS recognition APIs, but
 * they must emit transcripts only. The contract intentionally has no callback
 * or return slot for recorded audio.
 */
export interface KoiDeviceSttAdapter {
  getAvailability(): Promise<KoiDeviceSttAvailability>;
  requestPermission(): Promise<KoiSpeechPermissionState>;
  start(
    options: KoiSpeechInputOptions,
    onTranscript: (transcript: KoiSpeechTranscriptV1) => void,
    onError: (error: Error) => void,
    onEnd: (event: KoiSpeechInputEndEvent) => void,
  ): Promise<KoiDeviceSttSession>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeLocale(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return /^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(normalized) ? normalized : fallback;
}

function normalizeTimestamp(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : fallback;
}

/**
 * Converts an untrusted native recognition event to the only speech shape Koi
 * is allowed to persist. Unknown properties (including rawAudio/base64/URI)
 * are deliberately discarded rather than spread into the result.
 */
export function toKoiSpeechTranscript(
  value: unknown,
  options: {
    now?: number;
    fallbackLocale?: string;
  } = {},
): KoiSpeechTranscriptV1 | null {
  if (!isRecord(value) || typeof value.transcript !== 'string') return null;
  const transcript = value.transcript.trim().slice(0, KOI_MAX_SPEECH_TRANSCRIPT_LENGTH);
  if (!transcript) return null;

  const now = options.now ?? Date.now();
  const confidence = typeof value.confidence === 'number' && Number.isFinite(value.confidence)
    ? Math.min(1, Math.max(0, value.confidence))
    : undefined;

  return {
    schemaVersion: 1,
    source: 'device-stt',
    transcript,
    locale: normalizeLocale(
      value.locale,
      options.fallbackLocale ?? KOI_DEFAULT_SPEECH_INPUT_LOCALE,
    ),
    isFinal: value.isFinal !== false,
    ...(confidence === undefined ? {} : { confidence }),
    capturedAt: normalizeTimestamp(value.capturedAt, now),
    persistence: 'transcript-only',
  };
}

const UNAVAILABLE_CAPABILITIES: KoiDeviceSttCapabilities = Object.freeze({
  engine: 'device-stt',
  output: 'transcript-only',
  rawAudioRetention: false,
  supportsPartialResults: false,
  supportedLocales: Object.freeze([]),
});

/** Safe default for web/dev builds before a native STT implementation exists. */
export function createUnavailableKoiDeviceSttAdapter(): KoiDeviceSttAdapter {
  return {
    async getAvailability() {
      return {
        available: false,
        permission: 'undetermined',
        reason: 'unsupported',
        capabilities: UNAVAILABLE_CAPABILITIES,
      };
    },
    async requestPermission() {
      return 'undetermined';
    },
    async start() {
      throw new Error('Device speech recognition is unavailable.');
    },
  };
}
