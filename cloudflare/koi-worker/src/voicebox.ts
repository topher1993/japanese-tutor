export const KOI_VOICEBOX_MAX_AUDIO_BYTES = 8 * 1_024 * 1_024;
// A cold Qwen CustomVoice load can take just over 45 seconds on the supported
// CPU-only local host. Keep a bounded buffer so the first reply does not
// silently fall back while still preventing a stuck upstream request.
export const KOI_VOICEBOX_TIMEOUT_MS = 60_000;

export interface KoiVoiceboxEnv {
  KOI_VOICEBOX_ENABLED?: string;
  VOICEBOX_BASE_URL?: string;
  VOICEBOX_PROFILE_ID?: string;
  VOICEBOX_ENGINE?: string;
  VOICEBOX_MODEL_SIZE?: string;
  VOICEBOX_INSTRUCT?: string;
  VOICEBOX_AUTH_MODE?: string;
  VOICEBOX_ACCESS_CLIENT_ID?: string;
  VOICEBOX_ACCESS_CLIENT_SECRET?: string;
  VOICEBOX_BASIC_USERNAME?: string;
  VOICEBOX_BASIC_PASSWORD?: string;
}

export interface KoiVoiceboxSynthesis {
  audioDataUrl: string;
  byteLength: number;
  language: 'en' | 'ja';
}

const VOICEBOX_ENGINES = new Set([
  'qwen',
  'qwen_custom_voice',
  'luxtts',
  'chatterbox',
  'chatterbox_turbo',
  'tada',
  'kokoro',
]);

const VOICEBOX_MODEL_SIZES = new Set(['0.6B', '1.7B', '1B', '3B']);
const KOI_DEFAULT_VOICE_INSTRUCTION = [
  'Speak as Koi, a warm and youthful magical tanuki Japanese tutor.',
  'Sound calm, playful, encouraging, and confident without sounding childish.',
  'Use a neutral natural English accent for English words and authentic Japanese pronunciation for Japanese words.',
  'Keep the pacing conversational and clear for a language learner.',
].join(' ');

function voiceboxBaseUrl(value: string | undefined): URL | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    url.pathname = url.pathname.replace(/\/+$/u, '');
    return url;
  } catch {
    return null;
  }
}

export function isKoiVoiceboxConfigured(env: KoiVoiceboxEnv): boolean {
  return env.KOI_VOICEBOX_ENABLED === 'true'
    && voiceboxBaseUrl(env.VOICEBOX_BASE_URL) !== null
    && Boolean(env.VOICEBOX_PROFILE_ID?.trim())
    && voiceboxAuthHeaders(env) !== null;
}

function asciiCredential(value: string | undefined, minimumLength: number): string | null {
  const credential = value?.trim();
  if (!credential || credential.length < minimumLength || credential.length > 128) return null;
  return /^[\x21-\x7e]+$/u.test(credential) ? credential : null;
}

function voiceboxAuthHeaders(env: KoiVoiceboxEnv): Record<string, string> | null {
  const mode = env.VOICEBOX_AUTH_MODE?.trim() || 'cloudflare-access';
  if (mode === 'cloudflare-access') {
    const clientId = env.VOICEBOX_ACCESS_CLIENT_ID?.trim();
    const clientSecret = env.VOICEBOX_ACCESS_CLIENT_SECRET?.trim();
    return clientId && clientSecret
      ? { 'CF-Access-Client-Id': clientId, 'CF-Access-Client-Secret': clientSecret }
      : null;
  }
  if (mode === 'basic') {
    const username = asciiCredential(env.VOICEBOX_BASIC_USERNAME, 1);
    const password = asciiCredential(env.VOICEBOX_BASIC_PASSWORD, 8);
    if (!username || username.includes(':') || !password) return null;
    return { authorization: `Basic ${btoa(`${username}:${password}`)}` };
  }
  return null;
}

/**
 * Voicebox requires one primary language per generation. Mixed tutor replies
 * use English as the primary language so explanations never inherit a
 * Japanese accent; Qwen still preserves the embedded Japanese examples.
 */
export function resolveKoiVoiceboxLanguage(text: string): 'en' | 'ja' {
  return /[A-Za-z\u00c0-\u024f]/u.test(text) ? 'en' : 'ja';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function synthesizeKoiVoiceboxReply(
  env: KoiVoiceboxEnv,
  spokenText: string,
  fetcher: typeof fetch = fetch,
): Promise<KoiVoiceboxSynthesis | null> {
  const baseUrl = voiceboxBaseUrl(env.VOICEBOX_BASE_URL);
  const profileId = env.VOICEBOX_PROFILE_ID?.trim();
  const authHeaders = voiceboxAuthHeaders(env);
  const text = [...spokenText.trim()].slice(0, 240).join('');
  if (!isKoiVoiceboxConfigured(env) || !baseUrl || !profileId || !authHeaders || !text) return null;

  const engine = VOICEBOX_ENGINES.has(env.VOICEBOX_ENGINE ?? '')
    ? env.VOICEBOX_ENGINE!
    : 'qwen_custom_voice';
  const modelSize = VOICEBOX_MODEL_SIZES.has(env.VOICEBOX_MODEL_SIZE ?? '')
    ? env.VOICEBOX_MODEL_SIZE!
    : '0.6B';
  const language = resolveKoiVoiceboxLanguage(text);
  const endpoint = new URL(baseUrl);
  endpoint.pathname = `${baseUrl.pathname.replace(/\/+$/u, '')}/generate/stream`;

  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: {
        accept: 'audio/wav',
        'content-type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        text,
        profile_id: profileId,
        language,
        engine,
        model_size: modelSize,
        instruct: env.VOICEBOX_INSTRUCT?.trim().slice(0, 500) || KOI_DEFAULT_VOICE_INSTRUCTION,
        normalize: true,
        max_chunk_chars: 800,
        crossfade_ms: 50,
      }),
      signal: AbortSignal.timeout(KOI_VOICEBOX_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'audio/wav' && contentType !== 'audio/x-wav') return null;
    const declaredLength = Number(response.headers.get('content-length') ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > KOI_VOICEBOX_MAX_AUDIO_BYTES) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > KOI_VOICEBOX_MAX_AUDIO_BYTES) return null;
    return {
      audioDataUrl: `data:audio/wav;base64,${bytesToBase64(bytes)}`,
      byteLength: bytes.byteLength,
      language,
    };
  } catch {
    return null;
  }
}
