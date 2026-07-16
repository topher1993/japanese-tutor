import {
  KoiClientError,
  type KoiCallableName,
  type KoiCallableTransport,
} from './gateway';

export interface KoiFirebaseCallableConfig {
  projectId: string;
  region: string;
  emulatorOrigin?: string;
}

export interface KoiFirebaseTokenSource {
  getIdToken(): Promise<string>;
  getAppCheckToken(): Promise<string | null>;
}

type FetchLike = typeof fetch;

function callableUrl(config: KoiFirebaseCallableConfig, name: KoiCallableName): string {
  if (config.emulatorOrigin) {
    return `${config.emulatorOrigin}/${encodeURIComponent(config.projectId)}/${encodeURIComponent(config.region)}/${name}`;
  }
  return `https://${config.region}-${config.projectId}.cloudfunctions.net/${name}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function remoteError(payload: unknown, status: number): KoiClientError {
  const envelope = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
  const details = isRecord(envelope.details) ? envelope.details : {};
  const reason = typeof details.reason === 'string' ? details.reason : 'LIVE_BACKEND_NOT_CONFIGURED';
  const message = typeof envelope.message === 'string' && envelope.message.trim()
    ? envelope.message
    : `Koi service returned HTTP ${status}.`;
  return new KoiClientError(reason as KoiClientError['reason'], message);
}

/**
 * Firebase callable protocol transport with no provider credential. Auth and
 * App Check tokens are short-lived and requested immediately before each
 * call; neither token is logged, persisted, or included in application state.
 */
export function createKoiFirebaseCallableTransport(
  config: KoiFirebaseCallableConfig,
  tokens: KoiFirebaseTokenSource,
  fetchImpl: FetchLike = fetch,
): KoiCallableTransport {
  const production = !config.emulatorOrigin;
  return {
    async invoke(name, payload) {
      const [idToken, appCheckToken] = await Promise.all([
        tokens.getIdToken(),
        tokens.getAppCheckToken(),
      ]);
      if (!idToken.trim()) {
        throw new KoiClientError('AUTH_REQUIRED', 'Sign in with an email link before using Koi Sensei online.');
      }
      if (production && !appCheckToken?.trim()) {
        throw new KoiClientError('APP_CHECK_FAILED', 'Koi could not verify this app installation.');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55_000);
      try {
        const response = await fetchImpl(callableUrl(config, name), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
            ...(appCheckToken ? { 'X-Firebase-AppCheck': appCheckToken } : {}),
          },
          body: JSON.stringify({ data: payload }),
          signal: controller.signal,
        });
        const source = await response.text();
        if (source.length > 1_000_000) {
          throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an oversized response.');
        }
        let envelope: unknown;
        try {
          envelope = source ? JSON.parse(source) : null;
        } catch {
          throw new KoiClientError('INVALID_RESPONSE', 'Koi returned malformed service data.');
        }
        if (!response.ok || (isRecord(envelope) && isRecord(envelope.error))) {
          throw remoteError(envelope, response.status);
        }
        if (!isRecord(envelope) || (!('result' in envelope) && !('data' in envelope))) {
          throw new KoiClientError('INVALID_RESPONSE', 'Koi returned an invalid callable envelope.');
        }
        return 'result' in envelope ? envelope.result : envelope.data;
      } catch (cause) {
        if (cause instanceof KoiClientError) throw cause;
        if (cause instanceof Error && cause.name === 'AbortError') {
          throw new KoiClientError('TIMEOUT', 'Koi took too long to respond.');
        }
        throw new KoiClientError('LIVE_BACKEND_NOT_CONFIGURED', 'Koi could not reach the configured service.');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export const koiFirebaseCallableUrlForTest = callableUrl;

