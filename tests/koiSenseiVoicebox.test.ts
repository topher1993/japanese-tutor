import { describe, expect, it, vi } from 'vitest';

import {
  isKoiVoiceboxConfigured,
  resolveKoiVoiceboxLanguage,
  synthesizeKoiVoiceboxReply,
} from '../cloudflare/koi-worker/src/voicebox';

const configured = {
  KOI_VOICEBOX_ENABLED: 'true',
  VOICEBOX_BASE_URL: 'https://voicebox.example.test',
  VOICEBOX_PROFILE_ID: 'koi-profile',
  VOICEBOX_ACCESS_CLIENT_ID: 'access-id',
  VOICEBOX_ACCESS_CLIENT_SECRET: 'access-secret',
};

describe('Koi self-hosted Voicebox bridge', () => {
  it('fails closed without HTTPS and both Cloudflare Access credentials', () => {
    expect(isKoiVoiceboxConfigured(configured)).toBe(true);
    expect(isKoiVoiceboxConfigured({ ...configured, VOICEBOX_BASE_URL: 'http://192.168.1.2:17493' })).toBe(false);
    expect(isKoiVoiceboxConfigured({ ...configured, VOICEBOX_ACCESS_CLIENT_SECRET: '' })).toBe(false);
    expect(isKoiVoiceboxConfigured({ ...configured, KOI_VOICEBOX_ENABLED: 'false' })).toBe(false);
  });

  it('supports a free ngrok hostname protected by gateway Basic Auth', async () => {
    const ngrokConfigured = {
      KOI_VOICEBOX_ENABLED: 'true',
      VOICEBOX_BASE_URL: 'https://assigned-name.ngrok-free.app',
      VOICEBOX_PROFILE_ID: 'koi-profile',
      VOICEBOX_AUTH_MODE: 'basic',
      VOICEBOX_BASIC_USERNAME: 'koi-worker',
      VOICEBOX_BASIC_PASSWORD: 'safe-password-123',
    };
    expect(isKoiVoiceboxConfigured(ngrokConfigured)).toBe(true);
    expect(isKoiVoiceboxConfigured({ ...ngrokConfigured, VOICEBOX_BASIC_PASSWORD: 'short' })).toBe(false);
    expect(isKoiVoiceboxConfigured({ ...ngrokConfigured, VOICEBOX_BASIC_USERNAME: 'bad:name' })).toBe(false);

    const fetcher = vi.fn(async () => new Response(Uint8Array.from([82, 73, 70, 70]), {
      headers: { 'content-type': 'audio/wav' },
    }));
    await synthesizeKoiVoiceboxReply(ngrokConfigured, 'hello', fetcher as typeof fetch);
    const [, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.headers).toMatchObject({
      authorization: 'Basic a29pLXdvcmtlcjpzYWZlLXBhc3N3b3JkLTEyMw==',
    });
  });

  it('uses neutral English as the primary language for mixed tutor replies', () => {
    expect(resolveKoiVoiceboxLanguage('猫 means cat.')).toBe('en');
    expect(resolveKoiVoiceboxLanguage('猫です。')).toBe('ja');
  });

  it('streams a Qwen CustomVoice WAV without creating Voicebox history', async () => {
    const fetcher = vi.fn(async () => new Response(Uint8Array.from([82, 73, 70, 70]), {
      status: 200,
      headers: { 'content-type': 'audio/wav' },
    }));
    const result = await synthesizeKoiVoiceboxReply(configured, '猫 means cat.', fetcher as typeof fetch);

    expect(result).toEqual({
      audioDataUrl: 'data:audio/wav;base64,UklGRg==',
      byteLength: 4,
      language: 'en',
    });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe('https://voicebox.example.test/generate/stream');
    expect(init.headers).toMatchObject({
      'CF-Access-Client-Id': 'access-id',
      'CF-Access-Client-Secret': 'access-secret',
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      profile_id: 'koi-profile',
      language: 'en',
      engine: 'qwen_custom_voice',
      model_size: '0.6B',
    });
  });

  it('falls back safely for non-audio, oversized, or unavailable responses', async () => {
    await expect(synthesizeKoiVoiceboxReply(
      configured,
      'hello',
      vi.fn(async () => new Response('{}', { headers: { 'content-type': 'application/json' } })) as typeof fetch,
    )).resolves.toBeNull();
    await expect(synthesizeKoiVoiceboxReply(
      configured,
      'hello',
      vi.fn(async () => { throw new Error('offline'); }) as typeof fetch,
    )).resolves.toBeNull();
  });
});
