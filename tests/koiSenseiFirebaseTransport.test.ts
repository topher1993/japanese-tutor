import { describe, expect, it, vi } from 'vitest';

import {
  KoiClientError,
  createKoiFirebaseCallableTransport,
  koiFirebaseCallableUrlForTest,
} from '../src/features/koi-sensei/api';

const payload = { schemaVersion: 1, requestId: '00000000-0000-4000-a000-000000000001' };

describe('Koi Firebase callable transport', () => {
  it('builds exact production and emulator callable URLs', () => {
    expect(koiFirebaseCallableUrlForTest({
      projectId: 'koi-prod',
      region: 'asia-northeast1',
    }, 'getKoiAllowance')).toBe(
      'https://asia-northeast1-koi-prod.cloudfunctions.net/getKoiAllowance',
    );
    expect(koiFirebaseCallableUrlForTest({
      projectId: 'demo-koi',
      region: 'us-central1',
      emulatorOrigin: 'http://127.0.0.1:5001',
    }, 'askKoiSensei')).toBe(
      'http://127.0.0.1:5001/demo-koi/us-central1/askKoiSensei',
    );
  });

  it('sends fresh auth and App Check tokens through headers only', async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: 'Bearer firebase-id-token',
        'X-Firebase-AppCheck': 'app-check-token',
      });
      expect(init?.body).toBe(JSON.stringify({ data: payload }));
      return new Response(JSON.stringify({ result: { ok: true } }), { status: 200 });
    });
    const transport = createKoiFirebaseCallableTransport({
      projectId: 'koi-prod',
      region: 'asia-northeast1',
    }, {
      getIdToken: async () => 'firebase-id-token',
      getAppCheckToken: async () => 'app-check-token',
    }, fetchImpl as typeof fetch);
    await expect(transport.invoke('getKoiAllowance', payload)).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('fails closed without production App Check but permits a local emulator omission', async () => {
    const tokens = {
      getIdToken: async () => 'firebase-id-token',
      getAppCheckToken: async () => null,
    };
    const production = createKoiFirebaseCallableTransport({
      projectId: 'koi-prod',
      region: 'us-central1',
    }, tokens, vi.fn() as unknown as typeof fetch);
    await expect(production.invoke('getKoiAllowance', payload)).rejects.toMatchObject({
      reason: 'APP_CHECK_FAILED',
    });

    const emulatorFetch = vi.fn(async () => new Response(JSON.stringify({ result: { ok: true } })));
    const emulator = createKoiFirebaseCallableTransport({
      projectId: 'demo-koi',
      region: 'us-central1',
      emulatorOrigin: 'http://127.0.0.1:5001',
    }, tokens, emulatorFetch as typeof fetch);
    await expect(emulator.invoke('getKoiAllowance', payload)).resolves.toEqual({ ok: true });
  });

  it('maps callable error details without exposing either token', async () => {
    const transport = createKoiFirebaseCallableTransport({
      projectId: 'koi-prod',
      region: 'us-central1',
    }, {
      getIdToken: async () => 'secret-id-token',
      getAppCheckToken: async () => 'secret-app-check-token',
    }, vi.fn(async () => new Response(JSON.stringify({
      error: {
        status: 'RESOURCE_EXHAUSTED',
        message: 'The rolling allowance is exhausted.',
        details: { reason: 'CHAT_ALLOWANCE_EXHAUSTED' },
      },
    }), { status: 429 })) as unknown as typeof fetch);
    let caught: unknown;
    try {
      await transport.invoke('askKoiSensei', payload);
    } catch (cause) {
      caught = cause;
    }
    expect(caught).toBeInstanceOf(KoiClientError);
    expect(caught).toMatchObject({ reason: 'CHAT_ALLOWANCE_EXHAUSTED' });
    expect(String(caught)).not.toContain('secret-id-token');
    expect(String(caught)).not.toContain('secret-app-check-token');
  });
});

