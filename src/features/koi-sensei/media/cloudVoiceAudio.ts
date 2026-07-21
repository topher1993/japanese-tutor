const KOI_WAV_DATA_URL_PREFIX = 'data:audio/wav;base64,';
const KOI_MAX_CLOUD_AUDIO_BYTES = 12 * 1024 * 1024;

export type KoiCloudAudioStorage = {
  cacheDirectory: string | null;
  writeBase64: (uri: string, base64: string) => Promise<void>;
  deleteFile: (uri: string) => Promise<void>;
};

export type PreparedKoiCloudAudio = {
  uri: string;
  temporaryUri: string | null;
};

function estimatedBase64Bytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function safeCacheKey(messageId: string): string {
  const normalized = messageId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return normalized || 'reply';
}

export function extractKoiWavBase64(audioUrl: string): string | null {
  if (!audioUrl.startsWith(KOI_WAV_DATA_URL_PREFIX)) return null;
  const base64 = audioUrl.slice(KOI_WAV_DATA_URL_PREFIX.length);
  if (
    base64.length === 0
    || base64.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
    || estimatedBase64Bytes(base64) > KOI_MAX_CLOUD_AUDIO_BYTES
  ) {
    throw new Error('Koi voice returned an invalid WAV payload.');
  }
  return base64;
}

export async function prepareKoiCloudAudioSource(
  audioUrl: string,
  messageId: string,
  storage: KoiCloudAudioStorage,
): Promise<PreparedKoiCloudAudio> {
  const base64 = extractKoiWavBase64(audioUrl);
  if (base64 === null) {
    if (!audioUrl.startsWith('https://')) {
      throw new Error('Koi voice returned an unsupported audio URL.');
    }
    return { uri: audioUrl, temporaryUri: null };
  }

  if (!storage.cacheDirectory) {
    throw new Error('Koi voice cache is unavailable on this device.');
  }

  const separator = storage.cacheDirectory.endsWith('/') ? '' : '/';
  const temporaryUri = `${storage.cacheDirectory}${separator}koi-voice-${safeCacheKey(messageId)}.wav`;
  await storage.deleteFile(temporaryUri);
  await storage.writeBase64(temporaryUri, base64);
  return { uri: temporaryUri, temporaryUri };
}
