import { describe, expect, it, vi } from 'vitest';

import { createExpoKoiDeviceSttAdapter } from '../src/features/koi-sensei/media/expoDeviceStt';

interface ListenerMap {
  result?: (event: {
    isFinal: boolean;
    results: Array<{ transcript: string; confidence: number }>;
    rawAudio?: string;
  }) => void;
  error?: (event: { error: string; message: string }) => void;
  end?: () => void;
}

function fakeModule(permission: 'granted' | 'denied' = 'granted') {
  const listeners: ListenerMap = {};
  const module = {
    isRecognitionAvailable: () => true,
    supportsOnDeviceRecognition: () => true,
    getPermissionsAsync: async () => ({ status: permission, granted: permission === 'granted' }),
    requestPermissionsAsync: async () => ({ status: permission, granted: permission === 'granted' }),
    getSupportedLocales: async () => ({ locales: ['ja-JP', 'en-US'], installedLocales: ['ja-JP'] }),
    addListener: vi.fn((name: keyof ListenerMap, listener: NonNullable<ListenerMap[typeof name]>) => {
      listeners[name] = listener as never;
      return { remove: vi.fn() };
    }),
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  };
  return { module, listeners };
}

describe('Expo on-device Koi speech adapter', () => {
  it('requires an installed on-device recognizer and exposes transcript-only capabilities', async () => {
    const fake = fakeModule();
    const adapter = createExpoKoiDeviceSttAdapter({
      loadModule: async () => ({ ExpoSpeechRecognitionModule: fake.module as never }),
    });
    await expect(adapter.getAvailability()).resolves.toEqual({
      available: true,
      permission: 'granted',
      capabilities: {
        engine: 'device-stt',
        output: 'transcript-only',
        rawAudioRetention: false,
        supportsPartialResults: true,
        supportedLocales: ['ja-JP'],
      },
    });
  });

  it('starts strict local recognition with audio persistence disabled', async () => {
    const fake = fakeModule();
    const transcripts: unknown[] = [];
    const ends: unknown[] = [];
    const adapter = createExpoKoiDeviceSttAdapter({
      loadModule: async () => ({ ExpoSpeechRecognitionModule: fake.module as never }),
      now: () => 123,
    });
    const session = await adapter.start({ locale: 'ja-JP', partialResults: true, maxDurationMs: 5_000 }, value => {
      transcripts.push(value);
    }, () => undefined, event => {
      ends.push(event);
    });

    expect(fake.module.start).toHaveBeenCalledWith(expect.objectContaining({
      lang: 'ja-JP',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: true,
      recordingOptions: { persist: false },
    }));
    expect(fake.module.start.mock.calls[0][0]).not.toHaveProperty('audioSource');

    fake.listeners.result?.({
      isFinal: true,
      results: [{ transcript: '  日本語を勉強します  ', confidence: 0.9 }],
      rawAudio: 'must-not-escape',
    });
    expect(transcripts).toEqual([{
      schemaVersion: 1,
      source: 'device-stt',
      transcript: '日本語を勉強します',
      locale: 'ja-JP',
      isFinal: true,
      confidence: 0.9,
      capturedAt: 123,
      persistence: 'transcript-only',
    }]);
    expect(JSON.stringify(transcripts)).not.toContain('must-not-escape');
    expect(ends).toEqual([{ reason: 'completed', endedAt: 123 }]);
    expect(fake.module.stop).toHaveBeenCalledTimes(1);

    await session.stop();
    fake.listeners.end?.();
    expect(ends).toHaveLength(1);
    await session.cancel();
    expect(fake.module.abort).not.toHaveBeenCalled();
  });

  it('ends exactly once for silence, native errors, explicit stop, and cancel', async () => {
    const fake = fakeModule();
    const adapter = createExpoKoiDeviceSttAdapter({
      loadModule: async () => ({ ExpoSpeechRecognitionModule: fake.module as never }),
      now: () => 456,
    });

    const silenceEnds = vi.fn();
    await adapter.start(
      { locale: 'ja-JP', partialResults: true, maxDurationMs: 5_000 },
      () => undefined,
      () => undefined,
      silenceEnds,
    );
    fake.listeners.end?.();
    fake.listeners.end?.();
    expect(silenceEnds).toHaveBeenCalledOnce();
    expect(silenceEnds).toHaveBeenCalledWith({ reason: 'completed', endedAt: 456 });

    const errors = vi.fn();
    const errorEnds = vi.fn();
    await adapter.start(
      { locale: 'ja-JP', partialResults: true, maxDurationMs: 5_000 },
      () => undefined,
      errors,
      errorEnds,
    );
    fake.listeners.error?.({ error: 'no-speech', message: 'No speech detected.' });
    fake.listeners.end?.();
    expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: 'No speech detected.' }));
    expect(errorEnds).toHaveBeenCalledOnce();
    expect(errorEnds).toHaveBeenCalledWith({ reason: 'error', endedAt: 456 });

    const stopEnds = vi.fn();
    const stopped = await adapter.start(
      { locale: 'ja-JP', partialResults: true, maxDurationMs: 5_000 },
      () => undefined,
      () => undefined,
      stopEnds,
    );
    await stopped.stop();
    fake.listeners.end?.();
    expect(stopEnds).toHaveBeenCalledOnce();
    expect(stopEnds).toHaveBeenCalledWith({ reason: 'stopped', endedAt: 456 });

    const cancelEnds = vi.fn();
    const cancelled = await adapter.start(
      { locale: 'ja-JP', partialResults: true, maxDurationMs: 5_000 },
      () => undefined,
      () => undefined,
      cancelEnds,
    );
    await cancelled.cancel();
    fake.listeners.end?.();
    expect(cancelEnds).toHaveBeenCalledOnce();
    expect(cancelEnds).toHaveBeenCalledWith({ reason: 'cancelled', endedAt: 456 });
    expect(fake.module.abort).toHaveBeenCalledTimes(1);
  });

  it('reports timeout even when the native stop emits a later end event', async () => {
    vi.useFakeTimers();
    try {
      const fake = fakeModule();
      const ends = vi.fn();
      const adapter = createExpoKoiDeviceSttAdapter({
        loadModule: async () => ({ ExpoSpeechRecognitionModule: fake.module as never }),
        now: () => 789,
      });
      await adapter.start(
        { locale: 'ja-JP', partialResults: true, maxDurationMs: 1_000 },
        () => undefined,
        () => undefined,
        ends,
      );

      await vi.advanceTimersByTimeAsync(1_000);
      fake.listeners.end?.();
      expect(fake.module.stop).toHaveBeenCalledTimes(1);
      expect(ends).toHaveBeenCalledOnce();
      expect(ends).toHaveBeenCalledWith({ reason: 'timeout', endedAt: 789 });
    } finally {
      vi.useRealTimers();
    }
  });

  it('settles a final-result race that fires synchronously during native start', async () => {
    const fake = fakeModule();
    const ends = vi.fn();
    fake.module.start.mockImplementation(() => {
      fake.listeners.result?.({
        isFinal: true,
        results: [{ transcript: 'ã™ãã«çµ‚ã‚ã‚Šã¾ã™', confidence: 1 }],
      });
      fake.listeners.end?.();
    });
    const adapter = createExpoKoiDeviceSttAdapter({
      loadModule: async () => ({ ExpoSpeechRecognitionModule: fake.module as never }),
      now: () => 900,
    });

    const session = await adapter.start(
      { locale: 'ja-JP', partialResults: true, maxDurationMs: 5_000 },
      () => undefined,
      () => undefined,
      ends,
    );
    await session.cancel();
    expect(ends).toHaveBeenCalledOnce();
    expect(ends).toHaveBeenCalledWith({ reason: 'completed', endedAt: 900 });
    expect(fake.module.stop).toHaveBeenCalledOnce();
    expect(fake.module.abort).not.toHaveBeenCalled();
  });

  it('refuses to start when permission is denied', async () => {
    const fake = fakeModule('denied');
    const adapter = createExpoKoiDeviceSttAdapter({
      loadModule: async () => ({ ExpoSpeechRecognitionModule: fake.module as never }),
    });
    await expect(adapter.start(
      { locale: 'ja-JP', partialResults: false, maxDurationMs: 1_000 },
      () => undefined,
      () => undefined,
      () => undefined,
    ))
      .rejects.toThrow(/permission/i);
    expect(fake.module.start).not.toHaveBeenCalled();
  });
});
