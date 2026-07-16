import { HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

import type { KoiErrorReason } from '../../shared/koi/contracts.js';

const ERROR_CODES: Record<KoiErrorReason, FunctionsErrorCode> = {
  AUTH_REQUIRED: 'unauthenticated',
  AGE_RESTRICTED: 'permission-denied',
  CONSENT_REQUIRED: 'failed-precondition',
  DETAILED_PROGRESS_CONSENT_REQUIRED: 'failed-precondition',
  BETA_WAITLISTED: 'resource-exhausted',
  APP_CHECK_FAILED: 'permission-denied',
  INVALID_REQUEST: 'invalid-argument',
  TOKEN_PLAN_BUSY: 'resource-exhausted',
  TOKEN_PLAN_EXHAUSTED: 'resource-exhausted',
  CAPACITY_STALE: 'unavailable',
  CHAT_ALLOWANCE_EXHAUSTED: 'resource-exhausted',
  VOICE_ALLOWANCE_EXHAUSTED: 'resource-exhausted',
  VOICE_CAPACITY_PAUSED: 'failed-precondition',
  CONTENT_BLOCKED: 'failed-precondition',
  PROVIDER_UNAVAILABLE: 'unavailable',
  TIMEOUT: 'deadline-exceeded',
  INTERNAL: 'internal',
};

export class KoiBackendError extends Error {
  readonly reason: KoiErrorReason;
  readonly retryAtMs?: number;

  constructor(reason: KoiErrorReason, message: string, retryAtMs?: number) {
    super(message);
    this.name = 'KoiBackendError';
    this.reason = reason;
    this.retryAtMs = retryAtMs;
  }
}

export function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof KoiBackendError) {
    return new HttpsError(ERROR_CODES[error.reason], error.message, {
      reason: error.reason,
      ...(error.retryAtMs === undefined ? {} : { retryAtMs: error.retryAtMs }),
    });
  }
  return new HttpsError('internal', 'Koi Sensei could not complete the request.', {
    reason: 'INTERNAL' satisfies KoiErrorReason,
  });
}
