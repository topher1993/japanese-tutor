import { describe, expect, it, vi } from 'vitest';

import {
  extractKoiWavBase64,
  prepareKoiCloudAudioSource,
} from '../src/features/koi-sensei/media/cloudVoiceAudio';

const WAV_BASE64 = 'UklGRgQAAABXQVZF';

describe('Koi cloud voice mobile playback', () => {
  it('extracts a valid Voicebox WAV data payload', () => {
    expect(extractKoiWavBase64(`data:audio/wav;base64,${WAV_BASE64}`)).toBe(WAV_BASE64);
  });

  it('materializes Voicebox data audio into a local WAV before playback', async () => {
    const deleteFile = vi.fn(async () => undefined);
    const writeBase64 = vi.fn(async () => undefined);

    const prepared = await prepareKoiCloudAudioSource(
      `data:audio/wav;base64,${WAV_BASE64}`,
      'assistant/message:42',
      { cacheDirectory: 'file:///cache/', deleteFile, writeBase64 },
    );

    expect(prepared).toEqual({
      uri: 'file:///cache/koi-voice-assistantmessage42.wav',
      temporaryUri: 'file:///cache/koi-voice-assistantmessage42.wav',
    });
    expect(deleteFile).toHaveBeenCalledWith(prepared.uri);
    expect(writeBase64).toHaveBeenCalledWith(prepared.uri, WAV_BASE64);
  });

  it('keeps supported HTTPS audio sources remote', async () => {
    const storage = {
      cacheDirectory: 'file:///cache/',
      deleteFile: vi.fn(async () => undefined),
      writeBase64: vi.fn(async () => undefined),
    };
    const prepared = await prepareKoiCloudAudioSource(
      'https://voice.example.test/koi.wav',
      'reply',
      storage,
    );

    expect(prepared).toEqual({ uri: 'https://voice.example.test/koi.wav', temporaryUri: null });
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(storage.writeBase64).not.toHaveBeenCalled();
  });

  it.each([
    'data:audio/mpeg;base64,UklGRgQAAABXQVZF',
    'data:audio/wav;base64,not_base64',
    'file:///private/untrusted.wav',
  ])('rejects an unsafe or malformed source: %s', async audioUrl => {
    await expect(prepareKoiCloudAudioSource(audioUrl, 'reply', {
      cacheDirectory: 'file:///cache/',
      deleteFile: vi.fn(async () => undefined),
      writeBase64: vi.fn(async () => undefined),
    })).rejects.toThrow();
  });
});
